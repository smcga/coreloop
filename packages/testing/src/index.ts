import {
  createInitialRunState,
  handle,
  type GameplayModule,
  type JsonValue,
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
  readonly specialRuleFor?: (encounterNumber: number) => string | null;
}): GameplayScenarioResult {
  let transition = handle(createInitialRunState(), {
    type: "start-run",
    seed: options.seed,
    gameplayModuleId: options.module.id,
  });
  let state = transition.state;
  const events: RunEvent[] = [...transition.events];
  const checkpoints: string[] = [];
  while (state.phase !== "run-complete" && state.phase !== "run-failed") {
    if (state.phase === "encounter-ready") {
      const brief = state.currentEncounter!;
      const creation = options.module.createEncounter({
        encounterId: brief.id,
        encounterNumber: brief.number,
        target: brief.target,
        specialRuleId: options.specialRuleFor?.(brief.number) ?? null,
        rng: state.rng,
      });
      let gameplay = creation.state;
      for (const action of options.actions(gameplay)) {
        const result = options.module.handleAction(gameplay, action, {
          encounterId: brief.id,
          encounterNumber: brief.number,
        });
        if (!result.accepted)
          throw new Error(`Scenario action rejected: ${result.reason}`);
        gameplay = result.state;
      }
      if (!options.module.isComplete(gameplay))
        throw new Error(`Scenario did not complete ${options.module.id}`);
      transition = handle(state, {
        type: "store-gameplay-session",
        session: {
          moduleId: options.module.id,
          moduleVersion: options.module.version,
          encounterId: brief.id,
          data: gameplay as unknown as JsonValue,
        },
      });
      state = transition.state;
      transition = handle(state, { type: "start-encounter" });
      state = transition.state;
      events.push(...transition.events);
      transition = handle(state, {
        type: "submit-encounter",
        report: options.module.createReport(gameplay, {
          encounterId: brief.id,
          encounterNumber: brief.number,
        }),
      });
      state = transition.state;
      events.push(...transition.events);
      checkpoints.push(JSON.stringify(state));
    } else if (state.phase === "reward") {
      transition = handle(state, { type: "enter-shop" });
      state = transition.state;
      events.push(...transition.events);
    } else if (state.phase === "shop") {
      transition = handle(state, { type: "leave-shop" });
      state = transition.state;
      events.push(...transition.events);
    } else {
      throw new Error(`Unexpected scenario phase ${state.phase}`);
    }
  }
  return { state, events, serialisedCheckpoints: checkpoints };
}
