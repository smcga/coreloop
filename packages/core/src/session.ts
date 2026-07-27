import { canonicalJson } from "./canonical";
import {
  type GameplayActionContext,
  type GameplayActionResult,
  type GameplayReportContext,
  type GameplayModuleRegistry,
  type GameplaySessionState,
  type JsonValue,
  type ModuleGameplaySignal,
} from "./gameplay";
import {
  type EncounterReport,
  type RunCommand,
  type RunState,
  type TransitionResult,
  createRunEngine,
  type RunConfiguration,
} from "./engine";

export interface GameplayActionTransition extends TransitionResult {
  readonly accepted: boolean;
  readonly completed: boolean;
}
interface ErasedGameplayModule {
  validateAction(value: unknown): unknown;
  validateState(value: unknown): unknown;
  handleAction(
    state: unknown,
    action: unknown,
    context: GameplayActionContext,
  ): GameplayActionResult<unknown>;
  isComplete(state: unknown): boolean;
  createReport(state: unknown, context: GameplayReportContext): EncounterReport;
}

/**
 * The authoritative, headless boundary for run commands and gameplay actions.
 * Module state remains opaque to the run reducer and is only persisted after a
 * complete validation/effect transaction succeeds.
 */
export function createHeadlessRunSession(options: {
  readonly configuration: RunConfiguration;
  readonly modules: GameplayModuleRegistry;
}) {
  const engine = createRunEngine(options.configuration);

  const rejected = (
    state: Readonly<RunState>,
    command: RunCommand["type"],
    reason: string,
  ): TransitionResult => ({
    state: state as RunState,
    events: [{ type: "command-rejected", command, phase: state.phase, reason }],
  });

  const moduleFor = (state: Readonly<RunState>) => {
    return options.modules.get(state.gameplayModuleId);
  };

  const envelope = (
    state: Readonly<RunState>,
    data: unknown,
  ): GameplaySessionState => {
    const module = moduleFor(state);
    const encounter = state.currentEncounter;
    if (!encounter) throw new Error("No prepared encounter is available");
    const validated = module.validateState(data);
    canonicalJson(validated);
    return {
      moduleId: module.id,
      moduleVersion: module.version,
      encounterId: encounter.id,
      data: validated as JsonValue,
    };
  };

  const restore = (state: Readonly<RunState>) => {
    if (!state.gameplaySession)
      throw new Error("A gameplay session is required");
    if (state.gameplaySession.encounterId !== state.currentEncounter?.id)
      throw new Error("Gameplay session does not match the active encounter");
    if (state.gameplaySession.moduleId !== state.gameplayModuleId)
      throw new Error("Gameplay session module does not match the run");
    return {
      module: moduleFor(state),
      data: options.modules.restore(state.gameplaySession),
    };
  };

  const validateSignals = (signals: readonly ModuleGameplaySignal[]) => {
    canonicalJson(signals);
    const generic = new Set([
      "score",
      "action-completed",
      "pattern-completed",
      "score-contribution",
    ]);
    if (
      signals.length > 64 ||
      signals.some(
        (signal) => !signal.type.includes(":") && !generic.has(signal.type),
      )
    )
      throw new Error(
        "Gameplay signals must be namespaced and within the 64-signal limit",
      );
    for (const signal of signals)
      for (const value of Object.values(signal.values))
        if (!Number.isFinite(value))
          throw new Error("Gameplay signal values must be finite");
  };

  const validateReport = (report: EncounterReport, encounterId: string) => {
    canonicalJson(report);
    if (report.encounterId !== encounterId)
      throw new Error("Report does not match the encounter");
    if (
      !Number.isFinite(report.score) ||
      Object.values(report.metrics).some((v) => !Number.isFinite(v))
    )
      throw new Error("Report score and metrics must be finite");
    validateSignals(report.signals);
  };

  const handleCommand = (
    state: Readonly<RunState>,
    command: RunCommand,
  ): TransitionResult => {
    if (
      command.type === "store-gameplay-session" ||
      command.type === "submit-encounter"
    )
      return rejected(
        state,
        command.type,
        "This command is internal to the gameplay coordinator",
      );
    if (command.type !== "start-encounter")
      return engine.handle(state, command);
    if (state.phase !== "encounter-ready" || !state.currentEncounter)
      return engine.handle(state, command);
    try {
      const module = moduleFor(state);
      const created = module.createEncounter({
        encounterId: state.currentEncounter.id,
        encounterNumber: state.currentEncounter.number,
        target: state.currentEncounter.target,
        rules: state.currentEncounter.rules,
        seed: state.currentEncounter.moduleSeed,
      });
      validateSignals(created.signals ?? []);
      const session = envelope(state, created.state);
      const transition = engine.handle(state, {
        type: "store-gameplay-session",
        session,
        signals: created.signals ?? [],
        actionId: "core:encounter-initialised",
      });
      if (transition.state === state) return transition;
      const started = engine.handle(transition.state, command);
      return {
        state: started.state,
        events: [...transition.events, ...started.events],
      };
    } catch (cause) {
      return rejected(
        state,
        command.type,
        cause instanceof Error
          ? cause.message
          : "Gameplay initialisation failed",
      );
    }
  };

  const handleGameplayAction = (
    state: Readonly<RunState>,
    value: unknown,
  ): GameplayActionTransition => {
    if (state.phase !== "encounter-active")
      return {
        ...rejected(
          state,
          "store-gameplay-session",
          "An active encounter is required",
        ),
        accepted: false,
        completed: false,
      };
    try {
      const restored = restore(state);
      const module = restored.module as unknown as ErasedGameplayModule;
      const action = module.validateAction(value);
      canonicalJson(action);
      const result = module.handleAction(restored.data, action, {
        encounterId: state.currentEncounter!.id,
        encounterNumber: state.currentEncounter!.number,
      });
      if (!result.accepted)
        return {
          ...rejected(
            state,
            "store-gameplay-session",
            result.reason ?? "Gameplay action was rejected",
          ),
          accepted: false,
          completed: false,
        };
      validateSignals(result.signals);
      const session = envelope(state, result.state);
      const transition = engine.handle(state, {
        type: "store-gameplay-session",
        session,
        signals: result.signals,
        actionId: "core:gameplay-action",
      });
      if (transition.state === state)
        return { ...transition, accepted: false, completed: false };
      const validated = module.validateState(session.data);
      if (!module.isComplete(validated))
        return { ...transition, accepted: true, completed: false };
      const report = module.createReport(validated, {
        encounterId: state.currentEncounter!.id,
        encounterNumber: state.currentEncounter!.number,
      });
      validateReport(report, state.currentEncounter!.id);
      const resolved = engine.handle(transition.state, {
        type: "submit-encounter",
        report,
      });
      return {
        state: resolved.state,
        events: [...transition.events, ...resolved.events],
        accepted: true,
        completed: true,
      };
    } catch (cause) {
      return {
        ...rejected(
          state,
          "store-gameplay-session",
          cause instanceof Error ? cause.message : "Gameplay action failed",
        ),
        accepted: false,
        completed: false,
      };
    }
  };

  const validateRestoredState = (state: Readonly<RunState>): RunState => {
    if (state.gameplaySession) restore(state);
    return state as RunState;
  };

  return {
    createInitialState: engine.createInitialState,
    handleCommand,
    handleGameplayAction,
    validateRestoredState,
    definitionFor: engine.definitionFor,
    policyReferences: engine.policyReferences,
    configuration: engine.configuration,
  } as const;
}
