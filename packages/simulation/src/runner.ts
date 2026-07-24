import {
  createInitialRunState,
  definitionFor,
  handle,
  ITEM_DEFINITIONS,
  type GameplayModule,
  type RunEvent,
  type RunState,
} from "@core-loop/core";
import { thresholdLabContentPack } from "@core-loop/content";
import {
  COMBINATION_GRID_ID,
  TIMING_METER_ID,
  combinationGridModule,
  timingMeterModule,
  type CombinationGridAction,
  type CombinationGridState,
  type TimingMeterAction,
  type TimingMeterState,
} from "../../../apps/threshold-lab/src/gameplay/modules";
import {
  SIMULATION_REPORT_VERSION,
  type ContentMetrics,
  type SimulationReport,
  type SimulationRequest,
} from "./types";

const round = (value: number) => Number(value.toFixed(4));
const combinations = <T>(items: readonly T[], count: number): T[][] => {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]) => {
    if (selected.length === count) return void result.push(selected);
    for (let index = start; index < items.length; index++)
      visit(index + 1, [...selected, items[index]!]);
  };
  visit(0, []);
  return result;
};
const gridActions = (
  state: CombinationGridState,
): readonly CombinationGridAction[] => {
  const score = (objects: CombinationGridState["objects"]) => {
    const values = objects.map((item) => item.value).sort((a, b) => a - b);
    const tags = objects.map((item) => item.tags[0]);
    return (
      objects.reduce((sum, item) => sum + item.value, 0) +
      (new Set(values).size < values.length ? 10 : 0) +
      (values.some((v) => values.includes(v + 1) && values.includes(v + 2))
        ? 15
        : 0) +
      (tags.some((tag) => tags.filter((other) => other === tag).length >= 3)
        ? 12
        : 0)
    );
  };
  const best = combinations(state.objects, state.selectionLimit).sort(
    (a, b) =>
      score(b) - score(a) ||
      a
        .map((x) => x.id)
        .join()
        .localeCompare(b.map((x) => x.id).join()),
  )[0]!;
  return [
    ...best.map((item) => ({ type: "toggle", objectId: item.id }) as const),
    { type: "submit" },
  ];
};
const timingActions = (
  seed: number,
  count: number,
): readonly TimingMeterAction[] => {
  const offsets = [0, -90, 220, 360, 80, -240, 20, -420];
  return Array.from({ length: count }, (_, index) => ({
    type: "stop" as const,
    position: Math.max(
      0,
      Math.min(1000, 500 + offsets[(seed + index) % offsets.length]!),
    ),
  }));
};

type MutableContent = {
  eligible: number;
  offered: number;
  purchased: number;
  sold: number;
  triggered: number;
  scoreContribution: number;
  currencyContribution: number;
  acquiredAt: number[];
};
export const defaultSimulationRequest: SimulationRequest = {
  contentPackId: "threshold-lab",
  gameplayModuleId: COMBINATION_GRID_ID,
  policySetId: "core:default",
  loadoutId: "threshold-lab:balanced",
  strategyId: "balanced",
  runCount: 100,
  seedStart: 1,
  maxOutliers: 5,
};

export function runSimulation(
  input: Partial<SimulationRequest> = {},
): SimulationReport {
  const request = { ...defaultSimulationRequest, ...input };
  if (request.contentPackId !== "threshold-lab")
    throw new Error(
      `Unknown content pack '${request.contentPackId}'. Available: threshold-lab`,
    );
  if (
    ![COMBINATION_GRID_ID, TIMING_METER_ID].includes(request.gameplayModuleId)
  )
    throw new Error(`Unknown gameplay module '${request.gameplayModuleId}'`);
  if (request.policySetId !== "core:default")
    throw new Error(`Unknown policy set '${request.policySetId}'`);
  if (request.strategyId !== "balanced")
    throw new Error(
      `Strategy '${request.strategyId}' is incompatible; use 'balanced'`,
    );
  if (
    !Number.isSafeInteger(request.runCount) ||
    request.runCount < 1 ||
    !Number.isSafeInteger(request.seedStart) ||
    request.seedStart < 0
  )
    throw new Error(
      "Run count must be positive and seed start must be a non-negative safe integer",
    );
  const module =
    request.gameplayModuleId === COMBINATION_GRID_ID
      ? combinationGridModule
      : timingMeterModule;
  const encounterRows = Array.from({ length: 6 }, () => ({
    scores: [] as number[],
    targets: [] as number[],
    wins: 0,
    specials: 0,
    specialFailures: 0,
  }));
  const content = new Map<string, MutableContent>(
    ITEM_DEFINITIONS.map((item) => [
      item.id,
      {
        eligible: 0,
        offered: 0,
        purchased: 0,
        sold: 0,
        triggered: 0,
        scoreContribution: 0,
        currencyContribution: 0,
        acquiredAt: [],
      },
    ]),
  );
  let completed = 0,
    failed = 0,
    aborted = 0,
    encounterTotal = 0,
    commandTotal = 0,
    earned = 0,
    spent = 0,
    purchases = 0,
    sales = 0,
    purchasePrice = 0,
    unused = 0;
  const rerolls = 0;
  const diagnostics: { seed: number; message: string }[] = [],
    outliers: { seed: number; score: number; currency: number }[] = [];
  for (let offset = 0; offset < request.runCount; offset++) {
    const seed = request.seedStart + offset;
    let state = handle(createInitialRunState(), {
      type: "start-run",
      seed,
      gameplayModuleId: module.id,
    }).state;
    let commands = 1,
      runScore = 0;
    const apply = (command: Parameters<typeof handle>[1]) => {
      const before = state;
      const result = handle(state, command);
      state = result.state;
      commands++;
      record(result.events, before);
      return result.events;
    };
    const record = (events: readonly RunEvent[], before: RunState) => {
      for (const event of events) {
        if (event.type === "currency-awarded") earned += event.amount;
        if (event.type === "item-purchased") {
          const metric = content.get(event.instance.definitionId)!;
          metric.purchased++;
          metric.acquiredAt.push(before.encounterNumber);
          purchases++;
          const offer = before.shop?.offers.find((x) => x.id === event.offerId);
          if (offer) {
            spent += offer.price;
            purchasePrice += offer.price;
          }
        }
        if (event.type === "item-sold") {
          sales++;
          content.get(
            before.inventory.modifiers
              .concat(before.inventory.consumables)
              .find((x) => x.instanceId === event.instanceId)!.definitionId,
          )!.sold++;
        }
        if (event.type === "modifier-triggered") {
          const owned = before.inventory.modifiers.find(
            (x) => x.instanceId === event.instanceId,
          );
          if (owned) content.get(owned.definitionId)!.triggered++;
        }
      }
    };
    try {
      while (
        state.phase !== "run-complete" &&
        state.phase !== "run-failed" &&
        commands < 300
      ) {
        if (state.phase === "encounter-ready") {
          const consumable = state.inventory.consumables[0];
          if (consumable)
            apply({
              type: "use-consumable",
              instanceId: consumable.instanceId,
            });
          const brief = state.currentEncounter!;
          const adapter = module as GameplayModule<object, object>;
          const created = adapter.createEncounter({
            encounterId: brief.id,
            encounterNumber: brief.number,
            target: brief.target,
            specialRuleId: brief.specialRule,
            rng: state.rng,
          });
          let moduleState: object = created.state;
          const actions =
            module.id === COMBINATION_GRID_ID
              ? gridActions(moduleState as CombinationGridState)
              : timingActions(
                  seed + brief.number,
                  (moduleState as TimingMeterState).attemptCount,
                );
          apply({ type: "start-encounter" });
          for (const action of actions) {
            const result = adapter.handleAction(moduleState, action, {
              encounterId: brief.id,
              encounterNumber: brief.number,
            });
            if (!result.accepted)
              throw new Error(result.reason ?? "strategy action rejected");
            moduleState = result.state;
            commands++;
          }
          apply({
            type: "store-gameplay-session",
            session: {
              moduleId: module.id,
              moduleVersion: module.version,
              encounterId: brief.id,
              data: moduleState as never,
            },
          });
          const report = adapter.createReport(moduleState, {
            encounterId: brief.id,
            encounterNumber: brief.number,
          });
          const events = apply({ type: "submit-encounter", report });
          const row = encounterRows[brief.number - 1]!;
          const final = state.lastReport!.score;
          row.scores.push(final);
          row.targets.push(brief.target);
          runScore += final;
          row.specials += Number(brief.specialRule !== null);
          const won = events.some((event) => event.type === "encounter-won");
          row.wins += Number(won);
          row.specialFailures += Number(!won && brief.specialRule !== null);
          for (const entry of state.scoreLedger)
            if (
              entry.source.definitionId &&
              content.has(entry.source.definitionId)
            )
              content.get(entry.source.definitionId)!.scoreContribution +=
                entry.after - entry.before;
        } else if (state.phase === "reward") apply({ type: "enter-shop" });
        else if (state.phase === "shop") {
          for (const metric of content.values()) metric.eligible++;
          for (const offer of state.shop!.offers)
            content.get(offer.definitionId)!.offered++;
          const offer = [...state.shop!.offers]
            .filter((item) => item.price <= state.currency)
            .sort(
              (a, b) =>
                a.price - b.price ||
                a.definitionId.localeCompare(b.definitionId),
            )[0];
          if (offer) apply({ type: "buy-offer", offerId: offer.id });
          apply({ type: "leave-shop" });
        } else throw new Error(`Unsupported phase ${state.phase}`);
      }
      if (commands >= 300) {
        aborted++;
        diagnostics.push({ seed, message: "Command safety limit reached" });
      } else if (state.phase === "run-complete") completed++;
      else failed++;
    } catch (error) {
      aborted++;
      diagnostics.push({ seed, message: (error as Error).message });
    }
    encounterTotal += state.encounterNumber;
    commandTotal += commands;
    unused += state.currency;
    outliers.push({ seed, score: runScore, currency: state.currency });
  }
  const encounters = encounterRows.map((row, index) => {
    const sorted = [...row.scores].sort((a, b) => a - b);
    const total = row.scores.reduce((a, b) => a + b, 0);
    const targets = row.targets.reduce((a, b) => a + b, 0);
    const over = row.scores
      .filter((s, i) => s >= row.targets[i]!)
      .reduce((a, s, i) => a + Math.max(0, s - row.targets[i]!), 0);
    const failures = row.scores
      .map((s, i) => Math.max(0, row.targets[i]! - s))
      .filter(Boolean);
    return {
      encounter: index + 1,
      attempts: row.scores.length,
      wins: row.wins,
      winRate: round(row.wins / (row.scores.length || 1)),
      averageScore: round(total / (row.scores.length || 1)),
      medianScore: sorted.length
        ? sorted[Math.floor((sorted.length - 1) / 2)]!
        : 0,
      minimumScore: sorted[0] ?? 0,
      maximumScore: sorted.at(-1) ?? 0,
      averageTarget: round(targets / (row.targets.length || 1)),
      scoreToTargetRatio: round(total / (targets || 1)),
      averageOverkill: round(over / (row.wins || 1)),
      averageFailureMargin: round(
        failures.reduce((a, b) => a + b, 0) / (failures.length || 1),
      ),
      specialFrequency: round(row.specials / (row.scores.length || 1)),
      specialFailureRate: round(row.specialFailures / (row.specials || 1)),
    };
  });
  const contentMetrics: ContentMetrics[] = [...content]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([definitionId, m]) => ({
      definitionId,
      eligible: m.eligible,
      offered: m.offered,
      purchased: m.purchased,
      sold: m.sold,
      triggered: m.triggered,
      scoreContribution: m.scoreContribution,
      currencyContribution: m.currencyContribution,
      averageEncounterAcquired: m.acquiredAt.length
        ? round(m.acquiredAt.reduce((a, b) => a + b, 0) / m.acquiredAt.length)
        : null,
    }));
  const reachability = contentMetrics
    .flatMap((m) =>
      m.eligible === 0
        ? [{ type: "never-eligible", id: m.definitionId }]
        : m.offered === 0
          ? [{ type: "eligible-never-offered", id: m.definitionId }]
          : m.purchased === 0
            ? [{ type: "offered-never-purchased", id: m.definitionId }]
            : m.triggered === 0 &&
                definitionFor(m.definitionId)?.category === "modifier"
              ? [{ type: "purchased-never-triggered", id: m.definitionId }]
              : [],
    )
    .sort((a, b) => a.id.localeCompare(b.id) || a.type.localeCompare(b.type));
  return {
    reportFormatVersion: SIMULATION_REPORT_VERSION,
    frameworkVersion: "0.1.0",
    content: {
      id: thresholdLabContentPack.id,
      version: thresholdLabContentPack.version,
    },
    module: { id: module.id, version: module.version },
    policySet: { id: "core:default", version: 1 },
    request,
    outcomes: {
      total: request.runCount,
      completed,
      failed,
      aborted,
      completionRate: round(completed / request.runCount),
      averageEncounterReached: round(encounterTotal / request.runCount),
      averageCommands: round(commandTotal / request.runCount),
      unusedCurrencyAverage: round(unused / request.runCount),
    },
    encounters,
    economy: {
      currencyEarned: earned,
      currencySpent: spent,
      purchases,
      rerolls,
      sales,
      averagePurchasePrice: round(purchasePrice / (purchases || 1)),
    },
    contentMetrics,
    reachability,
    outliers: outliers
      .sort((a, b) => b.score - a.score || a.seed - b.seed)
      .slice(0, request.maxOutliers),
    diagnostics,
  };
}
