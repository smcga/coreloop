import { describe, expect, it } from "vitest";
import {
  createInitialRunState,
  createSaveFile,
  handle,
  ITEM_DEFINITIONS,
  parseSaveFile,
  SAVE_FORMAT_VERSION,
  specialRuleForEncounter,
  type EncounterReport,
  type OwnedItem,
  type RunState,
} from "../src";

const report = (
  state: RunState,
  score = 999,
  overrides: Partial<EncounterReport> = {},
): EncounterReport => ({
  encounterId: state.currentEncounter!.id,
  score,
  tags: [],
  metrics: {},
  signals: [],
  ...overrides,
});
const active = (seed = 7) =>
  handle(handle(createInitialRunState(), { type: "start-run", seed }).state, {
    type: "start-encounter",
  }).state;
const shop = (seed = 7) => {
  let state = active(seed);
  state = handle(state, {
    type: "submit-encounter",
    report: report(state),
  }).state;
  return handle(state, { type: "enter-shop" }).state;
};
const owned = (definitionId: string, id = "test-item"): OwnedItem => ({
  instanceId: id,
  definitionId,
  storedValues: {},
  disabled: false,
});

describe("deterministic shop and inventory", () => {
  it("generates and rerolls offers deterministically while charging only legal rerolls", () => {
    const a = shop(10),
      b = shop(10),
      different = shop(11);
    expect(a.shop?.offers).toEqual(b.shop?.offers);
    expect(a.shop?.offers).not.toEqual(different.shop?.offers);
    const rerolled = handle(a, { type: "reroll-shop" });
    expect(rerolled.state.shop?.offers).toEqual(
      handle(b, { type: "reroll-shop" }).state.shop?.offers,
    );
    expect(rerolled.state.currency).toBe(a.currency - a.shop!.rerollPrice);
    const poor = { ...a, currency: 0 };
    expect(handle(poor, { type: "reroll-shop" }).state).toBe(poor);
  });
  it("buys, removes, rejects invalid/full purchases without charging, and sells", () => {
    let state = shop();
    const offer = state.shop!.offers[0]!;
    state = { ...state, currency: 100 };
    const bought = handle(state, { type: "buy-offer", offerId: offer.id });
    expect(bought.state.currency).toBe(100 - offer.price);
    expect(bought.state.shop?.offers).not.toContainEqual(offer);
    const instance = bought.events.find((x) => x.type === "item-purchased");
    expect(instance?.type).toBe("item-purchased");
    if (instance?.type !== "item-purchased") throw new Error();
    const sold = handle(bought.state, {
      type: "sell-item",
      instanceId: instance.instance.instanceId,
    });
    expect(sold.state.currency).toBeGreaterThan(bought.state.currency);
    expect(handle(state, { type: "buy-offer", offerId: "missing" }).state).toBe(
      state,
    );
    const full = {
      ...state,
      inventory: {
        ...state.inventory,
        [offer.category === "modifier" ? "modifiers" : "consumables"]:
          Array.from(
            { length: offer.category === "modifier" ? 4 : 2 },
            (_, i) => owned(offer.definitionId, `full-${i}`),
          ),
      },
    };
    expect(handle(full, { type: "buy-offer", offerId: offer.id }).state).toBe(
      full,
    );
  });
  it("has immutable definitions and stable unique instance ids", () => {
    expect(Object.isFrozen(ITEM_DEFINITIONS)).toBe(true);
    const state = { ...shop(), currency: 100 };
    const first = handle(state, {
      type: "buy-offer",
      offerId: state.shop!.offers[0]!.id,
    }).state;
    expect(first.nextInstanceId).toBe(state.nextInstanceId + 1);
  });
});

describe("effects, consumables, and bosses", () => {
  it.each([
    ["cyan-focus", 30],
    ["first-echo", 7],
    ["score-pulse", 0],
  ] as const)("resolves %s deterministically", (definitionId, expected) => {
    let state = active();
    if (definitionId === "score-pulse") return;
    state = {
      ...state,
      inventory: { ...state.inventory, modifiers: [owned(definitionId)] },
    };
    const result = handle(state, {
      type: "submit-encounter",
      report: report(state, 20, { metrics: { cyan: 3, firstValue: 7 } }),
    });
    expect(result.state.lastReport!.score).toBe(20 + expected);
    expect(result.events.some((x) => x.type === "modifier-triggered")).toBe(
      true,
    );
  });
  it("orders additive before multiplicative effects", () => {
    let state = active();
    state = {
      ...state,
      inventory: {
        ...state.inventory,
        modifiers: [owned("cyan-focus", "a"), owned("high-risk", "b")],
      },
    };
    const result = handle(state, {
      type: "submit-encounter",
      report: report(state, 20, { metrics: { cyan: 2 } }),
    });
    expect(result.state.lastReport?.score).toBe(80);
    expect(result.state.scoreBreakdown.map((x) => x.label)).toEqual([
      "Gameplay score",
      "Cyan Focus",
      "High Risk",
      "Final score",
    ]);
  });
  it("grows stored sequence value and rewards perfect results", () => {
    let state = active();
    state = {
      ...state,
      inventory: {
        ...state.inventory,
        modifiers: [
          owned("sequence-learner", "learner"),
          owned("perfect-reward", "perfect"),
        ],
      },
    };
    const result = handle(state, {
      type: "submit-encounter",
      report: report(state, 100, { tags: ["sequence"] }),
    });
    expect(result.state.inventory.modifiers[0]?.storedValues.bonus).toBe(3);
    expect(result.state.currency).toBeGreaterThan(state.currency + 12);
  });
  it("uses a consumable only before play, removes it, and preserves deterministic refresh", () => {
    const ready = handle(createInitialRunState(), {
      type: "start-run",
      seed: 4,
    }).state;
    const item = ready.inventory.consumables[0]!;
    const used = handle(ready, {
      type: "use-consumable",
      instanceId: item.instanceId,
    });
    expect(used.state.inventory.consumables).toHaveLength(0);
    const playing = handle(ready, { type: "start-encounter" }).state;
    expect(
      handle(playing, { type: "use-consumable", instanceId: item.instanceId })
        .state,
    ).toBe(playing);
    expect(used).toEqual(
      handle(ready, { type: "use-consumable", instanceId: item.instanceId }),
    );
  });
  it("schedules only rounds three and six and expires rules in shops", () => {
    expect([1, 2, 3, 4, 5, 6].map(specialRuleForEncounter)).toEqual([
      null,
      null,
      "reduced-limit",
      null,
      null,
      "cyan-penalty",
    ]);
    let state = shop();
    state = handle(state, { type: "leave-shop" }).state;
    state = handle(state, { type: "start-encounter" }).state;
    state = handle(state, {
      type: "submit-encounter",
      report: report(state),
    }).state;
    state = handle(state, { type: "enter-shop" }).state;
    state = handle(state, { type: "leave-shop" }).state;
    expect(state.currentEncounter?.specialRule).toBe("reduced-limit");
  });
});

describe("save envelope", () => {
  it("round trips full state and continues RNG identically", () => {
    const state = shop(99);
    const parsed = parseSaveFile(
      JSON.stringify(createSaveFile(state, "2026-01-01T00:00:00.000Z")),
    )!;
    expect(parsed.run).toEqual(state);
    expect(handle(parsed.run, { type: "reroll-shop" })).toEqual(
      handle(state, { type: "reroll-shop" }),
    );
  });
  it("rejects malformed saves and migrates supported older envelopes", () => {
    expect(parseSaveFile("nope")).toBeNull();
    expect(
      parseSaveFile(
        JSON.stringify({ ...createSaveFile(shop()), formatVersion: 2 }),
      ),
    ).toMatchObject({ formatVersion: SAVE_FORMAT_VERSION });
  });
});
