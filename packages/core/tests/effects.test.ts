import { describe, expect, it } from "vitest";
import {
  EffectHandlerRegistry,
  createRandom,
  expireEncounterEffects,
  resolveEffects,
  validateEffectDefinitions,
  type EffectCondition,
  type EffectDefinition,
  type EffectRuntimeState,
  type GameSignal,
} from "../src";

const signal = (overrides: Partial<GameSignal> = {}): GameSignal => ({
  id: "signal-1",
  sequence: 1,
  type: "score",
  tags: ["pair"],
  values: { metric: 3 },
  context: {
    encounterId: "encounter-1",
    actionId: "action-1",
    encounterNumber: 1,
    special: false,
    occurrence: { chain: 1 },
  },
  ...overrides,
});
const runtime = (): EffectRuntimeState => ({
  score: 10,
  target: 20,
  currency: 5,
  priceModifier: 0,
  rng: createRandom(42),
  encounterTags: [],
  allowances: { action: 5 },
  nextInstanceId: 2,
  instances: [
    {
      instanceId: "item-1",
      definitionId: "test:item",
      storedValues: { charge: 1 },
      disabled: false,
    },
  ],
});
const definition = (conditions?: EffectCondition): EffectDefinition => ({
  id: "test:item",
  label: "Test item",
  tags: ["modifier"],
  triggers: [
    {
      id: "score",
      event: "score",
      ...(conditions ? { conditions } : {}),
      operations: [
        { type: "add-score", amount: { from: "signal", key: "metric" } },
        { type: "multiply-score", numerator: 3, denominator: 2 },
      ],
    },
  ],
});

describe("generic effect runtime", () => {
  it("evaluates nested signal, source, numeric, encounter, occurrence, and boolean conditions", () => {
    const condition: EffectCondition = {
      type: "all",
      conditions: [
        { type: "signal-type", value: "score" },
        { type: "signal-tag", tag: "pair" },
        { type: "source-tag", tag: "disabled", present: false },
        {
          type: "compare",
          left: { from: "signal", key: "metric" },
          comparator: "gte",
          right: { from: "constant", value: 3 },
        },
        { type: "encounter-kind", value: "ordinary" },
        { type: "occurrence", scope: "chain", value: "first" },
        {
          type: "any",
          conditions: [
            { type: "not", condition: { type: "signal-tag", tag: "missing" } },
            { type: "signal-tag", tag: "other" },
          ],
        },
      ],
    };
    const result = resolveEffects(runtime(), signal(), [definition(condition)]);
    expect(result.state.score).toBe(19); // floor((10 + 3) * 1.5)
    expect(
      result.ledgerEntries.map((entry) => [entry.before, entry.after]),
    ).toEqual([
      [10, 13],
      [13, 19],
    ]);
  });

  it("orders stage, priority, inventory, trigger and operation deterministically", () => {
    const definitions: EffectDefinition[] = [
      {
        id: "test:item",
        label: "First",
        tags: [],
        triggers: [
          {
            id: "late",
            event: "score",
            priority: 2,
            operations: [
              { type: "add-score", amount: { from: "constant", value: 2 } },
            ],
          },
          {
            id: "early",
            event: "score",
            priority: 1,
            operations: [
              { type: "add-score", amount: { from: "constant", value: 1 } },
            ],
          },
        ],
      },
      {
        id: "test:second",
        label: "Multiplier",
        tags: [],
        triggers: [
          {
            id: "multiply",
            event: "score",
            stage: "multiplicative",
            operations: [
              { type: "multiply-score", numerator: 2, denominator: 1 },
            ],
          },
        ],
      },
    ];
    const state = {
      ...runtime(),
      instances: [
        ...runtime().instances,
        {
          instanceId: "item-2",
          definitionId: "test:second",
          storedValues: {},
          disabled: false,
        },
      ],
    };
    const one = resolveEffects(state, signal(), definitions);
    const two = resolveEffects(state, signal(), definitions);
    expect(one).toEqual(two);
    expect(one.ledgerEntries.map((entry) => entry.triggerId)).toEqual([
      "early",
      "late",
      "multiply",
    ]);
    expect(one.state.score).toBe(26);
  });

  it("updates generic economy, tags, stored values, allowances and instance lifecycle", () => {
    const def: EffectDefinition = {
      id: "test:item",
      label: "Utility",
      tags: [],
      triggers: [
        {
          id: "utility",
          event: "score",
          operations: [
            { type: "currency", amount: { from: "constant", value: -20 } },
            { type: "modify-price", amount: { from: "constant", value: -2 } },
            {
              type: "tag",
              action: "add",
              target: "encounter",
              tag: "charged",
              lifetime: "encounter",
            },
            {
              type: "stored-value",
              key: "charge",
              amount: { from: "constant", value: 4 },
              maximum: 4,
            },
            {
              type: "modify-allowance",
              resource: "action",
              amount: { from: "constant", value: -1 },
              lifetime: "encounter",
            },
            {
              type: "instance",
              action: "create",
              definitionId: "test:temporary",
              expireAfterEncounter: true,
            },
          ],
        },
      ],
    };
    const result = resolveEffects(runtime(), signal(), [def]);
    expect(result.state.currency).toBe(0);
    expect(result.state.priceModifier).toBe(-2);
    expect(result.state.encounterTags).toEqual(["charged"]);
    expect(result.state.instances[0]?.storedValues.charge).toBe(4);
    expect(result.state.allowances.action).toBe(4);
    expect(expireEncounterEffects(result.state).instances).toHaveLength(1);
  });

  it("bounds self-emission and retriggers with structured diagnostics", () => {
    const looping: EffectDefinition = {
      id: "test:item",
      label: "Loop",
      tags: [],
      triggers: [
        {
          id: "loop",
          event: "score",
          operations: [
            { type: "emit-signal", signalType: "score" },
            { type: "retrigger" },
          ],
        },
      ],
    };
    const result = resolveEffects(
      runtime(),
      signal(),
      [looping],
      new EffectHandlerRegistry(),
      {
        maxDepth: 3,
        maxSignals: 10,
        maxOperations: 30,
        maxRetriggersPerSource: 2,
      },
    );
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.some(
        (item) =>
          item.type === "retrigger-limit-exceeded" ||
          item.type === "chain-depth-exceeded" ||
          item.type === "signal-limit-exceeded",
      ),
    ).toBe(true);
  });

  it("consumes seeded chance consistently and validates malformed/custom content", () => {
    const chance = definition({ type: "chance", numerator: 1, denominator: 2 });
    expect(resolveEffects(runtime(), signal(), [chance])).toEqual(
      resolveEffects(runtime(), signal(), [chance]),
    );
    expect(
      resolveEffects(runtime(), signal(), [
        definition({ type: "chance", numerator: 0, denominator: 1 }),
      ]).state.rng,
    ).toEqual(runtime().rng);
    expect(
      resolveEffects(runtime(), signal(), [
        definition({ type: "chance", numerator: 1, denominator: 1 }),
      ]).state.score,
    ).toBe(19);
    const invalid: EffectDefinition = {
      id: "bad",
      label: "Bad",
      tags: [],
      triggers: [
        {
          id: "bad",
          event: "score",
          conditions: { type: "all", conditions: [] },
          operations: [{ type: "custom", handlerId: "missing:handler" }],
        },
      ],
    };
    expect(validateEffectDefinitions([invalid])).toEqual(
      expect.arrayContaining([
        expect.stringContaining("empty all"),
        expect.stringContaining("unknown custom handler"),
      ]),
    );
    const registry = new EffectHandlerRegistry();
    registry.register("test:handler", () => ({}));
    expect(() => registry.register("test:handler", () => ({}))).toThrow(
      /Duplicate/,
    );
    expect(() => registry.register("unqualified", () => ({}))).toThrow(
      /namespaced/,
    );
  });
});
