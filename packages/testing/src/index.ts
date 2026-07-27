import {
  createHeadlessRunSession,
  createGameplayModuleRegistry,
  defaultPolicies,
  type GameplayModule,
  type RunEvent,
  type RunState,
} from "@core-loop/core";

export interface GameplayScenarioResult {
  readonly state: RunState;
  readonly events: readonly RunEvent[];
  readonly serialisedCheckpoints: readonly string[];
}

/** Runs the same framework lifecycle for any headless gameplay adapter. */
export function runGameplayModuleScenario<TState, TAction>(options: {
  readonly module: GameplayModule<TState, TAction>;
  readonly seed: number;
  readonly actions: (state: Readonly<TState>) => readonly TAction[];
}): GameplayScenarioResult {
  const session = createHeadlessRunSession({
    configuration: { policies: defaultPolicies },
    modules: createGameplayModuleRegistry([
      options.module as GameplayModule<unknown, unknown>,
    ]),
  });
  let transition = session.handleCommand(session.createInitialState(), {
    type: "start-run",
    seed: options.seed,
    gameplayModuleId: options.module.id,
  });
  let state = transition.state;
  const events: RunEvent[] = [...transition.events];
  const checkpoints: string[] = [];
  while (state.phase !== "run-complete" && state.phase !== "run-failed") {
    if (state.phase === "encounter-ready") {
      transition = session.handleCommand(state, { type: "start-encounter" });
      state = transition.state;
      events.push(...transition.events);
      let gameplay = options.module.validateState(state.gameplaySession!.data);
      for (const action of options.actions(gameplay)) {
        const result = session.handleGameplayAction(state, action);
        if (!result.accepted) throw new Error("Scenario action rejected");
        state = result.state;
        events.push(...result.events);
        if (state.gameplaySession)
          gameplay = options.module.validateState(state.gameplaySession.data);
      }
      if (!options.module.isComplete(gameplay))
        throw new Error(`Scenario did not complete ${options.module.id}`);
      checkpoints.push(JSON.stringify(state));
    } else if (state.phase === "reward") {
      transition = session.handleCommand(state, { type: "enter-shop" });
      state = transition.state;
      events.push(...transition.events);
    } else if (state.phase === "shop") {
      transition = session.handleCommand(state, { type: "leave-shop" });
      state = transition.state;
      events.push(...transition.events);
    } else {
      throw new Error(`Unexpected scenario phase ${state.phase}`);
    }
  }
  return { state, events, serialisedCheckpoints: checkpoints };
}
