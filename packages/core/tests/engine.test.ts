import { describe, expect, it } from "vitest";
import {
  createInitialRunState,
  createRandom,
  createRunEngine,
  defaultPolicies,
  handle,
  nextUint32,
  type EncounterReport,
  type RunState,
} from "../src/index";
import { provider } from "./provider-fixture";

const MODULE = "test:first";
function report(state: RunState, score: number): EncounterReport {
  return {
    encounterId: state.currentEncounter!.id,
    score,
    tags: [],
    metrics: {},
    signals: [],
  };
}
function start(seed = 123): RunState {
  return handle(createInitialRunState(), {
    type: "start-run",
    seed,
    gameplayModuleId: MODULE,
  }).state;
}
function activate(state: RunState): RunState {
  const stored = handle(state, {
    type: "store-gameplay-session",
    session: {
      moduleId: MODULE,
      moduleVersion: 1,
      encounterId: state.currentEncounter!.id,
      data: { complete: true },
    },
  }).state;
  return handle(stored, { type: "start-encounter" }).state;
}

describe("Mulberry32", () => {
  it("matches fixed uint32 vectors", () => {
    let rng = createRandom(1);
    const values: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const next = nextUint32(rng);
      rng = next.state;
      values.push(next.value);
    }
    expect(values).toEqual([
      2693262067, 11749833, 2265367787, 4213581821, 4159151403,
    ]);
  });
});

describe("generic run engine", () => {
  it("derives one deterministic module seed without creating gameplay state", () => {
    const a = start(99),
      b = start(99),
      c = start(100);
    expect(a).toEqual(b);
    expect(a.currentEncounter?.moduleSeed).not.toBe(
      c.currentEncounter?.moduleSeed,
    );
    expect(a.currentEncounter).toEqual({
      id: "encounter-1",
      number: 1,
      target: 29,
      rules: [],
      moduleSeed: a.currentEncounter!.moduleSeed,
    });
  });
  it("requires module-owned state before accepting a report", () => {
    const activeWithoutSession = handle(start(), {
      type: "start-encounter",
    }).state;
    const rejected = handle(activeWithoutSession, {
      type: "submit-encounter",
      report: report(activeWithoutSession, 999),
    });
    expect(rejected.state).toBe(activeWithoutSession);
    expect(rejected.events[0]).toMatchObject({ type: "command-rejected" });
  });
  it("completes the same lifecycle for an arbitrary module", () => {
    let state = start();
    for (let number = 1; number <= 6; number += 1) {
      state = activate(state);
      state = handle(state, {
        type: "submit-encounter",
        report: report(state, 999),
      }).state;
      if (number < 6) state = handle(state, { type: "advance" }).state;
    }
    expect(state.phase).toBe("run-complete");
  });
  it("rejects invalid commands atomically without advancing RNG", () => {
    const ready = start();
    expect(handle(ready, { type: "advance" }).state).toBe(ready);
    expect(
      handle(ready, {
        type: "store-gameplay-session",
        session: {
          moduleId: "test:other",
          moduleVersion: 1,
          encounterId: ready.currentEncounter!.id,
          data: null,
        },
      }).state,
    ).toBe(ready);
  });
  it("continues deterministically after JSON restoration", () => {
    let state = activate(start());
    state = handle(state, {
      type: "submit-encounter",
      report: report(state, 999),
    }).state;
    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    expect(handle(restored, { type: "advance" })).toEqual(
      handle(state, { type: "advance" }),
    );
  });
});

describe("authoritative run policies", () => {
  it("rejects an unknown loadout atomically before consuming RNG", () => {
    const content = provider([]);
    const engine = createRunEngine({ policies: defaultPolicies, content });
    const initial = engine.createInitialState();
    const result = engine.handle(initial, {
      type: "start-run",
      seed: 9,
      gameplayModuleId: MODULE,
      loadoutId: "test:missing",
    });
    expect(result.state).toBe(initial);
    expect(result.events).toEqual([
      expect.objectContaining({ type: "command-rejected" }),
    ]);
  });
  const fourEncounterPolicies = {
    ...defaultPolicies,
    start: {
      ...defaultPolicies.start,
      id: "test:start",
      initialCurrency: () => 37,
    },
    schedule: {
      ...defaultPolicies.schedule,
      id: "test:four-schedule",
      createSchedule: () =>
        Array.from({ length: 4 }, (_, index) => ({
          id: `round-${index + 1}`,
          ordinal: index + 1,
          kind: index === 3 ? "special" : "ordinary",
          rules: index === 3 ? [{ id: "test:special", version: 2 }] : [],
        })),
    },
    target: {
      ...defaultPolicies.target,
      id: "test:target",
      targetForEncounter: () => 1,
    },
    reward: {
      ...defaultPolicies.reward,
      id: "test:reward",
      rewardForEncounter: () => 3,
    },
    shopGeneration: {
      ...defaultPolicies.shopGeneration,
      id: "test:offers",
      offerCount: () => 1,
    },
    shopPricing: {
      ...defaultPolicies.shopPricing,
      id: "test:pricing",
      offerPrice: () => 2,
      rerollPrice: ({ rerollCount }: { readonly rerollCount: number }) =>
        9 + rerollCount * 4,
    },
    inventory: {
      ...defaultPolicies.inventory,
      id: "test:inventory",
      limitFor: () => 1,
    },
    outcome: { ...defaultPolicies.outcome, id: "test:outcome" },
  };
  const definitions = [
    {
      id: "test:item-a",
      category: "passive-modifier",
      tags: [],
      occupiesCapacity: true,
      rarity: "test",
      weight: 1,
      basePrice: 99,
    },
    {
      id: "test:item-b",
      category: "consumable",
      tags: [],
      occupiesCapacity: true,
      rarity: "test",
      weight: 1,
      basePrice: 99,
    },
  ];
  it("uses schedule, start, inventory, target, reward and outcome policies", () => {
    const engine = createRunEngine({
      policies: fourEncounterPolicies,
      content: provider(definitions),
      defaultLoadoutId: "test:loadout",
    });
    let state = engine.handle(engine.createInitialState(), {
      type: "start-run",
      seed: 8,
      gameplayModuleId: MODULE,
    }).state;
    expect(state.currency).toBe(37);
    expect(state.schedule).toHaveLength(4);
    expect(state.inventory).toMatchObject({
      capacities: { "passive-modifier": 1, consumable: 1 },
    });
    for (let index = 0; index < 4; index += 1) {
      state = activateWith(engine, state);
      state = engine.handle(state, {
        type: "submit-encounter",
        report: report(state, 1),
      }).state;
      if (index < 3) state = engine.handle(state, { type: "advance" }).state;
    }
    expect(state.phase).toBe("run-complete");
    expect(state.currency).toBe(49);
    expect(state.currentEncounter?.rules).toEqual([
      { id: "test:special", version: 2 },
    ]);
  });
  it("uses independent offer and reroll pricing operations", () => {
    const engine = createRunEngine({
      policies: fourEncounterPolicies,
      content: provider(definitions),
      defaultLoadoutId: "test:loadout",
    });
    let state = engine.handle(engine.createInitialState(), {
      type: "start-run",
      seed: 3,
      gameplayModuleId: MODULE,
    }).state;
    state = activateWith(engine, state);
    state = engine.handle(state, {
      type: "submit-encounter",
      report: report(state, 2),
    }).state;
    state = engine.handle(state, { type: "enter-shop" }).state;
    expect(state.shop).toMatchObject({ rerollPrice: 9 });
    expect(state.shop?.offers).toHaveLength(1);
    expect(state.shop?.offers[0]?.price).toBe(2);
    state = engine.handle(state, { type: "reroll-shop" }).state;
    expect(state.shop?.rerollPrice).toBe(13);
  });
  it("can continue after a loss when the outcome policy allows it", () => {
    const policies = {
      ...fourEncounterPolicies,
      outcome: {
        ...fourEncounterPolicies.outcome,
        id: "test:continue-loss",
        evaluate: ({
          hasNextEncounter,
        }: {
          readonly hasNextEncounter: boolean;
        }) => (hasNextEncounter ? null : ("won" as const)),
      },
    };
    const engine = createRunEngine({ policies });
    let state = engine.handle(engine.createInitialState(), {
      type: "start-run",
      seed: 1,
      gameplayModuleId: MODULE,
    }).state;
    state = activateWith(engine, state);
    state = engine.handle(state, {
      type: "submit-encounter",
      report: report(state, 0),
    }).state;
    expect(state.phase).toBe("reward");
    expect(
      engine.handle(state, { type: "advance" }).state.schedulePosition,
    ).toBe(1);
  });
});

function activateWith(
  engine: ReturnType<typeof createRunEngine>,
  state: RunState,
): RunState {
  state = engine.handle(state, {
    type: "store-gameplay-session",
    session: {
      moduleId: MODULE,
      moduleVersion: 1,
      encounterId: state.currentEncounter!.id,
      data: null,
    },
  }).state;
  return engine.handle(state, { type: "start-encounter" }).state;
}
