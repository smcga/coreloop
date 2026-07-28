import {
  createHeadlessRunSession,
  type RunEvent,
  type RunState,
} from "@core-loop/core";
import {
  SIMULATION_REPORT_VERSION,
  type ContentMetrics,
  type EconomyStrategy,
  type SimulationComposition,
  type SimulationReport,
  type SimulationRequest,
  type SimulationStrategy,
} from "./types";

const round = (n: number) => Number(n.toFixed(4));
const named = <T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
  label: string,
): T => {
  const item = items.find((entry) => entry.id === id);
  if (!item)
    throw new Error(
      `Unknown ${label} '${id}'. Available: ${
        items
          .map((entry) => entry.id)
          .sort()
          .join(", ") || "none"
      }`,
    );
  return item;
};
const validateId = (id: string, label: string) => {
  if (!id.includes(":"))
    throw new Error(`${label} ID '${id}' must be namespaced`);
};

export class SimulationRegistry {
  private readonly entries = new Map<string, SimulationComposition>();
  register(composition: SimulationComposition): this {
    validateId(composition.id, "Composition");
    if (this.entries.has(composition.id))
      throw new Error(`Duplicate simulation composition '${composition.id}'`);
    for (const item of [
      ...composition.policySets,
      ...composition.strategies,
      ...composition.economyStrategies,
    ])
      validateId(item.id, "Registered");
    this.entries.set(composition.id, composition);
    return this;
  }
  get(id: string): SimulationComposition {
    return named(this.list(), id, "composition");
  }
  list(): readonly SimulationComposition[] {
    return [...this.entries.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

export const bindModuleDefaultStrategy = (
  composition: Pick<SimulationComposition, "modules">,
  moduleId: string,
  id = `${moduleId}:default-bot`,
): SimulationStrategy => ({
  id,
  compatibleModuleIds: [moduleId],
  nextAction({ state }) {
    const bot = composition.modules.get(moduleId).createBotStrategy?.();
    if (!bot)
      throw new Error(
        `Module '${moduleId}' does not provide a default bot strategy`,
      );
    return bot.nextAction(state as Readonly<unknown>);
  },
});
export const cheapestAffordableEconomyStrategy: EconomyStrategy = {
  id: "core:cheapest-affordable",
  nextCommand({ state, definitionFor }) {
    if (state.phase === "reward") return { type: "enter-shop" };
    if (state.phase !== "shop")
      throw new Error(`Economy strategy cannot handle phase '${state.phase}'`);
    const offer = [...(state.shop?.offers ?? [])]
      .filter((x) => {
        if (x.price > state.currency || x.acquisition.type === "attachment")
          return false;
        if (x.acquisition.type === "run-upgrade")
          return !state.inventory.upgradeIds.includes(x.definitionId);
        const count = state.inventory.instances.filter(
          (item) => definitionFor(item.definitionId)?.category === x.category,
        ).length;
        return (
          !definitionFor(x.definitionId)?.occupiesCapacity ||
          count < (state.inventory.capacities[x.category] ?? 0)
        );
      })
      .sort(
        (a, b) =>
          a.price - b.price || a.definitionId.localeCompare(b.definitionId),
      )[0];
    if (offer && definitionFor(offer.definitionId))
      return { type: "buy-offer", offerId: offer.id };
    return { type: "leave-shop" };
  },
};

type Row = {
  position: number;
  encounterId: string;
  kind: string;
  ruleIds: string[];
  wins: number;
  losses: number;
  tracks: Map<string, number[]>;
  targets: Map<string, number[]>;
};
type MutableContent = {
  eligible: number;
  offered: number;
  acquired: number;
  purchased: number;
  sold: number;
  used: number;
  triggered: number;
  contributions: Map<string, number>;
  currency: number;
  acquiredAt: number[];
};

export function runSimulation(
  registry: SimulationRegistry,
  input: Partial<SimulationRequest> & { compositionId: string },
): SimulationReport {
  const composition = registry.get(input.compositionId);
  const request: SimulationRequest = {
    contentPackId: composition.content.id,
    gameplayModuleId: composition.defaults.gameplayModuleId,
    policySetId: composition.defaults.policySetId,
    loadoutId: composition.defaults.loadoutId,
    strategyId: composition.defaults.strategyId,
    economyStrategyId: composition.defaults.economyStrategyId,
    runCount: 100,
    seedStart: 1,
    maxOutliers: 5,
    maxCommands: 300,
    ...input,
  };
  if (request.contentPackId !== composition.content.id)
    throw new Error(
      `Unknown content pack '${request.contentPackId}'. Available: ${composition.content.id}`,
    );
  const module = composition.modules.get(request.gameplayModuleId);
  const policy = named(
    composition.policySets,
    request.policySetId,
    "policy set",
  );
  const strategy = named(
    composition.strategies,
    request.strategyId,
    "strategy",
  );
  const economyStrategy = named(
    composition.economyStrategies,
    request.economyStrategyId,
    "economy strategy",
  );
  if (
    strategy.compatibleModuleIds &&
    !strategy.compatibleModuleIds.includes(module.id)
  )
    throw new Error(
      `Strategy '${strategy.id}' is incompatible with module '${module.id}'`,
    );
  if (
    strategy.requiredCapabilities?.some(
      (capability) => !module.capabilities.includes(capability),
    )
  )
    throw new Error(
      `Strategy '${strategy.id}' requires unsupported capabilities`,
    );
  for (const [label, value, min] of [
    ["run count", request.runCount, 1],
    ["seed start", request.seedStart, 0],
    ["max commands", request.maxCommands, 1],
    ["max outliers", request.maxOutliers, 0],
  ] as const)
    if (!Number.isSafeInteger(value) || value < min)
      throw new Error(`${label} must be a safe integer of at least ${min}`);
  const session = createHeadlessRunSession({
    configuration: composition.configuration,
    modules: composition.modules,
    ...(composition.operations ? { operations: composition.operations } : {}),
  });
  const definitions =
    composition.configuration.content?.listDefinitions({
      gameplayModuleId: module.id,
    }) ?? [];
  if (!definitions.length)
    throw new Error(`Content pool for module '${module.id}' is empty`);
  const metrics = new Map<string, MutableContent>(
    definitions.map((x) => [
      x.id,
      {
        eligible: 0,
        offered: 0,
        acquired: 0,
        purchased: 0,
        sold: 0,
        used: 0,
        triggered: 0,
        contributions: new Map(),
        currency: 0,
        acquiredAt: [],
      },
    ]),
  );
  const rows = new Map<string, Row>();
  const phaseFrequency: Record<string, number> = {};
  let completed = 0,
    failed = 0,
    aborted = 0,
    encountersReached = 0,
    commandsTotal = 0,
    earned = 0,
    spent = 0,
    purchases = 0,
    sales = 0,
    purchasePrice = 0,
    unused = 0;
  const rerolls = 0;
  const diagnostics: { seed: number; code: string; message: string }[] = [];
  const outliers: { seed: number; score: number; currency: number }[] = [];
  for (let offset = 0; offset < request.runCount; offset++) {
    const seed = request.seedStart + offset;
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed,
      gameplayModuleId: module.id,
      loadoutId: request.loadoutId,
    }).state;
    let commands = 1,
      runScore = 0;
    const record = (events: readonly RunEvent[], before: RunState) => {
      for (const event of events) {
        if (event.type === "currency-awarded") earned += event.amount;
        if (event.type === "item-purchased") {
          purchases++;
          const m = metrics.get(event.instance.definitionId);
          if (m) {
            m.purchased++;
            m.acquired++;
            m.acquiredAt.push(before.encounterNumber);
          }
          const offer = before.shop?.offers.find((x) => x.id === event.offerId);
          if (offer) {
            spent += offer.price;
            purchasePrice += offer.price;
          }
        }
        if (event.type === "item-sold") {
          sales++;
          const item = before.inventory.instances.find(
            (x) => x.instanceId === event.instanceId,
          );
          if (item) metrics.get(item.definitionId)!.sold++;
        }
        if (event.type === "consumable-used") {
          const item = before.inventory.instances.find(
            (x) => x.instanceId === event.instanceId,
          );
          if (item) metrics.get(item.definitionId)!.used++;
        }
        if (event.type === "modifier-triggered") {
          const item = before.inventory.instances.find(
            (x) => x.instanceId === event.instanceId,
          );
          if (item) metrics.get(item.definitionId)!.triggered++;
        }
      }
    };
    const command = (value: Parameters<typeof session.handleCommand>[1]) => {
      const before = state;
      const result = session.handleCommand(state, value);
      state = result.state;
      commands++;
      record(result.events, before);
      const rejection = result.events.find(
        (x) => x.type === "command-rejected",
      );
      if (rejection && rejection.type === "command-rejected")
        throw new Error(rejection.reason);
    };
    try {
      while (
        !["run-complete", "run-failed", "abandoned"].includes(state.phase) &&
        commands < request.maxCommands
      ) {
        phaseFrequency[state.phase] = (phaseFrequency[state.phase] ?? 0) + 1;
        if (state.phase === "encounter-ready") {
          const brief = state.currentEncounter!;
          command({ type: "start-encounter" });
          while (
            state.phase === "encounter-active" &&
            commands < request.maxCommands
          ) {
            const data = module.validateState(state.gameplaySession!.data);
            const result = session.handleGameplayAction(
              state,
              strategy.nextAction({
                state: data,
                run: state,
                moduleId: module.id,
              }),
            );
            if (!result.accepted)
              throw new Error(
                result.events.find((x) => x.type === "command-rejected")
                  ?.reason ?? "Strategy action rejected",
              );
            const before = state;
            state = result.state;
            commands++;
            record(result.events, before);
          }
          if (!state.lastReport)
            throw new Error("Coordinator did not produce an encounter report");
          const key = `${brief.number}:${brief.id}`;
          const row = rows.get(key) ?? {
            position: brief.number,
            encounterId: brief.id,
            kind: state.schedule[brief.number - 1]?.kind ?? "ordinary",
            ruleIds: brief.rules.map((x) => x.id).sort(),
            wins: 0,
            losses: 0,
            tracks: new Map(),
            targets: new Map(),
          };
          const won = state.lastOutcome?.success ?? false;
          row.wins += Number(won);
          row.losses += Number(!won);
          const tracks = {
            score: state.lastReport.score,
            ...state.lastReport.tracks,
          };
          for (const [id, value] of Object.entries(tracks)) {
            const values = row.tracks.get(id) ?? [];
            values.push(value);
            row.tracks.set(id, values);
          }
          const targets = row.targets.get("score") ?? [];
          targets.push(brief.target);
          row.targets.set("score", targets);
          rows.set(key, row);
          runScore += state.lastReport.score;
          for (const entry of state.scoreLedger)
            if (
              entry.source.definitionId &&
              metrics.has(entry.source.definitionId)
            ) {
              const m = metrics.get(entry.source.definitionId)!;
              m.contributions.set(
                entry.track,
                (m.contributions.get(entry.track) ?? 0) +
                  entry.after -
                  entry.before,
              );
            }
        } else if (state.phase === "reward" || state.phase === "shop") {
          if (state.phase === "reward" && state.pendingReward) {
            if (state.pendingReward.type === "container") {
              command({ type: "open-reward-container" });
              continue;
            }
            if (state.pendingReward.type === "choice") {
              const option = state.pendingReward.options.find((candidate) => {
                const definition = session.definitionFor(
                  candidate.definitionId,
                );
                if (!definition) return false;
                if (candidate.acquisition.type === "run-upgrade")
                  return !state.inventory.upgradeIds.includes(definition.id);
                if (
                  candidate.acquisition.type !== "instance" ||
                  !definition.occupiesCapacity
                )
                  return true;
                const count = state.inventory.instances.filter((item) => {
                  const owned = session.definitionFor(item.definitionId);
                  return (
                    owned?.category === definition.category &&
                    owned.occupiesCapacity
                  );
                }).length;
                return (
                  count < (state.inventory.capacities[definition.category] ?? 0)
                );
              });
              if (!option)
                throw new Error("No eligible generated reward option");
              command({
                type: "choose-reward",
                optionId: option.id,
              });
              continue;
            }
            command({
              type: "choose-reward-target",
              optionId: state.pendingReward.option.id,
              targetInstanceId: state.inventory.instances.find((item) => {
                if (item.hostInstanceId) return false;
                const operation =
                  state.pendingReward?.type === "target"
                    ? state.pendingReward.option.acquisition
                    : undefined;
                const definition = session.definitionFor(item.definitionId);
                if (operation?.type !== "attachment" || !definition)
                  return false;
                if (!operation.hostCategories.includes(definition.category))
                  return false;
                if (
                  operation.requiredHostTags?.some(
                    (tag) => !definition.tags.includes(tag),
                  )
                )
                  return false;
                return !(
                  operation.slot &&
                  item.attachmentIds.some(
                    (id) =>
                      session.definitionFor(
                        state.inventory.instances.find(
                          (child) => child.instanceId === id,
                        )?.definitionId ?? "",
                      )?.attachmentSlot === operation.slot,
                  )
                );
              })!.instanceId,
            });
            continue;
          }
          if (state.phase === "reward") {
            command({ type: "continue" });
            continue;
          }
          if (state.phase === "shop") {
            for (const m of metrics.values()) m.eligible++;
            for (const offer of state.shop?.offers ?? [])
              metrics.get(offer.definitionId)!.offered++;
          }
          command(
            economyStrategy.nextCommand({
              state,
              definitionFor: (id) => session.definitionFor(id),
            }),
          );
        } else throw new Error(`Unsupported phase '${state.phase}'`);
      }
      if (commands >= request.maxCommands) {
        aborted++;
        diagnostics.push({
          seed,
          code: "command-limit",
          message: `Command safety limit ${request.maxCommands} reached`,
        });
      } else if (state.phase === "run-complete") completed++;
      else failed++;
    } catch (error) {
      aborted++;
      diagnostics.push({
        seed,
        code: "simulation-error",
        message: (error as Error).message,
      });
    }
    encountersReached += state.encounterNumber;
    commandsTotal += commands;
    unused += state.currency;
    outliers.push({ seed, score: runScore, currency: state.currency });
  }
  const encounters = [...rows.values()]
    .sort(
      (a, b) =>
        a.position - b.position || a.encounterId.localeCompare(b.encounterId),
    )
    .map((row) => ({
      position: row.position,
      encounterId: row.encounterId,
      kind: row.kind,
      ruleIds: row.ruleIds,
      attempts: [...row.tracks.values()][0]?.length ?? 0,
      wins: row.wins,
      losses: row.losses,
      winRate: round(row.wins / Math.max(1, row.wins + row.losses)),
      tracks: [...row.tracks]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, values]) => {
          const sorted = [...values].sort((a, b) => a - b),
            targets = row.targets.get(id);
          return {
            id,
            average: round(values.reduce((a, b) => a + b, 0) / values.length),
            median: sorted[Math.floor((sorted.length - 1) / 2)]!,
            minimum: sorted[0]!,
            maximum: sorted.at(-1)!,
            averageTarget: targets
              ? round(targets.reduce((a, b) => a + b, 0) / targets.length)
              : null,
          };
        }),
    }));
  const contentMetrics: ContentMetrics[] = [...metrics]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([definitionId, m]) => ({
      definitionId,
      eligible: m.eligible,
      offered: m.offered,
      acquired: m.acquired,
      purchased: m.purchased,
      sold: m.sold,
      used: m.used,
      triggered: m.triggered,
      scoreContribution: Object.fromEntries(
        [...m.contributions].sort(([a], [b]) => a.localeCompare(b)),
      ),
      currencyContribution: m.currency,
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
                session.definitionFor(m.definitionId)?.category === "modifier"
              ? [{ type: "purchased-never-triggered", id: m.definitionId }]
              : [],
    )
    .sort((a, b) => a.id.localeCompare(b.id) || a.type.localeCompare(b.type));
  return {
    reportFormatVersion: SIMULATION_REPORT_VERSION,
    frameworkVersion: "0.1.0",
    composition: { id: composition.id, version: composition.version },
    provider: composition.provider,
    content: composition.content,
    module: { id: module.id, version: module.version },
    policySet: policy,
    strategy: { id: strategy.id },
    economyStrategy: { id: economyStrategy.id },
    request,
    outcomes: {
      total: request.runCount,
      completed,
      failed,
      aborted,
      completionRate: round(completed / request.runCount),
      averageEncounterReached: round(encountersReached / request.runCount),
      averageCommands: round(commandsTotal / request.runCount),
      unusedCurrencyAverage: round(unused / request.runCount),
    },
    encounters,
    economy: {
      currencyEarned: earned,
      currencySpent: spent,
      purchases,
      rerolls,
      sales,
      phaseFrequency: Object.fromEntries(
        Object.entries(phaseFrequency).sort(([a], [b]) => a.localeCompare(b)),
      ),
      averagePurchasePrice: round(purchasePrice / Math.max(1, purchases)),
    },
    contentMetrics,
    reachability,
    outliers: outliers
      .sort((a, b) => b.score - a.score || a.seed - b.seed)
      .slice(0, request.maxOutliers),
    diagnostics,
  };
}
