import { inventoryCategoryCount } from "../economy/inventory";
import {
  resolveScore,
  resolveSignalBatch,
  validEncounterReport,
  validGameplaySignals,
} from "../effects/transaction";
import { prepareEncounter } from "../encounters/preparation";
import { createRandom, randomInteger } from "../random";
import type {
  RuntimeContentDefinition,
  RuntimeContentProvider,
  RuntimeStartingLoadout,
  ShopCandidate,
  ShopContext,
} from "../content";
import { FrameworkError } from "../errors";
import {
  defaultPolicies,
  policyReferences,
  adaptFlatScheduleToStage,
  type EncounterReward,
  type EncounterScheduleEntry,
  type StageContext,
} from "../policies";
import type {
  ContentInstance,
  EncounterReport,
  Inventory,
  RewardOption,
  RunCommand,
  RunConfiguration,
  RunEvent,
  RunState,
  ShopOffer,
  TransitionResult,
} from "./contracts";

export const CONTENT_VERSION = 3;
const EMPTY_PROVIDER: RuntimeContentProvider = {
  identity: { packId: "core:empty", packVersion: 1 },
  getDefinition: (id) => {
    throw new Error(`Unknown definition '${id}'`);
  },
  getStartingLoadout: (id) => ({
    id,
    currency: 10,
    ownedDefinitionIds: [],
    capacities: {},
    upgradeIds: [],
  }),
  listDefinitions: () => [],
};
export const EMPTY_CONFIGURATION: RunConfiguration = {
  content: EMPTY_PROVIDER,
  defaultLoadoutId: "core:empty-loadout",
};
const stageContext = (
  state: Pick<RunState, "stages" | "progress">,
): StageContext | undefined => {
  const stage = state.stages[state.progress.stagePosition];
  return stage ? { stage, ...state.progress } : undefined;
};
const findDefinition = (configuration: RunConfiguration, id: string) => {
  try {
    return configuration.content?.getDefinition(id);
  } catch {
    return undefined;
  }
};
export function definitionFor(
  id: string,
  configuration: RunConfiguration = EMPTY_CONFIGURATION,
): RuntimeContentDefinition | undefined {
  return findDefinition(configuration, id);
}
const createInstance = (
  definition: RuntimeContentDefinition,
  number: number,
): ContentInstance => ({
  instanceId: `item-${number}`,
  definitionId: definition.id,
  storedValues: definition.initialStoredValues ?? {},
  disabled: false,
  destroyed: false,
  temporaryTags: [],
  attachmentIds: [],
  transformationHistory: [],
});
const rerollPrice = (
  state: Readonly<RunState>,
  configuration: RunConfiguration,
  count: number,
  entry: EncounterScheduleEntry,
) => {
  const base = (
    configuration.policies ?? defaultPolicies
  ).shopPricing.rerollPrice({ rerollCount: count, entry });
  const adjustment = state.inventory.upgradeIds.reduce(
    (sum, id) =>
      sum +
      (findDefinition(configuration, id)?.upgradeChanges?.rerollPrice ?? 0),
    0,
  );
  return Math.max(0, Math.round(base + adjustment));
};
const initialInventory = (
  configuration: RunConfiguration,
  loadout?: RuntimeStartingLoadout,
): Inventory => {
  const instances = (loadout?.ownedDefinitionIds ?? []).map((id, index) => {
    const definition = findDefinition(configuration, id);
    if (!definition)
      throw new FrameworkError(
        "missing-definition",
        `Loadout references unavailable definition '${id}'`,
        { definitionId: id },
      );
    return createInstance(definition, index + 1);
  });
  const capacities = Object.fromEntries(
    Object.entries(loadout?.capacities ?? {}).map(([category, limit]) => [
      category,
      (configuration.policies ?? defaultPolicies).inventory.limitFor(
        category,
        limit,
      ),
    ]),
  );
  return {
    instances,
    capacities,
    upgradeIds: loadout?.upgradeIds ?? [],
  };
};
export function createInitialRunState(
  configuration: RunConfiguration = EMPTY_CONFIGURATION,
): RunState {
  const inventory = initialInventory(configuration);
  return {
    phase: "idle",
    seed: null,
    rng: createRandom(0),
    encounterNumber: 0,
    schedule: [],
    schedulePosition: -1,
    stages: [],
    progress: { stagePosition: -1, encounterPositionInStage: -1 },
    policyReferences: policyReferences(
      configuration.policies ?? defaultPolicies,
    ),
    currentEncounter: null,
    currency: 0,
    inventory,
    shop: null,
    pendingAcquisition: null,
    pendingReward: null,
    pendingRoute: null,
    shopCount: 0,
    rewardHistory: [],
    nextRewardOptionId: 1,
    nextInstanceId: 1,
    nextOfferId: 1,
    lastReport: null,
    lastOutcome: null,
    scoreBreakdown: [],
    scoreLedger: [],
    gameplayModuleId: "core:unselected",
    loadoutId: null,
    gameplaySession: null,
    encounterEffects: [],
    effects: {
      priceModifier: 0,
      allowances: {},
      encounterTags: [],
      runTags: [],
      nextSignalSequence: 1,
      nextEventSequence: 1,
      diagnostics: [],
    },
  };
}
function shopContext(
  state: Readonly<RunState>,
  configuration: RunConfiguration,
): ShopContext {
  const definitions = state.inventory.instances.map((item) =>
    findDefinition(configuration, item.definitionId),
  );
  const copyCounts: Record<string, number> = {};
  for (const item of state.inventory.instances)
    copyCounts[item.definitionId] = (copyCounts[item.definitionId] ?? 0) + 1;
  return Object.freeze({
    encounterNumber: state.encounterNumber,
    schedulePosition: state.schedulePosition,
    previousEncounterSpecial:
      state.schedule[state.schedulePosition]?.kind === "special",
    gameplayModuleId: state.gameplayModuleId,
    capabilities:
      configuration.gameplayCapabilities?.[state.gameplayModuleId] ?? [],
    currency: state.currency,
    ownedDefinitionIds: state.inventory.instances.map(
      (item) => item.definitionId,
    ),
    ownedCategories: definitions.flatMap((item) =>
      item ? [item.category] : [],
    ),
    ownedTags: definitions.flatMap((item) => item?.tags ?? []),
    copyCounts,
    activeRunUpgrades: state.inventory.upgradeIds,
    shopNumber: state.schedulePosition + 1,
    rerollNumber: state.shop?.rerollCount ?? 0,
    runTags: [],
    poolIds:
      configuration.shopProviders?.flatMap((provider) => provider.poolIds) ??
      [],
  });
}
function eligibleCandidates(
  state: Readonly<RunState>,
  configuration: RunConfiguration,
) {
  const context = shopContext(state, configuration),
    rejected: RunEvent[] = [],
    candidates: ShopCandidate[] = [];
  for (const provider of configuration.shopProviders ?? []) {
    for (const candidate of provider.getCandidates(context)) {
      let reason: string | undefined;
      if (
        candidate.providerId !== provider.id ||
        candidate.providerVersion !== provider.version
      )
        reason = "provider identity mismatch";
      else if (
        !(candidate.weight > 0) ||
        !Number.isSafeInteger(candidate.weight)
      )
        reason = "weight must be a positive integer";
      else if (
        (context.copyCounts[candidate.definitionId] ?? 0) >=
        (candidate.maximumCopies ?? Number.POSITIVE_INFINITY)
      )
        reason = "maximum copies owned";
      else if (!findDefinition(configuration, candidate.definitionId))
        reason = "definition unavailable";
      if (reason)
        rejected.push({
          type: "shop-candidate-rejected",
          providerId: provider.id,
          candidateId: candidate.id,
          reason,
        });
      else candidates.push(candidate);
    }
  }
  return { candidates, rejected };
}
function generateShop(
  run: Readonly<RunState>,
  nextOfferId: number,
  configuration: RunConfiguration,
  entry: EncounterScheduleEntry,
) {
  const policies = configuration.policies ?? defaultPolicies;
  let rng = run.rng,
    id = nextOfferId;
  const offers: ShopOffer[] = [];
  const eligible = eligibleCandidates(run, configuration);
  const remaining = [...eligible.candidates];
  const maximum = Math.min(
    policies.shopGeneration.offerCount({ entry, stage: stageContext(run) }),
    remaining.length,
  );
  // Exactly one RNG value is consumed per selected offer. Removing the selected
  // candidate makes uniqueness stable and avoids retry loops.
  while (offers.length < maximum) {
    const total = remaining.reduce((sum, item) => sum + item.weight, 0);
    const roll = randomInteger(rng, 1, total);
    rng = roll.state;
    let cursor = roll.value,
      index = 0;
    for (; index < remaining.length; index++) {
      cursor -= remaining[index]!.weight;
      if (cursor <= 0) break;
    }
    const choice = remaining.splice(index, 1)[0]!;
    offers.push({
      id: `offer-${id++}`,
      definitionId: choice.definitionId,
      category: choice.category,
      price: policies.shopPricing.offerPrice({
        basePrice: choice.basePrice,
        category: choice.category,
        entry,
        ...(choice.rarity ? { rarity: choice.rarity } : {}),
        ...(choice.rarity &&
        configuration.rarityPriceMultipliers?.[choice.rarity] !== undefined
          ? {
              rarityMultiplier:
                configuration.rarityPriceMultipliers[choice.rarity],
            }
          : {}),
        providerId: choice.providerId,
        poolId: choice.poolId,
        rerollCount: run.shop?.rerollCount ?? 0,
        upgradeIds: run.inventory.upgradeIds,
      }),
      providerId: choice.providerId,
      providerVersion: choice.providerVersion,
      poolId: choice.poolId,
      acquisition: choice.acquisition,
    });
  }
  return { rng, offers, nextOfferId: id, events: eligible.rejected };
}
function rewardCandidates(
  run: Readonly<RunState>,
  configuration: RunConfiguration,
  poolId: string,
  targeted: boolean,
) {
  const context = shopContext(run, configuration);
  return (configuration.shopProviders ?? []).flatMap((provider) =>
    provider
      .getCandidates(context)
      .filter(
        (candidate) =>
          candidate.providerId === provider.id &&
          candidate.providerVersion === provider.version &&
          candidate.poolId === poolId &&
          Number.isSafeInteger(candidate.weight) &&
          candidate.weight > 0 &&
          (!targeted || candidate.acquisition.type === "attachment") &&
          (context.copyCounts[candidate.definitionId] ?? 0) <
            (candidate.maximumCopies ?? Number.POSITIVE_INFINITY) &&
          !!findDefinition(configuration, candidate.definitionId),
      ),
  );
}

function generateRewardOptions(
  run: Readonly<RunState>,
  configuration: RunConfiguration,
  poolId: string,
  count: number,
  targeted: boolean,
) {
  let rng = run.rng;
  let nextId = run.nextRewardOptionId;
  const remaining = rewardCandidates(run, configuration, poolId, targeted);
  const options: RewardOption[] = [];
  // Eligibility is filtered before selection; exactly one RNG value is consumed
  // for each generated option. Empty pools consume none.
  while (options.length < Math.min(count, remaining.length)) {
    const total = remaining.reduce(
      (sum, candidate) => sum + candidate.weight,
      0,
    );
    const roll = randomInteger(rng, 1, total);
    rng = roll.state;
    let cursor = roll.value;
    let index = 0;
    for (; index < remaining.length; index++) {
      cursor -= remaining[index]!.weight;
      if (cursor <= 0) break;
    }
    const candidate = remaining.splice(index, 1)[0]!;
    options.push({
      id: `reward-option-${nextId++}`,
      definitionId: candidate.definitionId,
      acquisition: candidate.acquisition,
    });
  }
  return { rng, nextId, options };
}

const flattenRewards = (reward: EncounterReward): readonly EncounterReward[] =>
  reward.type === "sequence"
    ? reward.rewards.flatMap(flattenRewards)
    : [reward];

function beginRewards(
  state: Readonly<RunState>,
  rewards: readonly EncounterReward[],
  completesRun: boolean,
): TransitionResult {
  let currency = state.currency;
  const events: RunEvent[] = [];
  let index = 0;
  while (index < rewards.length && rewards[index]!.type === "currency") {
    const reward = rewards[index++]! as Extract<
      EncounterReward,
      { type: "currency" }
    >;
    currency += reward.amount;
    events.push({
      type: "currency-awarded",
      amount: reward.amount,
      total: currency,
    });
  }
  const next = rewards[index];
  if (next?.type === "container") {
    return {
      state: {
        ...state,
        currency,
        phase: "reward",
        pendingReward: {
          type: "container",
          definitionId: next.definitionId,
          remaining: rewards.slice(index + 1),
          completesRun,
        },
      },
      events,
    };
  }
  return {
    state: {
      ...state,
      currency,
      phase: completesRun ? "run-complete" : "reward",
      pendingReward: null,
    },
    events: [
      ...events,
      ...(completesRun && state.stages[state.progress.stagePosition]
        ? [
            {
              type: "stage-completed" as const,
              stageId: state.stages[state.progress.stagePosition]!.id,
              ordinal: state.stages[state.progress.stagePosition]!.ordinal,
            },
          ]
        : []),
      ...(completesRun ? [{ type: "run-completed" as const, currency }] : []),
    ],
  };
}
function reject(
  state: Readonly<RunState>,
  command: RunCommand,
  reason: string,
): TransitionResult {
  return {
    state,
    events: [
      {
        type: "command-rejected",
        command: command.type,
        phase: state.phase,
        reason,
      },
    ],
  };
}
// Effect-runtime adaptation and score coordination live in effects/transaction.

export function handleCommand(
  state: Readonly<RunState>,
  command: RunCommand,
  configuration: RunConfiguration = EMPTY_CONFIGURATION,
): TransitionResult {
  const policies = configuration.policies ?? defaultPolicies;
  switch (command.type) {
    case "start-run": {
      if (!Number.isSafeInteger(command.seed))
        return reject(state, command, "Seed must be a safe integer");
      const moduleId = command.gameplayModuleId ?? "core:unselected";
      if (!moduleId.includes(":"))
        return reject(state, command, "Gameplay module ID must be namespaced");
      let loadout: RuntimeStartingLoadout | undefined;
      try {
        const provider = configuration.content ?? EMPTY_PROVIDER;
        const loadoutId =
          command.loadoutId ??
          configuration.defaultLoadoutId ??
          "core:empty-loadout";
        if (!loadoutId)
          return reject(state, command, "A known starting loadout is required");
        loadout = provider.getStartingLoadout(loadoutId);
      } catch {
        return reject(
          state,
          command,
          "Starting loadout is unknown or incompatible",
        );
      }
      let inventory: Inventory;
      try {
        inventory = initialInventory(configuration, loadout);
      } catch {
        return reject(
          state,
          command,
          "Starting loadout contains unavailable content",
        );
      }
      const seed = command.seed >>> 0,
        initialRng = createRandom(seed),
        stageInput = { seed, rng: initialRng, gameplayModuleId: moduleId },
        stages =
          policies.schedule.createStages?.(stageInput) ??
          adaptFlatScheduleToStage(
            policies.schedule.createSchedule(stageInput),
          ),
        schedule = stages.flatMap((stage) => stage.encounters);
      if (
        schedule.length === 0 ||
        stages.length === 0 ||
        stages.some(
          (stage, index) =>
            !stage.id ||
            stage.ordinal !== index + 1 ||
            stage.encounters.length === 0,
        ) ||
        schedule.some(
          (entry, index) =>
            !entry.id ||
            entry.ordinal !== index + 1 ||
            !entry.kind ||
            schedule.some(
              (other, otherIndex) =>
                otherIndex !== index && other.id === entry.id,
            ),
        )
      )
        return reject(
          state,
          command,
          "Policy produced an invalid encounter schedule",
        );
      const initialProgress = {
        stagePosition: 0,
        encounterPositionInStage: 0,
      } as const;
      const generated = prepareEncounter(
        initialRng,
        schedule[0]!,
        configuration,
        { stage: stages[0]!, ...initialProgress },
      );
      const next = {
        ...createInitialRunState(configuration),
        phase: "encounter-ready",
        seed,
        rng: generated.rng,
        encounterNumber: schedule[0]!.ordinal,
        schedule,
        schedulePosition: 0,
        stages,
        progress: initialProgress,
        currentEncounter: generated.brief,
        currency: policies.start.initialCurrency({
          seed,
          loadoutCurrency: loadout.currency,
        }),
        inventory,
        nextInstanceId: inventory.instances.length + 1,
        gameplayModuleId: moduleId,
        loadoutId: loadout.id,
        effects: {
          ...createInitialRunState(configuration).effects,
          allowances: {
            ...(configuration.gameplayAllowanceDefaults?.[moduleId] ?? {}),
          },
        },
      } satisfies RunState;
      return {
        state: next,
        events: [
          { type: "run-started", seed },
          {
            type: "stage-started",
            stageId: stages[0]!.id,
            ordinal: stages[0]!.ordinal,
          },
          { type: "encounter-prepared", brief: generated.brief },
        ],
      };
    }
    case "store-gameplay-session": {
      if (command.session.moduleId !== state.gameplayModuleId)
        return reject(
          state,
          command,
          "Gameplay session module does not match the run",
        );
      if (
        !state.currentEncounter ||
        command.session.encounterId !== state.currentEncounter.id
      )
        return reject(
          state,
          command,
          "Gameplay session does not match the encounter",
        );
      if (command.signals && !validGameplaySignals(command.signals))
        return reject(
          state,
          command,
          "Gameplay action signals must be serialisable, namespaced, finite, and within the 64-signal limit",
        );
      if (command.signals?.length) {
        const resolved = resolveSignalBatch(
          state,
          command.signals.map((signal) => ({
            ...signal,
            actionId: command.actionId ?? signal.sourceId ?? "gameplay-action",
          })),
          configuration,
          state.lastReport?.score ?? 0,
          state.currentEncounter.target,
        );
        return {
          state: { ...resolved.state, gameplaySession: command.session },
          events: resolved.events.map((fact) => ({
            type: "effect-runtime" as const,
            fact,
          })),
        };
      }
      return {
        state: { ...state, gameplaySession: command.session },
        events: [],
      };
    }
    case "start-encounter": {
      if (state.phase !== "encounter-ready" || !state.currentEncounter)
        return reject(state, command, "No prepared encounter is available");
      return {
        state: {
          ...state,
          phase: "encounter-active",
          lastReport: null,
          scoreBreakdown: [],
          scoreLedger: [],
        },
        events: [
          ...state.currentEncounter.rules.map((rule) => ({
            type: "rule-introduced" as const,
            rule,
          })),
          { type: "encounter-started", encounterId: state.currentEncounter.id },
        ],
      };
    }
    case "submit-encounter": {
      if (state.phase !== "encounter-active" || !state.currentEncounter)
        return reject(state, command, "An active encounter is required");
      if (command.report.encounterId !== state.currentEncounter.id)
        return reject(
          state,
          command,
          "Report does not match the active encounter",
        );
      if (!state.gameplaySession)
        return reject(
          state,
          command,
          "A validated gameplay session is required",
        );
      if (!validEncounterReport(command.report))
        return reject(
          state,
          command,
          "Report signals must be serialisable, namespaced, finite, and within the 64-signal limit",
        );
      const resolved = resolveScore(state, command.report, configuration);
      const encounterWon = resolved.outcome.success;
      const normalizedReport: EncounterReport = {
        ...command.report,
        score: resolved.tracks.score ?? resolved.score,
        tracks: resolved.tracks,
        objectives: command.report.objectives ?? {},
        resources: command.report.resources ?? {},
        statistics: command.report.statistics ?? command.report.metrics,
      };
      const entry = state.schedule[state.schedulePosition]!;
      const outcome = policies.outcome.evaluate({
        entry,
        encounterOutcome: resolved.outcome,
        encounterWon,
        hasNextEncounter: state.schedulePosition + 1 < state.schedule.length,
      });
      const routeFor = (hasPendingReward: boolean) =>
        policies.postEncounter.destination({
          entry,
          schedulePosition: state.schedulePosition,
          scheduleLength: state.schedule.length,
          encounterOutcome: resolved.outcome,
          hasNextEncounter: state.schedulePosition + 1 < state.schedule.length,
          hasPendingReward,
          runOutcome: outcome,
          runTags: state.effects.runTags,
          currency: resolved.state.currency,
          upgradeIds: state.inventory.upgradeIds,
          previousShopCount: state.shopCount,
          stage: stageContext(state),
        });
      if (!encounterWon) {
        const pendingRoute = routeFor(false);
        const failed = pendingRoute.type === "run-failed";
        return {
          state: {
            ...resolved.state,
            phase: failed ? "run-failed" : "reward",
            pendingRoute,
            lastReport: normalizedReport,
            lastOutcome: resolved.outcome,
            scoreBreakdown: resolved.lines,
            scoreLedger: resolved.ledger,
          },
          events: [
            ...resolved.events,
            {
              type: "encounter-lost",
              encounterId: state.currentEncounter.id,
              score: resolved.score,
              target: resolved.target,
            },
            ...(failed
              ? [
                  {
                    type: "run-failed" as const,
                    encounterNumber: state.encounterNumber,
                  },
                ]
              : []),
          ],
        };
      }
      const policyReward = policies.reward.rewardForEncounter({
        entry,
        score: resolved.score,
        target: resolved.target,
        rng: resolved.state.rng,
        stage: stageContext(state),
      });
      const reward: EncounterReward =
        typeof policyReward === "number"
          ? { type: "currency", amount: policyReward }
          : policyReward;
      const complete = outcome === "won";
      const begun = beginRewards(
        resolved.state,
        flattenRewards(reward),
        complete,
      );
      const pendingRoute = routeFor(begun.state.pendingReward !== null);
      return {
        state: {
          ...begun.state,
          pendingRoute,
          lastReport: normalizedReport,
          lastOutcome: resolved.outcome,
          scoreBreakdown: resolved.lines,
          scoreLedger: resolved.ledger,
        },
        events: [
          ...resolved.events,
          {
            type: "encounter-won",
            encounterId: state.currentEncounter.id,
            score: resolved.score,
            target: resolved.target,
          },
          ...begun.events,
        ],
      };
    }
    case "open-reward-container": {
      const pending = state.pendingReward;
      if (state.phase !== "reward" || pending?.type !== "container")
        return reject(
          state,
          command,
          "No unopened reward container is available",
        );
      const definition = findDefinition(configuration, pending.definitionId);
      const reward = definition?.reward;
      if (!reward)
        return reject(
          state,
          command,
          "Reward container definition is unavailable",
        );
      if (reward.type === "currency") {
        const amount = reward.currency ?? 0;
        const next = beginRewards(
          {
            ...state,
            rewardHistory: [
              ...state.rewardHistory,
              { definitionId: pending.definitionId, selectedDefinitionIds: [] },
            ],
          },
          [{ type: "currency", amount }, ...pending.remaining],
          pending.completesRun,
        );
        return {
          state: next.state,
          events: [
            {
              type: "reward-container-opened",
              definitionId: pending.definitionId,
            },
            ...next.events,
            { type: "reward-completed", definitionId: pending.definitionId },
          ],
        };
      }
      if (!reward.poolId)
        return reject(state, command, "Reward pool is not configured");
      const count =
        reward.type === "targeted" ? 1 : Math.max(1, reward.choiceCount ?? 1);
      const generated = generateRewardOptions(
        state,
        configuration,
        reward.poolId,
        count,
        reward.type === "targeted",
      );
      if (generated.options.length === 0)
        return reject(state, command, "Reward pool has no eligible candidates");
      return {
        state: {
          ...state,
          rng: generated.rng,
          nextRewardOptionId: generated.nextId,
          pendingReward: {
            type: "choice",
            definitionId: pending.definitionId,
            options: generated.options,
            remainingChoices: 1,
            selectedDefinitionIds: [],
            remaining: pending.remaining,
            completesRun: pending.completesRun,
          },
        },
        events: [
          {
            type: "reward-container-opened",
            definitionId: pending.definitionId,
          },
          { type: "reward-options-generated", options: generated.options },
        ],
      };
    }
    case "choose-reward": {
      const pending = state.pendingReward;
      if (state.phase !== "reward" || pending?.type !== "choice")
        return reject(state, command, "No reward choice is available");
      const option = pending.options.find(
        (item) => item.id === command.optionId,
      );
      if (!option) return reject(state, command, "Reward option was not found");
      const definition = findDefinition(configuration, option.definitionId);
      if (!definition)
        return reject(state, command, "Reward definition is unavailable");
      if (option.acquisition.type === "attachment")
        return {
          state: {
            ...state,
            pendingReward: { ...pending, type: "target", option },
          },
          events: [
            {
              type: "reward-selected",
              optionId: option.id,
              definitionId: option.definitionId,
            },
            { type: "reward-target-requested", optionId: option.id },
          ],
        };
      if (option.acquisition.type === "run-upgrade") {
        if (state.inventory.upgradeIds.includes(definition.id))
          return reject(state, command, "Run upgrade is already active");
        const capacities = { ...state.inventory.capacities };
        for (const [key, value] of Object.entries(
          definition.upgradeChanges ?? {},
        ))
          if (key.startsWith("capacity:"))
            capacities[key.slice(9)] = (capacities[key.slice(9)] ?? 0) + value;
        const completed = beginRewards(
          {
            ...state,
            inventory: {
              ...state.inventory,
              capacities,
              upgradeIds: [...state.inventory.upgradeIds, definition.id],
            },
            rewardHistory: [
              ...state.rewardHistory,
              {
                definitionId: pending.definitionId,
                selectedDefinitionIds: [definition.id],
              },
            ],
          },
          pending.remaining,
          pending.completesRun,
        );
        return {
          state: completed.state,
          events: [
            {
              type: "reward-selected",
              optionId: option.id,
              definitionId: definition.id,
            },
            { type: "run-upgrade-applied", definitionId: definition.id },
            { type: "reward-completed", definitionId: pending.definitionId },
            ...completed.events,
          ],
        };
      }
      const count = inventoryCategoryCount(
        state.inventory,
        (id) => findDefinition(configuration, id)?.category,
        definition.category,
        (id) => findDefinition(configuration, id)?.occupiesCapacity ?? false,
      );
      if (
        definition.occupiesCapacity &&
        count >= (state.inventory.capacities[definition.category] ?? 0)
      )
        return reject(state, command, "Inventory is full");
      const instance = createInstance(definition, state.nextInstanceId);
      const completed = beginRewards(
        {
          ...state,
          nextInstanceId: state.nextInstanceId + 1,
          inventory: {
            ...state.inventory,
            instances: [...state.inventory.instances, instance],
          },
          rewardHistory: [
            ...state.rewardHistory,
            {
              definitionId: pending.definitionId,
              selectedDefinitionIds: [definition.id],
            },
          ],
        },
        pending.remaining,
        pending.completesRun,
      );
      return {
        state: completed.state,
        events: [
          {
            type: "reward-selected",
            optionId: option.id,
            definitionId: definition.id,
          },
          { type: "reward-completed", definitionId: pending.definitionId },
          ...completed.events,
        ],
      };
    }
    case "choose-reward-target": {
      const pending = state.pendingReward;
      if (
        state.phase !== "reward" ||
        pending?.type !== "target" ||
        pending.option.id !== command.optionId
      )
        return reject(state, command, "No matching reward target is required");
      const operation = pending.option.acquisition;
      const host = state.inventory.instances.find(
        (item) =>
          item.instanceId === command.targetInstanceId && !item.hostInstanceId,
      );
      const hostDefinition =
        host && findDefinition(configuration, host.definitionId);
      const definition = findDefinition(
        configuration,
        pending.option.definitionId,
      );
      if (
        operation.type !== "attachment" ||
        !host ||
        !hostDefinition ||
        !definition ||
        !operation.hostCategories.includes(hostDefinition.category) ||
        operation.requiredHostTags?.some(
          (tag) => !hostDefinition.tags.includes(tag),
        )
      )
        return reject(state, command, "Reward target is incompatible");
      if (
        operation.slot &&
        host.attachmentIds.some(
          (id) =>
            findDefinition(
              configuration,
              state.inventory.instances.find((item) => item.instanceId === id)
                ?.definitionId ?? "",
            )?.attachmentSlot === operation.slot,
        )
      )
        return reject(state, command, "Attachment slot is occupied");
      const child = {
        ...createInstance(definition, state.nextInstanceId),
        hostInstanceId: host.instanceId,
      };
      const instances = [
        ...state.inventory.instances.map((item) =>
          item.instanceId === host.instanceId
            ? {
                ...item,
                attachmentIds: [...item.attachmentIds, child.instanceId],
              }
            : item,
        ),
        child,
      ];
      const completed = beginRewards(
        {
          ...state,
          nextInstanceId: state.nextInstanceId + 1,
          inventory: { ...state.inventory, instances },
          rewardHistory: [
            ...state.rewardHistory,
            {
              definitionId: pending.definitionId,
              selectedDefinitionIds: [definition.id],
            },
          ],
        },
        pending.remaining,
        pending.completesRun,
      );
      return {
        state: completed.state,
        events: [
          {
            type: "reward-target-resolved",
            optionId: pending.option.id,
            targetInstanceId: host.instanceId,
          },
          { type: "reward-completed", definitionId: pending.definitionId },
          ...completed.events,
        ],
      };
    }
    case "skip-reward":
      return reject(state, command, "This reward cannot be skipped");
    case "enter-shop": {
      if (state.phase !== "reward" || state.pendingRoute?.type !== "shop")
        return reject(
          state,
          command,
          "The authoritative route does not enter a shop",
        );
      const generated = generateShop(
          state,
          state.nextOfferId,
          configuration,
          state.schedule[state.schedulePosition]!,
        ),
        shop = {
          offers: generated.offers,
          rerollCount: 0,
          rerollPrice: rerollPrice(
            state,
            configuration,
            0,
            state.schedule[state.schedulePosition]!,
          ),
        };
      return {
        state: {
          ...state,
          phase: "shop",
          rng: generated.rng,
          shop,
          nextOfferId: generated.nextOfferId,
          shopCount: state.shopCount + 1,
          currentEncounter: null,
        },
        events: [
          ...generated.events,
          { type: "shop-entered", offers: shop.offers },
        ],
      };
    }
    case "reroll-shop": {
      if (state.phase !== "shop" || !state.shop)
        return reject(state, command, "An open shop is required");
      if (state.currency < state.shop.rerollPrice)
        return reject(state, command, "Insufficient currency");
      const generated = generateShop(
          state,
          state.nextOfferId,
          configuration,
          state.schedule[state.schedulePosition]!,
        ),
        cost = state.shop.rerollPrice,
        shop = {
          offers: generated.offers,
          rerollCount: state.shop.rerollCount + 1,
          rerollPrice: rerollPrice(
            state,
            configuration,
            state.shop.rerollCount + 1,
            state.schedule[state.schedulePosition]!,
          ),
        };
      return {
        state: {
          ...state,
          currency: state.currency - cost,
          rng: generated.rng,
          shop,
          nextOfferId: generated.nextOfferId,
        },
        events: [
          ...generated.events,
          { type: "shop-rerolled", offers: shop.offers, cost },
        ],
      };
    }
    case "buy-offer": {
      if (state.phase !== "shop" || !state.shop)
        return reject(state, command, "An open shop is required");
      const offer = state.shop.offers.find(
        (candidate) => candidate.id === command.offerId,
      );
      if (!offer) return reject(state, command, "Offer was not found");
      if (state.currency < offer.price)
        return reject(state, command, "Insufficient currency");
      const definition = findDefinition(configuration, offer.definitionId);
      if (!definition)
        return reject(state, command, "Item definition is unavailable");
      const count = inventoryCategoryCount(
        state.inventory,
        (id) => findDefinition(configuration, id)?.category,
        offer.category,
        (id) => findDefinition(configuration, id)?.occupiesCapacity ?? false,
      );
      if (
        definition.occupiesCapacity &&
        count >= (state.inventory.capacities[offer.category] ?? 0)
      )
        return reject(state, command, "Inventory is full");
      if (offer.acquisition.type === "attachment")
        return {
          state: { ...state, pendingAcquisition: { offer } },
          events: [{ type: "acquisition-target-requested", offerId: offer.id }],
        };
      if (offer.acquisition.type === "run-upgrade") {
        if (state.inventory.upgradeIds.includes(definition.id))
          return reject(state, command, "Run upgrade is already active");
        const changes = definition.upgradeChanges ?? {};
        const capacities = { ...state.inventory.capacities };
        for (const [key, value] of Object.entries(changes))
          if (key.startsWith("capacity:"))
            capacities[key.slice(9)] = (capacities[key.slice(9)] ?? 0) + value;
        return {
          state: {
            ...state,
            currency: state.currency - offer.price,
            inventory: {
              ...state.inventory,
              capacities,
              upgradeIds: [...state.inventory.upgradeIds, definition.id],
            },
            shop: {
              ...state.shop,
              offers: state.shop.offers.filter((item) => item.id !== offer.id),
            },
          },
          events: [
            { type: "run-upgrade-applied", definitionId: definition.id },
          ],
        };
      }
      const instance = createInstance(definition, state.nextInstanceId),
        inventory = {
          ...state.inventory,
          instances: [...state.inventory.instances, instance],
        };
      return {
        state: {
          ...state,
          currency: state.currency - offer.price,
          inventory,
          nextInstanceId: state.nextInstanceId + 1,
          shop: {
            ...state.shop,
            offers: state.shop.offers.filter(
              (candidate) => candidate.id !== offer.id,
            ),
          },
        },
        events: [{ type: "item-purchased", offerId: offer.id, instance }],
      };
    }
    case "choose-acquisition-target": {
      const pending = state.pendingAcquisition;
      if (
        state.phase !== "shop" ||
        !state.shop ||
        !pending ||
        pending.offer.id !== command.offerId
      )
        return reject(
          state,
          command,
          "No matching acquisition target is required",
        );
      if (state.currency < pending.offer.price)
        return reject(state, command, "Insufficient currency");
      const operation = pending.offer.acquisition;
      if (operation.type !== "attachment")
        return reject(state, command, "Offer does not require a target");
      const host = state.inventory.instances.find(
        (item) =>
          item.instanceId === command.targetInstanceId && !item.hostInstanceId,
      );
      const hostDefinition =
        host && findDefinition(configuration, host.definitionId);
      const definition = findDefinition(
        configuration,
        pending.offer.definitionId,
      );
      if (
        !host ||
        !hostDefinition ||
        !definition ||
        !operation.hostCategories.includes(hostDefinition.category) ||
        operation.requiredHostTags?.some(
          (tag) => !hostDefinition.tags.includes(tag),
        )
      )
        return reject(state, command, "Acquisition target is incompatible");
      if (
        operation.slot &&
        host.attachmentIds.some(
          (id) =>
            findDefinition(
              configuration,
              state.inventory.instances.find((item) => item.instanceId === id)
                ?.definitionId ?? "",
            )?.attachmentSlot === operation.slot,
        )
      )
        return reject(state, command, "Attachment slot is occupied");
      const child = {
        ...createInstance(definition, state.nextInstanceId),
        hostInstanceId: host.instanceId,
      };
      const instances = [
        ...state.inventory.instances.map((item) =>
          item.instanceId === host.instanceId
            ? {
                ...item,
                attachmentIds: [...item.attachmentIds, child.instanceId],
              }
            : item,
        ),
        child,
      ];
      return {
        state: {
          ...state,
          currency: state.currency - pending.offer.price,
          nextInstanceId: state.nextInstanceId + 1,
          pendingAcquisition: null,
          inventory: { ...state.inventory, instances },
          shop: {
            ...state.shop,
            offers: state.shop.offers.filter(
              (item) => item.id !== pending.offer.id,
            ),
          },
        },
        events: [
          {
            type: "acquisition-target-resolved",
            offerId: pending.offer.id,
            targetInstanceId: host.instanceId,
            instance: child,
          },
        ],
      };
    }
    case "sell-item": {
      if (state.phase !== "shop")
        return reject(state, command, "Items can only be sold in the shop");
      const owned = state.inventory.instances.find(
        (item) =>
          item.instanceId === command.instanceId && !item.hostInstanceId,
      );
      if (!owned) return reject(state, command, "Item was not found");
      const definition = findDefinition(configuration, owned.definitionId);
      if (!definition)
        return reject(state, command, "Item definition is unavailable");
      if (definition.sellable === false)
        return reject(state, command, "Item cannot be sold");
      const amount =
        definition.sellPrice ??
        policies.shopPricing.sellPrice?.({
          basePrice: definition.basePrice ?? 0,
          category: definition.category,
          upgradeIds: state.inventory.upgradeIds,
        }) ??
        Math.floor((definition.basePrice ?? 0) / 2);
      const removed = new Set([owned.instanceId, ...owned.attachmentIds]);
      return {
        state: {
          ...state,
          currency: state.currency + amount,
          inventory: {
            ...state.inventory,
            instances: state.inventory.instances.filter(
              (item) => !removed.has(item.instanceId),
            ),
          },
        },
        events: [{ type: "item-sold", instanceId: owned.instanceId, amount }],
      };
    }
    case "use-consumable": {
      if (
        !state.currentEncounter ||
        (state.phase !== "encounter-ready" &&
          state.phase !== "encounter-active")
      )
        return reject(
          state,
          command,
          "Consumables are used before an encounter starts",
        );
      const owned = state.inventory.instances.find(
        (item) =>
          item.instanceId === command.instanceId &&
          findDefinition(configuration, item.definitionId)?.category ===
            "consumable",
      );
      if (!owned) return reject(state, command, "Consumable was not found");
      const definition = findDefinition(configuration, owned.definitionId);
      if (!definition?.use) return reject(state, command, "Item is not usable");
      if (
        state.phase === "encounter-active" &&
        definition.use.type !== "custom"
      )
        return reject(
          state,
          command,
          "This consumable is used before an encounter starts",
        );
      const encounterEffects =
        definition.use.type === "encounter-effect"
          ? [...state.encounterEffects, owned]
          : state.encounterEffects;
      return {
        state: {
          ...state,
          encounterEffects,
          inventory: {
            ...state.inventory,
            instances: state.inventory.instances.filter(
              (item) => item.instanceId !== owned.instanceId,
            ),
          },
        },
        events: [
          {
            type: "consumable-used",
            instanceId: owned.instanceId,
            ...(definition.use.type === "custom"
              ? { handler: definition.use.handler }
              : {}),
          },
        ],
      };
    }
    case "leave-shop":
    case "advance":
    case "continue": {
      if (command.type === "continue" && state.phase === "reward") {
        if (state.pendingReward)
          return reject(
            state,
            command,
            "The pending reward must be resolved first",
          );
        if (state.pendingRoute?.type === "shop")
          return handleCommand(state, { type: "enter-shop" }, configuration);
        if (state.pendingRoute?.type === "run-complete")
          return {
            state: { ...state, phase: "run-complete" },
            events: [{ type: "run-completed", currency: state.currency }],
          };
        if (state.pendingRoute?.type === "run-failed")
          return {
            state: { ...state, phase: "run-failed" },
            events: [
              { type: "run-failed", encounterNumber: state.encounterNumber },
            ],
          };
      }
      if (
        !(
          state.phase === "shop" &&
          (command.type === "leave-shop" || command.type === "continue") &&
          state.pendingRoute?.type === "shop"
        ) &&
        !(
          state.phase === "reward" &&
          (command.type === "advance" || command.type === "continue") &&
          state.pendingRoute?.type === "next-encounter" &&
          !state.pendingReward
        )
      )
        return reject(
          state,
          command,
          "Command does not match the authoritative route",
        );
      const schedulePosition = state.schedulePosition + 1;
      const entry = state.schedule[schedulePosition];
      if (!entry)
        return reject(state, command, "No scheduled encounter remains");
      const currentStage = state.stages[state.progress.stagePosition]!;
      const crossedStage =
        state.progress.encounterPositionInStage + 1 >=
        currentStage.encounters.length;
      const progress = crossedStage
        ? {
            stagePosition: state.progress.stagePosition + 1,
            encounterPositionInStage: 0,
          }
        : {
            ...state.progress,
            encounterPositionInStage:
              state.progress.encounterPositionInStage + 1,
          };
      const nextStage = state.stages[progress.stagePosition]!;
      const generated = prepareEncounter(state.rng, entry, configuration, {
        stage: nextStage,
        ...progress,
      });
      return {
        state: {
          ...state,
          phase: "encounter-ready",
          rng: generated.rng,
          encounterNumber: entry.ordinal,
          schedulePosition,
          progress,
          currentEncounter: generated.brief,
          gameplaySession: null,
          encounterEffects: [],
          effects: {
            ...state.effects,
            allowances: {
              ...(configuration.gameplayAllowanceDefaults?.[
                state.gameplayModuleId
              ] ?? {}),
            },
            encounterTags: [],
          },
          shop: null,
          pendingRoute: null,
          lastReport: null,
          scoreBreakdown: [],
          scoreLedger: [],
        },
        events: [
          ...state.encounterEffects
            .filter((item) => item.expiresAfterEncounter)
            .map((item) => ({
              type: "instance-expired" as const,
              instanceId: item.instanceId,
            })),
          ...(crossedStage
            ? [
                {
                  type: "stage-completed" as const,
                  stageId: currentStage.id,
                  ordinal: currentStage.ordinal,
                },
                {
                  type: "stage-started" as const,
                  stageId: nextStage.id,
                  ordinal: nextStage.ordinal,
                },
              ]
            : []),
          { type: "encounter-prepared", brief: generated.brief },
        ],
      };
    }
    case "abandon-run": {
      if (state.phase === "idle" || state.phase === "abandoned")
        return reject(state, command, "No run is active");
      return {
        state: {
          ...createInitialRunState(configuration),
          phase: "abandoned",
          gameplayModuleId: state.gameplayModuleId,
        },
        events: [{ type: "run-abandoned" }],
      };
    }
  }
}
