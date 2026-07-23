import type { RandomState } from "./random";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface GameplaySessionState {
  readonly moduleId: string;
  readonly moduleVersion: number;
  readonly encounterId: string;
  readonly data: JsonValue;
}

export interface ModuleGameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
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
  readonly specialRuleId: string | null;
  readonly specialRulePayload?: JsonValue;
  readonly rng: RandomState;
}

export interface GameplayActionContext {
  readonly encounterId: string;
  readonly encounterNumber: number;
}

export type GameplayReportContext = GameplayActionContext;

export interface GameplayEncounterCreation<TState> {
  readonly state: TState;
  readonly rng: RandomState;
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
  readonly displayName: string;
  readonly description: string;
  readonly capabilities: readonly string[];
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

export const createGameplayModuleRegistry = (
  modules: readonly GameplayModule<unknown, unknown>[],
): GameplayModuleRegistry => new GameplayModuleRegistry(modules);
