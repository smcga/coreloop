import { describe, expect, it } from "vitest";
import {
  createRunEngine,
  defaultPolicies,
  type EncounterReport,
  type RuntimeContentDefinition,
} from "../src";
import { provider } from "./provider-fixture";

const definition: RuntimeContentDefinition = {
  id: "test:transaction-item",
  category: "passive-modifier",
  tags: ["modifier"],
  occupiesCapacity: true,
  initialStoredValues: { attempts: 0 },
  triggers: [
    {
      id: "remember-actions",
      event: "test:attempt",
      operations: [
        {
          type: "stored-value",
          key: "attempts",
          amount: { from: "constant", value: 1 },
        },
      ],
    },
    {
      id: "spend-actions",
      event: "score-calculation-started",
      operations: [
        {
          type: "add-score",
          amount: { from: "stored", key: "attempts" },
        },
      ],
    },
    {
      id: "reward-win",
      event: "encounter-won",
      operations: [
        { type: "currency", amount: { from: "constant", value: 3 } },
      ],
    },
  ],
};

const setup = () => {
  const engine = createRunEngine({
    policies: defaultPolicies,
    content: provider([definition], [definition.id]),
    defaultLoadoutId: "test:loadout",
  });
  let state = engine.handle(engine.createInitialState(), {
    type: "start-run",
    seed: 42,
    gameplayModuleId: "test:module",
  }).state;
  state = engine.handle(state, { type: "start-encounter" }).state;
  return { engine, state };
};

describe("authoritative effect transactions", () => {
  it("processes accepted action and report signals in order and persists counters", () => {
    const { engine, state: active } = setup();
    const session = {
      moduleId: "test:module",
      moduleVersion: 1,
      encounterId: active.currentEncounter!.id,
      data: { attempts: 2 },
    } as const;
    const action = engine.handle(active, {
      type: "store-gameplay-session",
      session,
      actionId: "attempt-1",
      signals: [
        { type: "test:attempt", tags: ["first"], values: { value: 1 } },
        { type: "test:attempt", tags: ["second"], values: { value: 2 } },
      ],
    });
    expect(action.state.inventory.instances[0]?.storedValues.attempts).toBe(2);
    const report: EncounterReport = {
      encounterId: active.currentEncounter!.id,
      score: 100,
      tags: [],
      metrics: {},
      signals: [{ type: "test:report", tags: [], values: {} }],
    };
    const result = engine.handle(action.state, {
      type: "submit-encounter",
      report,
    });
    expect(result.state.lastReport?.score).toBe(102);
    expect(result.state.currency).toBe(25); // 10 start + 3 effect + 12 encounter reward
    expect(result.state.effects.nextSignalSequence).toBeGreaterThan(6);
    expect(result.state.effects.nextEventSequence).toBeGreaterThan(1);
    expect(
      result.events.filter((event) => event.type === "effect-runtime").length,
    ).toBeGreaterThan(0);
  });

  it("rejects malformed action signals without changing state or counters", () => {
    const { engine, state } = setup();
    const rejected = engine.handle(state, {
      type: "store-gameplay-session",
      session: {
        moduleId: "test:module",
        moduleVersion: 1,
        encounterId: state.currentEncounter!.id,
        data: null,
      },
      signals: [{ type: "not-namespaced", tags: [], values: {} }],
    });
    expect(rejected.state).toBe(state);
    expect(rejected.events).toEqual([
      expect.objectContaining({ type: "command-rejected" }),
    ]);
  });
});
