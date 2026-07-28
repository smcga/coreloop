import { canonicalJson } from "../canonical";
import {
  resolveEffects,
  type EffectDefinition,
  type EffectDiagnostic,
  type EffectRuntimeEvent,
  type EffectRuntimeState,
  type GameSignal,
  type ScoreLedgerEntry,
} from "../effects";
import { defaultPolicies } from "../policies";
import type {
  ContentInstance,
  EncounterReport,
  GameplaySignal,
  RunConfiguration,
  RunEvent,
  RunState,
  ScoreLine,
} from "../run/contracts";

const definitionsOf = (
  configuration: RunConfiguration,
  gameplayModuleId: string,
) => configuration.content?.listDefinitions({ gameplayModuleId }) ?? [];

export const effectDefinitions = (
  configuration: RunConfiguration,
  gameplayModuleId: string,
): readonly EffectDefinition[] => [
  ...definitionsOf(configuration, gameplayModuleId)
    .filter((definition) => definition.triggers)
    .map((definition) => ({
      id: definition.id,
      label: definition.id,
      tags: [
        definition.category,
        ...(definition.rarity ? [definition.rarity] : []),
      ],
      triggers: definition.triggers!,
    })),
  ...Object.values(configuration.encounterRuleEffects ?? {}),
];

export const validGameplaySignals = (
  signals: readonly GameplaySignal[],
): boolean => {
  if (signals.length > 64) return false;
  try {
    canonicalJson(signals);
  } catch {
    return false;
  }
  return signals.every(
    (signal) =>
      typeof signal.type === "string" &&
      signal.type.length > 0 &&
      (signal.type.includes(":") ||
        [
          "score",
          "action-completed",
          "pattern-completed",
          "score-contribution",
        ].includes(signal.type)) &&
      signal.tags.every((tag) => typeof tag === "string") &&
      Object.values(signal.values).every(Number.isFinite),
  );
};
export const validEncounterReport = (report: EncounterReport): boolean => {
  try {
    canonicalJson(report);
  } catch {
    return false;
  }
  const validNamedMap = (
    values: Readonly<Record<string, number>> | undefined,
  ) =>
    Object.entries(values ?? {}).every(
      ([key, value]) =>
        (key === "score" || key.includes(":")) && Number.isFinite(value),
    );
  return (
    Number.isFinite(report.score) &&
    validNamedMap(report.tracks) &&
    validNamedMap(report.resources) &&
    validNamedMap(report.statistics) &&
    Object.values(report.metrics).every(Number.isFinite) &&
    Object.entries(report.objectives ?? {}).every(
      ([key, value]) =>
        (key === "target" || key.includes(":")) && typeof value === "boolean",
    ) &&
    validGameplaySignals(report.signals)
  );
};

export function resolveSignalBatch(
  state: Readonly<RunState>,
  inputs: readonly {
    readonly type: string;
    readonly sourceId?: string;
    readonly tags?: readonly string[];
    readonly values?: Readonly<Record<string, number>>;
    readonly actionId?: string;
  }[],
  configuration: RunConfiguration,
  score: number,
  target: number,
  trackContext?: {
    readonly raw: Readonly<Record<string, number>>;
    readonly tracks?: Readonly<Record<string, number>>;
    readonly targets: Readonly<Record<string, number>>;
    readonly limits: Readonly<Record<string, number>>;
  },
) {
  const activeRuleEffects = (state.currentEncounter?.rules ?? [])
    .filter((rule) => configuration.encounterRuleEffects?.[rule.id])
    .map((rule) => ({
      instanceId: `rule:${rule.id}`,
      definitionId: rule.id,
      storedValues: {},
      disabled: false,
    }));
  let runtime: EffectRuntimeState = {
    score,
    target,
    tracks: trackContext?.tracks ?? trackContext?.raw ?? { score },
    rawTracks: trackContext?.raw ?? { score },
    targets: trackContext?.targets ?? { score: target },
    limits: trackContext?.limits ?? {},
    currency: state.currency,
    priceModifier: state.effects.priceModifier,
    rng: state.rng,
    instances: [
      ...state.inventory.instances,
      ...state.encounterEffects,
      ...activeRuleEffects,
    ],
    encounterTags: state.effects.encounterTags,
    allowances: state.effects.allowances,
    nextInstanceId: state.nextInstanceId,
  };
  let sequence = state.effects.nextSignalSequence;
  const events: EffectRuntimeEvent[] = [],
    ledger: ScoreLedgerEntry[] = [],
    diagnostics: EffectDiagnostic[] = [];
  const emitted: GameSignal[] = [];
  for (const input of inputs) {
    const signal: GameSignal = {
      id: `${input.type}-${sequence}`,
      sequence,
      type: input.type,
      ...(input.sourceId ? { source: { definitionId: input.sourceId } } : {}),
      tags: input.tags ?? [],
      values: input.values ?? {},
      context: {
        encounterId: state.currentEncounter?.id ?? "run",
        ...(input.actionId ? { actionId: input.actionId } : {}),
        encounterNumber: state.encounterNumber,
        special: state.schedule[state.schedulePosition]?.kind === "special",
      },
    };
    const result = resolveEffects(
      runtime,
      signal,
      effectDefinitions(configuration, state.gameplayModuleId),
      configuration.effectHandlers,
    );
    runtime = result.state;
    events.push(...result.events);
    ledger.push(...result.ledgerEntries);
    diagnostics.push(...result.diagnostics);
    emitted.push(signal, ...result.emittedSignals);
    sequence = Math.max(
      sequence + 1,
      ...result.emittedSignals.map((item) => item.sequence + 1),
    );
  }
  const toContent = (
    item: (typeof runtime.instances)[number],
  ): ContentInstance => {
    const prior = [
      ...state.inventory.instances,
      ...state.encounterEffects,
    ].find((candidate) => candidate.instanceId === item.instanceId);
    return {
      instanceId: item.instanceId,
      definitionId: item.definitionId,
      storedValues: item.storedValues,
      disabled: item.disabled,
      destroyed: item.destroyed ?? false,
      ...(item.expiresAfterEncounter ? { expiresAfterEncounter: true } : {}),
      temporaryTags: item.tags ?? prior?.temporaryTags ?? [],
      attachmentIds: prior?.attachmentIds ?? [],
      ...(prior?.hostInstanceId
        ? { hostInstanceId: prior.hostInstanceId }
        : {}),
      transformationHistory: prior?.transformationHistory ?? [],
    };
  };
  const instances = runtime.instances
    .filter((item) => !item.instanceId.startsWith("rule:"))
    .map(toContent);
  const priorEncounterIds = new Set(
    state.encounterEffects.map((item) => item.instanceId),
  );
  const encounterEffects = instances.filter(
    (item) =>
      priorEncounterIds.has(item.instanceId) || item.expiresAfterEncounter,
  );
  const inventoryInstances = instances.filter(
    (item) =>
      !encounterEffects.some((effect) => effect.instanceId === item.instanceId),
  );
  return {
    runtime,
    events,
    ledger,
    emitted,
    state: {
      ...state,
      rng: runtime.rng,
      currency: runtime.currency,
      nextInstanceId: runtime.nextInstanceId,
      inventory: { ...state.inventory, instances: inventoryInstances },
      encounterEffects,
      effects: {
        ...state.effects,
        priceModifier: runtime.priceModifier,
        allowances: runtime.allowances,
        encounterTags: runtime.encounterTags,
        nextSignalSequence: sequence,
        diagnostics: [...state.effects.diagnostics, ...diagnostics].slice(-64),
      },
    } satisfies RunState,
  };
}

export function resolveScore(
  state: Readonly<RunState>,
  report: EncounterReport,
  configuration: RunConfiguration,
) {
  const rawTracks: Readonly<Record<string, number>> = Object.freeze({
    ...(report.tracks ?? {}),
    score: report.score,
  });
  const rawScore = rawTracks.score ?? 0;
  const inputs = [
    ...report.signals.map((signal) => ({
      ...signal,
      actionId: signal.sourceId ?? `report-${state.encounterNumber}`,
    })),
    {
      type: "score-calculation-started",
      sourceId: "core:gameplay-report",
      tags: report.tags,
      values: { ...report.metrics, rawScore },
      actionId: `report-${state.encounterNumber}`,
    },
    {
      type: "score",
      sourceId: "core:gameplay-report",
      tags: report.tags,
      values: report.metrics,
      actionId: `report-${state.encounterNumber}`,
    },
  ];
  const resolved = resolveSignalBatch(
    state,
    inputs,
    configuration,
    rawScore,
    state.currentEncounter!.target,
    {
      raw: rawTracks,
      targets: state.currentEncounter!.requirements.targets,
      limits: state.currentEncounter!.requirements.limits,
    },
  );
  const encounterOutcome = (
    configuration.policies ?? defaultPolicies
  ).encounterOutcome.evaluate({
    requirements: state.currentEncounter!.requirements,
    tracks: resolved.runtime.tracks ?? { score: resolved.runtime.score },
    objectives: report.objectives ?? {},
    resources: report.resources ?? {},
    tags: report.tags,
    statistics: report.statistics ?? report.metrics,
    entry: state.schedule[state.schedulePosition]!,
  });
  const outcomeType = encounterOutcome.success
    ? "encounter-won"
    : "encounter-lost";
  const completed = resolveSignalBatch(
    resolved.state,
    [
      {
        type: "score-calculation-completed",
        sourceId: "core:encounter-result",
        values: {
          rawScore,
          score: resolved.runtime.score,
          target: resolved.runtime.target,
        },
      },
      {
        type: outcomeType,
        sourceId: "core:encounter-result",
        values: {
          score: resolved.runtime.score,
          target: resolved.runtime.target,
          margin: resolved.runtime.score - resolved.runtime.target,
        },
      },
    ],
    configuration,
    resolved.runtime.score,
    resolved.runtime.target,
    {
      raw: rawTracks,
      ...(resolved.runtime.tracks ? { tracks: resolved.runtime.tracks } : {}),
      targets: state.currentEncounter!.requirements.targets,
      limits: state.currentEncounter!.requirements.limits,
    },
  );
  const trackKeys = Object.keys(rawTracks).sort();
  const bases: ScoreLedgerEntry[] = trackKeys.map((track, index) => ({
    sequence: index + 1,
    encounterId: report.encounterId,
    actionId: `report-${state.encounterNumber}`,
    source: { definitionId: "core:gameplay-report" },
    triggerId: "reported-track",
    operation: "base",
    track,
    label: track === "score" ? "Reported score" : `Reported ${track}`,
    before: 0,
    after: rawTracks[track]!,
    amount: rawTracks[track]!,
    stage: "gameplay",
  }));
  const effectLedger = [...resolved.ledger, ...completed.ledger].map(
    (entry, index) => ({ ...entry, sequence: index + bases.length + 1 }),
  );
  const finalTracks = completed.runtime.tracks ?? {
    score: completed.runtime.score,
  };
  const finals: ScoreLedgerEntry[] = Object.keys(finalTracks)
    .sort()
    .map((track, index) => ({
      sequence: bases.length + effectLedger.length + index + 1,
      encounterId: report.encounterId,
      source: { definitionId: "core:encounter-result" },
      triggerId: "final-track",
      operation: "final",
      track,
      label: track === "score" ? "Final score" : `Final ${track}`,
      before: finalTracks[track]!,
      after: finalTracks[track]!,
      stage: "post-result",
    }));
  const ledger = [...bases, ...effectLedger, ...finals];
  const lines: ScoreLine[] = ledger.map((entry) => ({
    track: entry.track,
    label: entry.label,
    operation:
      entry.operation === "multiply"
        ? "multiply"
        : entry.operation === "final"
          ? "final"
          : (entry.amount ?? 0) < 0
            ? "subtract"
            : "add",
    value:
      entry.operation === "multiply"
        ? entry.multiplier!.numerator / entry.multiplier!.denominator
        : Math.abs(entry.amount ?? entry.after),
    ...(entry.source.instanceId ? { sourceId: entry.source.instanceId } : {}),
  }));
  const events: RunEvent[] = [...resolved.events, ...completed.events].map(
    (fact) => ({ type: "effect-runtime", fact }),
  );
  return {
    score: completed.runtime.score,
    target: completed.runtime.target,
    tracks: completed.runtime.tracks ?? { score: completed.runtime.score },
    outcome: encounterOutcome,
    state: completed.state,
    events,
    lines,
    ledger,
  };
}
