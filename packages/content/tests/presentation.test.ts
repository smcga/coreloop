import { describe, expect, it } from "vitest";
import { stableHash } from "@core-loop/core";
import {
  createEncounterHeaderViewModel,
  createAcquisitionTargetViewModel,
  createInventoryViewModel,
  createShopOfferViewModel,
  formatCurrency,
  formatLocalisedTerm,
  resolvePresentation,
  selectPresentation,
  thresholdLabContentPack,
  validatePresentationPacks,
  type ActionLabelKey,
  type LocalePresentationPack,
} from "../src";

const actions = Object.fromEntries(
  [
    "start",
    "continue",
    "advance",
    "reroll",
    "buy",
    "sell",
    "use",
    "attach",
    "transform",
    "duplicate",
  ].map((key) => [key, key]),
) as Record<ActionLabelKey, string>;
const terms = thresholdLabContentPack.terminology[0]!.terms;
const makePack = (
  overrides: Partial<LocalePresentationPack> = {},
): LocalePresentationPack => ({
  id: "test:en-gb",
  locale: "en-GB",
  terminology: terms,
  actions,
  content: { "test:item": { name: "Item", description: "An item" } },
  modules: {
    "test:module": {
      name: "Module",
      description: "A module",
      instructions: "Do it",
    },
  },
  rules: { "test:rule": { name: "Rule", description: "A rule" } },
  tracks: { score: "Score", accuracy: "Accuracy" },
  currency: { display: "code", code: "GBP", maximumFractionDigits: 0 },
  ...overrides,
});

describe("locale presentation", () => {
  it("selects a locale and falls back deterministically by stable ID", () => {
    const fallback = makePack();
    const translated = makePack({
      id: "test:fr",
      locale: "fr-FR",
      content: {},
    });
    const selection = selectPresentation(
      [fallback, translated],
      fallback.id,
      translated.id,
    );
    expect(resolvePresentation(selection, "content", "test:item").name).toBe(
      "Item",
    );
    expect(resolvePresentation(selection, "rule", "missing").name).toBe(
      "[missing]",
    );
    expect(selection.diagnostics).toEqual([
      { packId: "test:fr", locale: "fr-FR", kind: "rule", id: "missing" },
    ]);
  });

  it("uses locale plural rules for zero, one, and two", () => {
    const pack = makePack();
    expect(
      [0, 1, 2].map((n) => formatLocalisedTerm(pack, "currency", n)),
    ).toEqual(["Coins", "Coin", "Coins"]);
  });

  it("formats GBP and fictional noun or icon currencies", () => {
    expect(formatCurrency(makePack(), 0)).toBe("£0");
    expect(formatCurrency(makePack(), 12)).toBe("£12");
    expect(
      formatCurrency(
        makePack({ currency: { display: "name", nameKey: "currency" } }),
        2,
      ),
    ).toBe("2 Coins");
    expect(
      formatCurrency(
        makePack({ currency: { display: "symbol", symbol: "🌱" } }),
        12,
      ),
    ).toBe("🌱12");
  });

  it("builds variable progress, named requirements, and resolved offers", () => {
    const pack = makePack();
    expect(
      createEncounterHeaderViewModel(pack, {
        current: 3,
        total: 9,
        target: 40,
        score: 12,
        currency: 5,
      }),
    ).toMatchObject({
      progress: { current: 3, total: 9, text: "Run 3/9" },
      target: "Target 40",
      score: "Score 12",
      currency: "£5",
    });
    expect(
      createShopOfferViewModel(selectPresentation([pack], pack.id, pack.id), {
        definitionId: "test:item",
        price: 12,
      }),
    ).toMatchObject({ name: "Item", price: "£12" });
    expect(pack.tracks.accuracy).toBe("Accuracy");
    const selection = selectPresentation([pack], pack.id, pack.id);
    expect(
      createInventoryViewModel(
        selection,
        [
          {
            instanceId: "i1",
            definitionId: "test:item",
            attachmentIds: ["a1"],
            storedValues: { charge: 2 },
          },
        ],
        3,
      ),
    ).toMatchObject({
      capacity: 3,
      items: [{ attachmentCount: 1, storedValues: { charge: 2 } }],
    });
    expect(
      createAcquisitionTargetViewModel(selection, {
        definitionId: "test:item",
        targetInstanceIds: ["i1"],
      }),
    ).toMatchObject({ name: "Item", requiresTarget: true });
  });

  it("reports actionable validation paths", () => {
    const invalid = makePack({
      locale: "not a locale",
      currency: { display: "code" },
      modules: {},
    });
    const errors = validatePresentationPacks(
      "test:owner",
      [invalid],
      "test:missing",
      { modules: ["test:module"] },
    );
    expect(errors.map((error) => `${error.packId}:${error.path}`)).toEqual(
      expect.arrayContaining([
        "test:en-gb:locale",
        "test:en-gb:modules.test:module",
        "test:en-gb:currency.code",
        "test:owner:defaultLocaleId",
      ]),
    );
  });

  it("keeps locale selection outside canonical authoritative state", () => {
    const state = { seed: 7, currency: 12, schedulePosition: 2 };
    const before = stableHash(state);
    selectPresentation(
      [makePack(), makePack({ id: "test:alternate" })],
      "test:en-gb",
      "test:alternate",
    );
    expect(stableHash(state)).toBe(before);
  });
});
