import { describe, expect, it } from "vitest";
import {
  createGameplayModuleRegistry,
  createHeadlessRunSession,
  defaultPolicies,
  type GameplayModule,
} from "../src";

type State = { readonly count: number };
type Action = { readonly type: "finish" };

const oneActionModule = (
  overrides: Partial<GameplayModule<State, Action>> = {},
): GameplayModule<State, Action> => ({
  id: "test:one-action",
  version: 1,
  displayName: "One action",
  description: "Test fixture",
  capabilities: ["score", "action"],
  createEncounter: () => ({ state: { count: 0 } }),
  validateState(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !("count" in value) ||
      !Number.isSafeInteger(value.count)
    )
      throw new Error("invalid state");
    return value as State;
  },
  validateAction(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !("type" in value) ||
      value.type !== "finish"
    )
      throw new Error("invalid action");
    return value as Action;
  },
  handleAction: (state) =>
    state.count
      ? { state, accepted: false, signals: [], reason: "already complete" }
      : {
          state: { count: 1 },
          accepted: true,
          signals: [{ type: "action-completed", tags: [], values: {} }],
        },
  isComplete: (state) => state.count === 1,
  getProgress: (state) => ({
    completedActions: state.count,
    totalActions: 1,
    score: state.count * 999,
    status: "test",
    metrics: {},
  }),
  createReport: (state, context) => ({
    encounterId: context.encounterId,
    score: state.count * 999,
    tags: [],
    metrics: { count: state.count },
    signals: [],
  }),
  ...overrides,
});

const setup = (module = oneActionModule()) => {
  const session = createHeadlessRunSession({
    configuration: { policies: defaultPolicies },
    modules: createGameplayModuleRegistry([
      module as GameplayModule<unknown, unknown>,
    ]),
  });
  let state = session.handleCommand(session.createInitialState(), {
    type: "start-run",
    seed: 33,
    gameplayModuleId: module.id,
  }).state;
  state = session.handleCommand(state, { type: "start-encounter" }).state;
  return { session, state };
};

describe("headless gameplay session coordinator", () => {
  it("initialises state and automatically creates the authoritative report", () => {
    const { session, state } = setup();
    expect(state.gameplaySession?.data).toEqual({ count: 0 });
    const result = session.handleGameplayAction(state, { type: "finish" });
    expect(result.accepted).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.state.lastReport).toMatchObject({
      encounterId: "encounter-1",
      score: 999,
      metrics: { count: 1 },
    });
    expect(result.events.map((event) => event.type)).toContain("encounter-won");
  });

  it("preserves the exact state for invalid and module-rejected actions", () => {
    const { session, state } = setup();
    expect(session.handleGameplayAction(state, { type: "forged" }).state).toBe(
      state,
    );
    const rejecting = setup(
      oneActionModule({
        handleAction: () => ({
          state: { count: 100 },
          accepted: false,
          signals: [],
          reason: "no",
        }),
      }),
    );
    expect(
      rejecting.session.handleGameplayAction(rejecting.state, {
        type: "finish",
      }).state,
    ).toBe(rejecting.state);
  });

  it("rejects malformed module output and initialisation atomically", () => {
    const malformed = setup(
      oneActionModule({
        handleAction: () => ({
          state: { count: 1 },
          accepted: true,
          signals: [{ type: "bad", tags: [], values: { score: Number.NaN } }],
        }),
      }),
    );
    expect(
      malformed.session.handleGameplayAction(malformed.state, {
        type: "finish",
      }).state,
    ).toBe(malformed.state);

    const module = oneActionModule({
      createEncounter: () => {
        throw new Error("creation failed");
      },
    });
    const session = createHeadlessRunSession({
      configuration: { policies: defaultPolicies },
      modules: createGameplayModuleRegistry([
        module as GameplayModule<unknown, unknown>,
      ]),
    });
    const ready = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 1,
      gameplayModuleId: module.id,
    }).state;
    expect(
      session.handleCommand(ready, { type: "start-encounter" }).state,
    ).toBe(ready);
  });

  it("forbids host-authored state envelopes and reports", () => {
    const { session, state } = setup();
    const result = session.handleCommand(state, {
      type: "submit-encounter",
      report: {
        encounterId: "encounter-1",
        score: 999999,
        tags: [],
        metrics: {},
        signals: [],
      },
    });
    expect(result.state).toBe(state);
    expect(result.events[0]).toMatchObject({ type: "command-rejected" });
  });

  it("validates restored module identity, version, state, and encounter", () => {
    const { session, state } = setup();
    expect(() =>
      session.validateRestoredState({
        ...state,
        gameplaySession: { ...state.gameplaySession!, moduleVersion: 2 },
      }),
    ).toThrow(/incompatible/);
    expect(() =>
      session.validateRestoredState({
        ...state,
        gameplaySession: { ...state.gameplaySession!, encounterId: "forged" },
      }),
    ).toThrow(/does not match/);
    expect(() =>
      session.validateRestoredState({
        ...state,
        gameplaySession: { ...state.gameplaySession!, data: { nope: true } },
      }),
    ).toThrow(/invalid state/);
  });
});
