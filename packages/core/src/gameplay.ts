export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface GameplaySessionState {
  readonly moduleId: string;
  readonly moduleVersion: number;
  readonly encounterId: string;
  readonly data: JsonValue;
  readonly projection?: { readonly id: string; readonly version: number };
}

export interface ModuleGameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
}

export interface GameplayOperationContext {
  readonly run: JsonValue;
  readonly gameplay: JsonValue;
  readonly operation: JsonValue;
}
export interface GameplayOperationResult {
  readonly gameplay: JsonValue;
  readonly signals?: readonly ModuleGameplaySignal[];
}
export interface GameplayOperationHandler {
  readonly id: string;
  readonly version: number;
  readonly supportedModuleIds?: readonly string[];
  apply(context: GameplayOperationContext): GameplayOperationResult;
}

/** Explicit application boundary for deterministic operations on opaque state. */
export class GameplayOperationRegistry {
  private readonly handlers = new Map<string, GameplayOperationHandler>();

  constructor(handlers: readonly GameplayOperationHandler[] = []) {
    for (const handler of handlers) {
      if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(handler.id))
        throw new Error("Gameplay operation IDs must be namespaced");
      if (!Number.isSafeInteger(handler.version) || handler.version < 1)
        throw new Error(
          `Gameplay operation '${handler.id}' has an invalid version`,
        );
      if (this.handlers.has(handler.id))
        throw new Error(`Duplicate gameplay operation ID '${handler.id}'`);
      this.handlers.set(handler.id, handler);
    }
  }

  get(id: string): GameplayOperationHandler | undefined {
    return this.handlers.get(id);
  }

  references(): readonly { readonly id: string; readonly version: number }[] {
    return [...this.handlers.values()].map(({ id, version }) => ({
      id,
      version,
    }));
  }
}

export interface GameplayProgress {
  readonly completedActions: number;
  readonly totalActions: number;
  readonly score: number;
  readonly status: string;
  readonly metrics: Readonly<Record<string, number>>;
}

export interface GameplayEncounterContext {
  readonly encounterId: string;
  readonly encounterNumber: number;
  readonly target: number;
  readonly requirements?: import("./engine").EncounterRequirements;
  readonly rules: readonly RuleReference[];
  /** A seed derived by advancing the run RNG exactly once. */
  readonly seed: number;
  /** Application-defined, presentation-free data projected from run ownership. */
  readonly projection: JsonValue;
  /** Authoritative encounter-scoped action budgets after preparation effects. */
  readonly allowances: Readonly<Record<string, number>>;
  readonly encounterTags: readonly string[];
  readonly runTags: readonly string[];
}

export interface InventoryProjectionInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly storedValues: Readonly<Record<string, number>>;
  readonly disabled: boolean;
  readonly destroyed: boolean;
  readonly attachmentIds: readonly string[];
  readonly hostInstanceId?: string;
  readonly transformationHistory: readonly string[];
}

export interface InventoryProjection {
  readonly instances: readonly InventoryProjectionInstance[];
  readonly activeRunUpgradeIds: readonly string[];
}

export interface GameplayProjectionContext {
  readonly encounter: import("./engine").EncounterBrief;
  readonly inventory: InventoryProjection;
  readonly content: import("./content").RuntimeContentProvider;
  readonly runTags: readonly string[];
  readonly encounterTags: readonly string[];
  readonly allowances: Readonly<Record<string, number>>;
}

/** A pure, versioned adapter from generic run ownership to module-local JSON. */
export interface GameplayContextProjection {
  readonly id: string;
  readonly version: number;
  readonly moduleId: string;
  project(context: GameplayProjectionContext): JsonValue;
}

export interface RuleReference {
  readonly id: string;
  readonly version: number;
  readonly payload?: JsonValue;
}

export interface GameplayActionContext {
  readonly encounterId: string;
  readonly encounterNumber: number;
  /** Current values, including effects resolved after earlier actions. */
  readonly allowances: Readonly<Record<string, number>>;
}

export type GameplayReportContext = Pick<
  GameplayActionContext,
  "encounterId" | "encounterNumber"
>;

export interface GameplayEncounterCreation<TState> {
  readonly state: TState;
  readonly signals?: readonly ModuleGameplaySignal[];
}

export interface GameplayActionResult<TState> {
  readonly state: TState;
  readonly accepted: boolean;
  readonly signals: readonly ModuleGameplaySignal[];
  readonly reason?: string;
}

export interface GameplayBotStrategy<TState, TAction> {
  nextAction(state: Readonly<TState>): TAction;
}

export interface GameplayModule<TState, TAction> {
  readonly id: string;
  readonly version: number;
  readonly capabilities: readonly string[];
  /** Supported keys and their non-negative encounter-start defaults. */
  readonly allowanceDefaults?: Readonly<Record<string, number>>;
  createEncounter(
    context: GameplayEncounterContext,
  ): GameplayEncounterCreation<TState>;
  handleAction(
    state: Readonly<TState>,
    action: TAction,
    context: GameplayActionContext,
  ): GameplayActionResult<TState>;
  createReport(
    state: Readonly<TState>,
    context: GameplayReportContext,
  ): import("./engine").EncounterReport;
  getProgress(state: Readonly<TState>): GameplayProgress;
  isComplete(state: Readonly<TState>): boolean;
  validateState(value: unknown): TState;
  /** Validates untrusted browser, replay, simulation, or bot input. */
  validateAction(value: unknown): TAction;
  createBotStrategy?(): GameplayBotStrategy<TState, TAction>;
}

export type AnyGameplayModule = GameplayModule<unknown, never>;

export class GameplayModuleRegistry {
  private readonly modules: ReadonlyMap<
    string,
    GameplayModule<unknown, unknown>
  >;

  constructor(modules: readonly GameplayModule<unknown, unknown>[]) {
    const entries = new Map<string, GameplayModule<unknown, unknown>>();
    for (const module of modules) {
      if (entries.has(module.id))
        throw new Error(`Duplicate gameplay module ID '${module.id}'`);
      if (!module.id.includes(":"))
        throw new Error(`Gameplay module ID '${module.id}' must be namespaced`);
      if (!Number.isSafeInteger(module.version) || module.version < 1)
        throw new Error(
          `Gameplay module '${module.id}' has an invalid version`,
        );
      if (new Set(module.capabilities).size !== module.capabilities.length)
        throw new Error(
          `Gameplay module '${module.id}' has duplicate capabilities`,
        );
      for (const [key, value] of Object.entries(
        module.allowanceDefaults ?? {},
      )) {
        if (!isAllowanceKey(key))
          throw new Error(
            `Gameplay module '${module.id}' has invalid allowance key '${key}'`,
          );
        if (!Number.isSafeInteger(value) || value < 0)
          throw new Error(
            `Gameplay module '${module.id}' has invalid allowance '${key}'`,
          );
      }
      entries.set(module.id, module);
    }
    this.modules = entries;
  }

  list(): readonly GameplayModule<unknown, unknown>[] {
    return [...this.modules.values()];
  }

  get(id: string): GameplayModule<unknown, unknown> {
    const module = this.modules.get(id);
    if (!module) throw new Error(`Unknown gameplay module ID '${id}'`);
    return module;
  }

  restore(envelope: GameplaySessionState): unknown {
    const module = this.get(envelope.moduleId);
    if (module.version !== envelope.moduleVersion)
      throw new Error(
        `Gameplay module '${module.id}' save version ${envelope.moduleVersion} is incompatible with installed version ${module.version}`,
      );
    return module.validateState(envelope.data);
  }
}

const RESERVED_ALLOWANCE_KEYS = new Set(["action", "turn", "attempt"]);
export const isAllowanceKey = (key: string): boolean =>
  RESERVED_ALLOWANCE_KEYS.has(key) || /^[a-z0-9-]+:[a-z0-9-]+$/.test(key);

export const createGameplayModuleRegistry = (
  modules: readonly GameplayModule<unknown, unknown>[],
): GameplayModuleRegistry => new GameplayModuleRegistry(modules);
