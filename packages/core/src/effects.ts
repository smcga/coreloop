import { nextUint32, type RandomState } from "./random";
import { canonicalJson } from "./canonical";
import { FrameworkError } from "./errors";

export type NumericComparator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
export type NumericValue =
  | { readonly from: "constant"; readonly value: number }
  | { readonly from: "signal" | "metric" | "stored"; readonly key: string }
  | { readonly from: "score" | "target" | "currency" | "owned-count" };

export type EffectCondition =
  | { readonly type: "signal-type"; readonly value: string }
  | {
      readonly type: "signal-tag" | "source-tag";
      readonly tag: string;
      readonly present?: boolean;
    }
  | {
      readonly type: "compare";
      readonly left: NumericValue;
      readonly comparator: NumericComparator;
      readonly right: NumericValue;
    }
  | { readonly type: "encounter-kind"; readonly value: "ordinary" | "special" }
  | {
      readonly type: "occurrence";
      readonly scope: "chain" | "action" | "encounter" | "run";
      readonly value: "first" | "last";
    }
  | {
      readonly type: "chance";
      readonly numerator: number;
      readonly denominator: number;
    }
  | {
      readonly type: "all" | "any";
      readonly conditions: readonly EffectCondition[];
    }
  | { readonly type: "not"; readonly condition: EffectCondition };

export interface EffectSource {
  readonly definitionId: string;
  readonly instanceId?: string;
  readonly triggerIndex?: number;
}
export interface SignalContext {
  readonly encounterId: string;
  readonly actionId?: string | undefined;
  readonly encounterNumber: number;
  readonly special: boolean;
  readonly occurrence?: Readonly<Record<string, number>>;
}
export interface GameSignal {
  readonly id: string;
  readonly sequence: number;
  readonly type: string;
  readonly source?: EffectSource | undefined;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
  readonly context: SignalContext;
  readonly depth?: number;
  readonly retriggered?: boolean | undefined;
}
export type EffectStage =
  "gameplay" | "additive" | "multiplicative" | "encounter-rule" | "post-result";

export type EffectOperation =
  | {
      readonly type: "add-score";
      readonly amount: NumericValue;
      readonly factor?: number;
      readonly label?: string;
    }
  | {
      readonly type: "multiply-score";
      readonly numerator: number;
      readonly denominator: number;
      readonly label?: string;
    }
  | {
      readonly type: "modify-target";
      readonly amount: NumericValue;
      readonly label?: string;
    }
  | { readonly type: "currency"; readonly amount: NumericValue }
  | { readonly type: "modify-price"; readonly amount: NumericValue }
  | {
      readonly type: "tag";
      readonly action: "add" | "remove";
      readonly target: "signal" | "encounter" | "source";
      readonly tag: string;
      readonly lifetime: "chain" | "encounter" | "run";
    }
  | {
      readonly type: "stored-value";
      readonly key: string;
      readonly action?: "increment" | "set";
      readonly amount: NumericValue;
      readonly default?: number;
      readonly minimum?: number;
      readonly maximum?: number;
      readonly targetInstanceId?: string;
    }
  | {
      readonly type: "instance";
      readonly action: "create" | "destroy" | "disable" | "enable";
      readonly definitionId?: string;
      readonly targetInstanceId?: string;
      readonly expireAfterEncounter?: boolean;
    }
  | {
      readonly type: "modify-allowance";
      readonly resource: string;
      readonly amount: NumericValue;
      readonly lifetime: "encounter";
    }
  | {
      readonly type: "emit-signal";
      readonly signalType: string;
      readonly tags?: readonly string[];
      readonly values?: Readonly<Record<string, number>>;
    }
  | { readonly type: "retrigger"; readonly signalType?: string }
  | {
      readonly type: "custom";
      readonly handlerId: string;
      readonly payload?: Readonly<Record<string, string | number | boolean>>;
    };

export interface EffectTrigger {
  readonly id: string;
  readonly event: string;
  readonly priority?: number;
  readonly stage?: EffectStage;
  readonly conditions?: EffectCondition;
  readonly operations: readonly EffectOperation[];
}
export interface EffectDefinition {
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
  readonly triggers: readonly EffectTrigger[];
}
export interface EffectInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly storedValues: Readonly<Record<string, number>>;
  readonly disabled: boolean;
  readonly destroyed?: boolean | undefined;
  readonly tags?: readonly string[];
  readonly expiresAfterEncounter?: boolean | undefined;
}
export interface ScoreLedgerEntry {
  readonly sequence: number;
  readonly encounterId: string;
  readonly actionId?: string | undefined;
  readonly source: EffectSource;
  readonly triggerId: string;
  readonly operation:
    "base" | "add" | "multiply" | "target" | "final" | "outcome";
  readonly label: string;
  readonly before: number;
  readonly after: number;
  readonly amount?: number | undefined;
  readonly multiplier?:
    | {
        readonly numerator: number;
        readonly denominator: number;
      }
    | undefined;
  readonly roundingAdjustment?: number | undefined;
  readonly stage: EffectStage;
  readonly retriggered?: boolean | undefined;
}
export type EffectDiagnostic =
  | {
      readonly type: "chain-depth-exceeded";
      readonly limit: number;
      readonly signalId: string;
      readonly source?: EffectSource | undefined;
    }
  | {
      readonly type: "signal-limit-exceeded" | "operation-limit-exceeded";
      readonly limit: number;
      readonly count: number;
      readonly source?: EffectSource | undefined;
    }
  | {
      readonly type: "retrigger-limit-exceeded";
      readonly limit: number;
      readonly count: number;
      readonly source: EffectSource;
    }
  | {
      readonly type: "unknown-operation";
      readonly operationType: string;
      readonly source?: EffectSource | undefined;
    }
  | {
      readonly type: "invalid-content";
      readonly message: string;
      readonly source?: EffectSource | undefined;
    };
export interface EffectRuntimeState {
  readonly score: number;
  readonly target: number;
  readonly currency: number;
  readonly priceModifier: number;
  readonly rng: RandomState;
  readonly instances: readonly EffectInstance[];
  readonly encounterTags: readonly string[];
  readonly allowances: Readonly<Record<string, number>>;
  readonly nextInstanceId: number;
}
export interface EffectResolutionResult {
  readonly state: EffectRuntimeState;
  readonly events: readonly EffectRuntimeEvent[];
  readonly emittedSignals: readonly GameSignal[];
  readonly ledgerEntries: readonly ScoreLedgerEntry[];
  readonly diagnostics: readonly EffectDiagnostic[];
}
export type EffectRuntimeEvent =
  | {
      readonly type:
        | "signal-received"
        | "trigger-queued"
        | "trigger-resolved"
        | "signal-emitted";
      readonly signalId: string;
      readonly source?: EffectSource | undefined;
      readonly triggerId?: string;
    }
  | {
      readonly type: "condition-evaluated";
      readonly triggerId: string;
      readonly passed: boolean;
      readonly source: EffectSource;
    }
  | {
      readonly type: "instance-changed" | "stored-value-changed";
      readonly source: EffectSource;
      readonly value?: number;
    }
  | {
      readonly type: "effect-diagnostic";
      readonly diagnostic: EffectDiagnostic;
    };
export const EFFECT_LIMITS = Object.freeze({
  maxDepth: 12,
  maxSignals: 64,
  maxOperations: 256,
  maxRetriggersPerSource: 8,
});

export interface CustomEffectContext {
  readonly state: EffectRuntimeState;
  readonly signal: GameSignal;
  readonly source: EffectSource;
  readonly operation: Extract<EffectOperation, { type: "custom" }>;
}
export interface CustomEffectResult {
  readonly state?: EffectRuntimeState;
  readonly signals?: readonly Omit<GameSignal, "sequence">[];
  readonly events?: readonly EffectRuntimeEvent[];
}
export type CustomEffectHandler = (
  context: CustomEffectContext,
) => CustomEffectResult;
export class EffectHandlerRegistry {
  private readonly handlers = new Map<
    string,
    {
      readonly version: number;
      readonly handler: CustomEffectHandler;
      readonly builtIn: boolean;
    }
  >();
  register(
    id: string,
    handler: CustomEffectHandler,
    version = 1,
    options: {
      readonly builtIn?: boolean;
      readonly allowBuiltInReplacement?: boolean;
    } = {},
  ): void {
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(id))
      throw new FrameworkError(
        "unknown-custom-handler",
        "Custom handler IDs must be namespaced",
        { actual: id },
      );
    if (!Number.isSafeInteger(version) || version < 1)
      throw new FrameworkError(
        "unknown-custom-handler",
        `Custom handler '${id}' has an invalid version`,
        { actual: version },
      );
    if (this.handlers.has(id))
      throw new FrameworkError(
        "duplicate-id",
        `Duplicate custom handler: ${id}`,
        { definitionId: id },
      );
    if (
      id.startsWith("core:") &&
      !options.builtIn &&
      !options.allowBuiltInReplacement
    )
      throw new FrameworkError(
        "unknown-custom-handler",
        `Built-in handler namespace cannot be replaced: ${id}`,
        { definitionId: id },
      );
    this.handlers.set(id, {
      handler,
      version,
      builtIn: options.builtIn ?? false,
    });
  }
  get(id: string): CustomEffectHandler | undefined {
    return this.handlers.get(id)?.handler;
  }
  has(id: string): boolean {
    return this.handlers.has(id);
  }
  references(): readonly { readonly id: string; readonly version: number }[] {
    return [...this.handlers].map(([id, value]) => ({
      id,
      version: value.version,
    }));
  }
}

const stages: Record<EffectStage, number> = {
  gameplay: 0,
  additive: 1,
  multiplicative: 2,
  "encounter-rule": 3,
  "post-result": 4,
};
function readValue(
  value: NumericValue,
  state: EffectRuntimeState,
  signal: GameSignal,
  instance?: EffectInstance,
): number {
  switch (value.from) {
    case "constant":
      return value.value;
    case "signal":
      return signal.values[value.key] ?? 0;
    case "metric":
      return signal.values[value.key] ?? 0;
    case "stored":
      return instance?.storedValues[value.key] ?? 0;
    case "score":
      return state.score;
    case "target":
      return state.target;
    case "currency":
      return state.currency;
    case "owned-count":
      return state.instances.filter((x) => !x.destroyed).length;
  }
}
function compare(a: number, op: NumericComparator, b: number): boolean {
  return op === "eq"
    ? a === b
    : op === "ne"
      ? a !== b
      : op === "gt"
        ? a > b
        : op === "gte"
          ? a >= b
          : op === "lt"
            ? a < b
            : a <= b;
}
function replaceInstance(
  state: EffectRuntimeState,
  instance: EffectInstance,
): EffectRuntimeState {
  return {
    ...state,
    instances: state.instances.map((x) =>
      x.instanceId === instance.instanceId ? instance : x,
    ),
  };
}

export function validateEffectDefinitions(
  definitions: readonly EffectDefinition[],
  registry = new EffectHandlerRegistry(),
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id))
      errors.push(`Duplicate definition ${definition.id}`);
    ids.add(definition.id);
    const triggerIds = new Set<string>();
    for (const trigger of definition.triggers) {
      if (triggerIds.has(trigger.id))
        errors.push(`${definition.id}: duplicate trigger ${trigger.id}`);
      triggerIds.add(trigger.id);
      if (!trigger.operations.length)
        errors.push(
          `${definition.id}/${trigger.id}: operations must not be empty`,
        );
      const check = (condition: EffectCondition): void => {
        if (
          (condition.type === "all" || condition.type === "any") &&
          condition.conditions.length === 0
        )
          errors.push(
            `${definition.id}/${trigger.id}: empty ${condition.type}`,
          );
        if (condition.type === "all" || condition.type === "any")
          condition.conditions.forEach(check);
        if (condition.type === "not") check(condition.condition);
        if (
          condition.type === "chance" &&
          (!Number.isSafeInteger(condition.numerator) ||
            !Number.isSafeInteger(condition.denominator) ||
            condition.denominator <= 0 ||
            condition.numerator < 0 ||
            condition.numerator > condition.denominator)
        )
          errors.push(`${definition.id}/${trigger.id}: invalid chance`);
      };
      if (trigger.conditions) check(trigger.conditions);
      for (const operation of trigger.operations) {
        if (
          operation.type === "multiply-score" &&
          (!Number.isSafeInteger(operation.numerator) ||
            !Number.isSafeInteger(operation.denominator) ||
            operation.denominator <= 0)
        )
          errors.push(`${definition.id}/${trigger.id}: invalid multiplier`);
        if (operation.type === "custom" && !registry.has(operation.handlerId))
          errors.push(
            `${definition.id}/${trigger.id}: unknown custom handler ${operation.handlerId}`,
          );
      }
    }
  }
  return errors;
}

export function resolveEffects(
  initial: EffectRuntimeState,
  firstSignal: GameSignal,
  definitions: readonly EffectDefinition[],
  registry = new EffectHandlerRegistry(),
  limits: {
    readonly maxDepth: number;
    readonly maxSignals: number;
    readonly maxOperations: number;
    readonly maxRetriggersPerSource: number;
  } = EFFECT_LIMITS,
): EffectResolutionResult {
  let state = initial;
  const events: EffectRuntimeEvent[] = [];
  const emittedSignals: GameSignal[] = [];
  const ledger: ScoreLedgerEntry[] = [];
  const diagnostics: EffectDiagnostic[] = [];
  const queue: GameSignal[] = [firstSignal];
  let nextSequence = firstSignal.sequence + 1;
  let operations = 0;
  const retriggers = new Map<string, number>();
  const diagnostic = (value: EffectDiagnostic): void => {
    diagnostics.push(value);
    events.push({ type: "effect-diagnostic", diagnostic: value });
  };
  const conditionPasses = (
    condition: EffectCondition,
    signal: GameSignal,
    definition: EffectDefinition,
    instance: EffectInstance,
  ): boolean => {
    switch (condition.type) {
      case "signal-type":
        return signal.type === condition.value;
      case "signal-tag":
        return (
          signal.tags.includes(condition.tag) === (condition.present !== false)
        );
      case "source-tag":
        return (
          [...definition.tags, ...(instance.tags ?? [])].includes(
            condition.tag,
          ) ===
          (condition.present !== false)
        );
      case "compare":
        return compare(
          readValue(condition.left, state, signal, instance),
          condition.comparator,
          readValue(condition.right, state, signal, instance),
        );
      case "encounter-kind":
        return signal.context.special === (condition.value === "special");
      case "occurrence": {
        const n = signal.context.occurrence?.[condition.scope] ?? 1;
        return condition.value === "first" ? n === 1 : n === -1;
      }
      case "chance": {
        if (condition.numerator === 0) return false;
        if (condition.numerator === condition.denominator) return true;
        const roll = nextUint32(state.rng);
        state = { ...state, rng: roll.state };
        return roll.value % condition.denominator < condition.numerator;
      }
      case "all":
        return condition.conditions.every((x) =>
          conditionPasses(x, signal, definition, instance),
        );
      case "any":
        return condition.conditions.some((x) =>
          conditionPasses(x, signal, definition, instance),
        );
      case "not":
        return !conditionPasses(
          condition.condition,
          signal,
          definition,
          instance,
        );
    }
  };
  while (queue.length) {
    if (emittedSignals.length + 1 > limits.maxSignals) {
      diagnostic({
        type: "signal-limit-exceeded",
        limit: limits.maxSignals,
        count: emittedSignals.length + 1,
      });
      break;
    }
    const signal = queue.shift()!;
    events.push({
      type: "signal-received",
      signalId: signal.id,
      source: signal.source,
    });
    if ((signal.depth ?? 0) > limits.maxDepth) {
      diagnostic({
        type: "chain-depth-exceeded",
        limit: limits.maxDepth,
        signalId: signal.id,
        source: signal.source,
      });
      continue;
    }
    const executions = state.instances.flatMap((instance, inventoryIndex) => {
      if (instance.disabled || instance.destroyed) return [];
      const definition = definitions.find(
        (x) => x.id === instance.definitionId,
      );
      if (!definition) return [];
      return definition.triggers
        .map((trigger, triggerIndex) => ({
          instance,
          definition,
          trigger,
          triggerIndex,
          inventoryIndex,
          source: {
            definitionId: definition.id,
            instanceId: instance.instanceId,
            triggerIndex,
          } satisfies EffectSource,
        }))
        .filter(
          (x) =>
            x.trigger.event === signal.type &&
            (!x.trigger.conditions ||
              conditionPasses(
                x.trigger.conditions,
                signal,
                x.definition,
                x.instance,
              )),
        )
        .map((x) => ({ ...x, signal }));
    });
    executions.sort(
      (a, b) =>
        stages[a.trigger.stage ?? "additive"] -
          stages[b.trigger.stage ?? "additive"] ||
        (a.trigger.priority ?? 0) - (b.trigger.priority ?? 0) ||
        a.inventoryIndex - b.inventoryIndex ||
        a.instance.instanceId.localeCompare(b.instance.instanceId) ||
        a.triggerIndex - b.triggerIndex,
    );
    executions.forEach((x) =>
      events.push({
        type: "trigger-queued",
        signalId: signal.id,
        source: x.source,
        triggerId: x.trigger.id,
      }),
    );
    for (const execution of executions) {
      const current = state.instances.find(
        (x) => x.instanceId === execution.instance.instanceId,
      );
      if (!current || current.disabled || current.destroyed) continue;
      events.push({
        type: "condition-evaluated",
        triggerId: execution.trigger.id,
        passed: true,
        source: execution.source,
      });
      for (const operation of execution.trigger.operations) {
        operations += 1;
        if (operations > limits.maxOperations) {
          diagnostic({
            type: "operation-limit-exceeded",
            limit: limits.maxOperations,
            count: operations,
            source: execution.source,
          });
          queue.length = 0;
          break;
        }
        const before = state.score;
        const value =
          "amount" in operation
            ? readValue(operation.amount, state, signal, current) *
              (operation.type === "add-score" ? (operation.factor ?? 1) : 1)
            : 0;
        const label =
          "label" in operation && operation.label
            ? operation.label
            : execution.definition.label;
        if (operation.type === "add-score")
          state = { ...state, score: state.score + value };
        else if (operation.type === "multiply-score")
          state = {
            ...state,
            score: Math.floor(
              (state.score * operation.numerator) / operation.denominator,
            ),
          };
        else if (operation.type === "modify-target")
          state = { ...state, target: Math.max(0, state.target + value) };
        else if (operation.type === "currency")
          state = { ...state, currency: Math.max(0, state.currency + value) };
        else if (operation.type === "modify-price")
          state = { ...state, priceModifier: state.priceModifier + value };
        else if (operation.type === "tag") {
          if (operation.target === "signal") {
            const tags = new Set(signal.tags);
            if (operation.action === "add") tags.add(operation.tag);
            else tags.delete(operation.tag);
            (signal as { tags: readonly string[] }).tags = [...tags];
          } else if (operation.target === "encounter") {
            const tags = new Set(state.encounterTags);
            if (operation.action === "add") tags.add(operation.tag);
            else tags.delete(operation.tag);
            state = { ...state, encounterTags: [...tags] };
          } else {
            const tags = new Set(current.tags ?? []);
            if (operation.action === "add") tags.add(operation.tag);
            else tags.delete(operation.tag);
            state = replaceInstance(state, { ...current, tags: [...tags] });
          }
        } else if (operation.type === "stored-value") {
          const targetId = operation.targetInstanceId ?? current.instanceId;
          const target = state.instances.find((x) => x.instanceId === targetId);
          if (target) {
            const prior =
              target.storedValues[operation.key] ?? operation.default ?? 0;
            const raw = operation.action === "set" ? value : prior + value;
            const changed = Math.min(
              operation.maximum ?? Infinity,
              Math.max(operation.minimum ?? -Infinity, raw),
            );
            state = replaceInstance(state, {
              ...target,
              storedValues: {
                ...target.storedValues,
                [operation.key]: changed,
              },
            });
            events.push({
              type: "stored-value-changed",
              source: {
                definitionId: target.definitionId,
                instanceId: target.instanceId,
              },
              value: changed,
            });
          }
        } else if (operation.type === "instance") {
          const targetId = operation.targetInstanceId ?? current.instanceId;
          if (operation.action === "create" && operation.definitionId) {
            const created: EffectInstance = {
              instanceId: `effect-${state.nextInstanceId}`,
              definitionId: operation.definitionId,
              storedValues: {},
              disabled: false,
              expiresAfterEncounter: operation.expireAfterEncounter,
            };
            state = {
              ...state,
              instances: [...state.instances, created],
              nextInstanceId: state.nextInstanceId + 1,
            };
          } else {
            const target = state.instances.find(
              (x) => x.instanceId === targetId,
            );
            if (target)
              state = replaceInstance(state, {
                ...target,
                destroyed:
                  operation.action === "destroy" ? true : target.destroyed,
                disabled:
                  operation.action === "disable"
                    ? true
                    : operation.action === "enable"
                      ? false
                      : target.disabled,
              });
          }
          events.push({ type: "instance-changed", source: execution.source });
        } else if (operation.type === "modify-allowance")
          state = {
            ...state,
            allowances: {
              ...state.allowances,
              [operation.resource]: Math.max(
                0,
                (state.allowances[operation.resource] ?? 0) + value,
              ),
            },
          };
        else if (
          operation.type === "emit-signal" ||
          operation.type === "retrigger"
        ) {
          const key =
            execution.source.instanceId ?? execution.source.definitionId;
          if (operation.type === "retrigger") {
            const count = (retriggers.get(key) ?? 0) + 1;
            retriggers.set(key, count);
            if (count > limits.maxRetriggersPerSource) {
              diagnostic({
                type: "retrigger-limit-exceeded",
                limit: limits.maxRetriggersPerSource,
                count,
                source: execution.source,
              });
              continue;
            }
          }
          const child: GameSignal = {
            id: `${firstSignal.id}.${nextSequence}`,
            sequence: nextSequence++,
            type:
              operation.type === "emit-signal"
                ? operation.signalType
                : (operation.signalType ?? signal.type),
            source: execution.source,
            tags:
              operation.type === "emit-signal"
                ? (operation.tags ?? [])
                : signal.tags,
            values:
              operation.type === "emit-signal"
                ? (operation.values ?? {})
                : signal.values,
            context: signal.context,
            depth: (signal.depth ?? 0) + 1,
            retriggered: operation.type === "retrigger",
          };
          queue.push(child);
          emittedSignals.push(child);
          events.push({
            type: "signal-emitted",
            signalId: child.id,
            source: execution.source,
          });
        } else if (operation.type === "custom") {
          const handler = registry.get(operation.handlerId);
          if (!handler)
            diagnostic({
              type: "unknown-operation",
              operationType: `custom:${operation.handlerId}`,
              source: execution.source,
            });
          else {
            // A handler only receives a private serialisable snapshot. Its result is
            // committed after successful canonical validation, so exceptions cannot
            // leak partially-mutated runtime state.
            const result = handler({
              state: structuredClone(state),
              signal,
              source: execution.source,
              operation,
            });
            canonicalJson(result);
            state = result.state ?? state;
            events.push(...(result.events ?? []));
          }
        }
        if (
          operation.type === "add-score" ||
          operation.type === "multiply-score" ||
          operation.type === "modify-target"
        )
          ledger.push({
            sequence: ledger.length + 1,
            encounterId: signal.context.encounterId,
            actionId: signal.context.actionId,
            source: execution.source,
            triggerId: execution.trigger.id,
            operation:
              operation.type === "add-score"
                ? "add"
                : operation.type === "multiply-score"
                  ? "multiply"
                  : "target",
            label,
            before:
              operation.type === "modify-target"
                ? state.target - value
                : before,
            after:
              operation.type === "modify-target" ? state.target : state.score,
            amount: operation.type === "multiply-score" ? undefined : value,
            multiplier:
              operation.type === "multiply-score"
                ? {
                    numerator: operation.numerator,
                    denominator: operation.denominator,
                  }
                : undefined,
            roundingAdjustment:
              operation.type === "multiply-score"
                ? state.score -
                  (before * operation.numerator) / operation.denominator
                : undefined,
            stage: execution.trigger.stage ?? "additive",
            retriggered: signal.retriggered,
          });
      }
      events.push({
        type: "trigger-resolved",
        signalId: signal.id,
        source: execution.source,
        triggerId: execution.trigger.id,
      });
    }
  }
  return { state, events, emittedSignals, ledgerEntries: ledger, diagnostics };
}

export function expireEncounterEffects(
  state: EffectRuntimeState,
): EffectRuntimeState {
  return {
    ...state,
    encounterTags: [],
    instances: state.instances.filter((x) => !x.expiresAfterEncounter),
  };
}
