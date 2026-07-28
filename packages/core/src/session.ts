import { canonicalJson } from "./canonical";
import {
  type GameplayActionContext,
  type GameplayActionResult,
  type GameplayReportContext,
  type GameplayModuleRegistry,
  type GameplaySessionState,
  type JsonValue,
  type ModuleGameplaySignal,
  GameplayOperationRegistry,
} from "./gameplay";
import {
  type EncounterReport,
  type RunCommand,
  type RunState,
  type TransitionResult,
  createRunEngine,
  type RunConfiguration,
} from "./engine";
import { FrameworkError } from "./errors";

const EMPTY_PROJECTION = {} as const;

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
  readonly operations?: GameplayOperationRegistry;
}) {
  const configuredProjection = options.configuration.gameplayProjection;
  if (configuredProjection) {
    if (!configuredProjection.id.includes(":"))
      throw new Error("Gameplay projection ID must be namespaced");
    if (
      !Number.isSafeInteger(configuredProjection.version) ||
      configuredProjection.version < 1
    )
      throw new Error("Gameplay projection version must be a positive integer");
    if (!options.configuration.content)
      throw new Error("A content provider is required for gameplay projection");
  }
  const configuration: RunConfiguration = {
    ...options.configuration,
    gameplayAllowanceDefaults: Object.fromEntries(
      options.modules
        .list()
        .map((module) => [module.id, { ...(module.allowanceDefaults ?? {}) }]),
    ),
  };
  const engine = createRunEngine(configuration);

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
      ...(options.configuration.gameplayProjection
        ? {
            projection: {
              id: options.configuration.gameplayProjection.id,
              version: options.configuration.gameplayProjection.version,
            },
          }
        : {}),
    };
  };

  const restore = (state: Readonly<RunState>) => {
    if (!state.gameplaySession)
      throw new Error("A gameplay session is required");
    if (state.gameplaySession.encounterId !== state.currentEncounter?.id)
      throw new Error("Gameplay session does not match the active encounter");
    if (state.gameplaySession.moduleId !== state.gameplayModuleId)
      throw new Error("Gameplay session module does not match the run");
    const expectedProjection = options.configuration.gameplayProjection;
    const savedProjection = state.gameplaySession.projection;
    if (expectedProjection && savedProjection?.id !== expectedProjection.id)
      throw new FrameworkError(
        "unknown-gameplay-projection",
        `Gameplay projection '${savedProjection?.id ?? "missing"}' is unavailable`,
        savedProjection ? { projectionId: savedProjection.id } : {},
      );
    if (
      expectedProjection &&
      savedProjection?.version !== expectedProjection.version
    )
      throw new FrameworkError(
        "incompatible-projection-version",
        `Gameplay projection '${expectedProjection.id}' version ${String(savedProjection?.version)} is incompatible with installed version ${expectedProjection.version}`,
        {
          projectionId: expectedProjection.id,
          expected: expectedProjection.version,
          actual: savedProjection?.version,
        },
      );
    if (!expectedProjection && savedProjection)
      throw new FrameworkError(
        "unknown-gameplay-projection",
        `Gameplay projection '${savedProjection.id}' is not installed`,
        { projectionId: savedProjection.id },
      );
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
    const namespacedNumericMaps = [
      report.tracks ?? {},
      report.resources ?? {},
      report.statistics ?? {},
    ];
    if (
      !Number.isFinite(report.score) ||
      namespacedNumericMaps.some((values) =>
        Object.entries(values).some(
          ([key, value]) =>
            (!key.includes(":") && key !== "score") || !Number.isFinite(value),
        ),
      ) ||
      Object.values(report.metrics).some((value) => !Number.isFinite(value)) ||
      Object.keys(report.objectives ?? {}).some(
        (key) => !key.includes(":") && key !== "target",
      )
    )
      throw new Error(
        "Report keys must be namespaced and numeric values must be finite",
      );
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
    if (command.type === "use-consumable") {
      const owned = state.inventory.instances.find(
        (item) => item.instanceId === command.instanceId,
      );
      let definition;
      try {
        definition = owned
          ? options.configuration.content?.getDefinition(owned.definitionId)
          : undefined;
      } catch {
        definition = undefined;
      }
      if (definition?.use?.type === "custom") {
        try {
          if (state.phase !== "encounter-active")
            return rejected(
              state,
              command.type,
              "Module-local consumables require an active encounter",
            );
          const reference = definition.use.handler;
          const handler = options.operations?.get(reference.id);
          if (!handler)
            throw new Error(
              `Gameplay operation '${reference.id}' is not installed`,
            );
          if (handler.version !== reference.version)
            throw new Error(
              `Gameplay operation '${reference.id}' version ${reference.version} is incompatible with installed version ${handler.version}`,
            );
          if (
            handler.supportedModuleIds &&
            !handler.supportedModuleIds.includes(state.gameplayModuleId)
          )
            throw new Error(
              `Gameplay operation '${reference.id}' does not support module '${state.gameplayModuleId}'`,
            );
          const restored = restore(state);
          const result = handler.apply({
            run: structuredClone({
              phase: state.phase,
              currency: state.currency,
              encounterNumber: state.encounterNumber,
              encounterId: state.currentEncounter?.id ?? null,
            }),
            gameplay: structuredClone(state.gameplaySession!.data),
            operation: structuredClone(reference.payload ?? {}),
          });
          canonicalJson(result);
          validateSignals(result.signals ?? []);
          const module = restored.module as unknown as ErasedGameplayModule;
          module.validateState(result.gameplay);
          const session = envelope(state, result.gameplay);
          const stored = engine.handle(state, {
            type: "store-gameplay-session",
            session,
            signals: result.signals ?? [],
            actionId: reference.id,
          });
          if (stored.state === state) return stored;
          const consumed = engine.handle(stored.state, command);
          return {
            state: consumed.state,
            events: [...stored.events, ...consumed.events],
          };
        } catch (cause) {
          return rejected(
            state,
            command.type,
            cause instanceof Error
              ? cause.message
              : "Gameplay operation failed",
          );
        }
      }
    }
    if (command.type !== "start-encounter")
      return engine.handle(state, command);
    if (state.phase !== "encounter-ready" || !state.currentEncounter)
      return engine.handle(state, command);
    try {
      const module = moduleFor(state);
      const projector = options.configuration.gameplayProjection;
      if (projector && projector.moduleId !== module.id)
        throw new Error(
          `Gameplay projection '${projector.id}' is incompatible with module '${module.id}'`,
        );
      const projection = projector
        ? projector.project({
            encounter: state.currentEncounter,
            inventory: {
              instances: state.inventory.instances.map((instance) => {
                const definition = options.configuration.content?.getDefinition(
                  instance.definitionId,
                );
                if (!definition)
                  throw new Error(
                    "A content provider is required for projection",
                  );
                return {
                  instanceId: instance.instanceId,
                  definitionId: instance.definitionId,
                  category: definition.category,
                  tags: [...definition.tags, ...instance.temporaryTags],
                  storedValues: { ...instance.storedValues },
                  disabled: instance.disabled,
                  destroyed: instance.destroyed,
                  attachmentIds: [...instance.attachmentIds],
                  ...(instance.hostInstanceId
                    ? { hostInstanceId: instance.hostInstanceId }
                    : {}),
                  transformationHistory: [...instance.transformationHistory],
                };
              }),
              activeRunUpgradeIds: [...state.inventory.upgradeIds],
            },
            content: options.configuration.content!,
            runTags: [...state.effects.runTags],
            encounterTags: [...state.effects.encounterTags],
            allowances: { ...state.effects.allowances },
          })
        : EMPTY_PROJECTION;
      // Canonicalisation rejects undefined, functions, cycles and non-finite values
      // before either the run RNG or state can be advanced.
      canonicalJson(projection);
      const created = module.createEncounter({
        encounterId: state.currentEncounter.id,
        encounterNumber: state.currentEncounter.number,
        target: state.currentEncounter.target,
        requirements: state.currentEncounter.requirements,
        rules: state.currentEncounter.rules,
        seed: state.currentEncounter.moduleSeed,
        projection,
        allowances: { ...state.effects.allowances },
        encounterTags: [...state.effects.encounterTags],
        runTags: [...state.effects.runTags],
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
        allowances: { ...state.effects.allowances },
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
