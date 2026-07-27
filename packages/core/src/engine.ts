import {
  createRandom,
  nextUint32,
  randomInteger,
  type RandomState,
} from "./random";
import {
  resolveEffects,
  type EffectDefinition,
  type ScoreLedgerEntry,
} from "./effects";
import type { GameplaySessionState, RuleReference } from "./gameplay";
import type {
  RuntimeContentDefinition,
  RuntimeContentProvider,
  RuntimeStartingLoadout,
  ShopCandidate,
  ShopContext,
  ShopPoolProvider,
  AcquisitionOperation,
} from "./content";
import { FrameworkError } from "./errors";
import {
  defaultPolicies,
  policyReferences,
  type EncounterScheduleEntry,
  type PolicyReference,
  type RunPolicyKey,
  type RunPolicySet,
} from "./policies";

export const CONTENT_VERSION = 3;
export interface RunConfiguration {
  readonly policies?: RunPolicySet;
  readonly content?: RuntimeContentProvider;
  readonly defaultLoadoutId?: string;
  readonly shopProviders?: readonly ShopPoolProvider[];
  readonly gameplayCapabilities?: Readonly<Record<string, readonly string[]>>;
  readonly rarityPriceMultipliers?: Readonly<Record<string, number>>;
}
export interface ContentInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly storedValues: Readonly<Record<string, number>>;
  readonly disabled: boolean;
  readonly destroyed: boolean;
  readonly expiresAfterEncounter?: boolean;
  readonly temporaryTags: readonly string[];
  readonly attachmentIds: readonly string[];
  readonly hostInstanceId?: string;
  readonly transformationHistory: readonly string[];
}
export interface Inventory {
  readonly instances: readonly ContentInstance[];
  readonly capacities: Readonly<Record<string, number>>;
  readonly upgradeIds: readonly string[];
}
export interface ShopOffer {
  readonly id: string;
  readonly definitionId: string;
  readonly category: string;
  readonly price: number;
  readonly providerId: string;
  readonly providerVersion: number;
  readonly poolId: string;
  readonly acquisition: AcquisitionOperation;
}
export interface ShopState {
  readonly offers: readonly ShopOffer[];
  readonly rerollCount: number;
  readonly rerollPrice: number;
}
export interface PendingAcquisition {
  readonly offer: ShopOffer;
}
export interface EncounterBrief {
  readonly id: string;
  readonly number: number;
  readonly target: number;
  readonly rules: readonly RuleReference[];
  /** Derived by consuming exactly one value from the authoritative run RNG. */
  readonly moduleSeed: number;
}
export interface GameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
}
export interface EncounterReport {
  readonly encounterId: string;
  readonly score: number;
  readonly tags: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly signals: readonly GameplaySignal[];
}
export interface ScoreLine {
  readonly label: string;
  readonly operation: "add" | "multiply" | "subtract" | "final";
  readonly value: number;
  readonly sourceId?: string;
}
export type RunPhase =
  | "idle"
  | "encounter-ready"
  | "encounter-active"
  | "reward"
  | "shop"
  | "run-complete"
  | "run-failed"
  | "abandoned";
export interface RunState {
  readonly phase: RunPhase;
  readonly seed: number | null;
  readonly rng: RandomState;
  readonly encounterNumber: number;
  readonly schedule: readonly EncounterScheduleEntry[];
  readonly schedulePosition: number;
  readonly policyReferences: Readonly<Record<RunPolicyKey, PolicyReference>>;
  readonly currentEncounter: EncounterBrief | null;
  readonly currency: number;
  readonly inventory: Inventory;
  readonly shop: ShopState | null;
  readonly pendingAcquisition: PendingAcquisition | null;
  readonly nextInstanceId: number;
  readonly nextOfferId: number;
  readonly lastReport: EncounterReport | null;
  readonly scoreBreakdown: readonly ScoreLine[];
  readonly scoreLedger: readonly ScoreLedgerEntry[];
  readonly gameplayModuleId: string;
  readonly loadoutId: string | null;
  readonly gameplaySession: GameplaySessionState | null;
  readonly encounterEffects: readonly ContentInstance[];
}
export type RunCommand =
  | {
      readonly type: "start-run";
      readonly seed: number;
      readonly gameplayModuleId?: string;
      readonly loadoutId?: string;
    }
  | {
      readonly type: "store-gameplay-session";
      readonly session: GameplaySessionState;
    }
  | { readonly type: "start-encounter" }
  | { readonly type: "submit-encounter"; readonly report: EncounterReport }
  | { readonly type: "enter-shop" }
  | { readonly type: "buy-offer"; readonly offerId: string }
  | {
      readonly type: "choose-acquisition-target";
      readonly offerId: string;
      readonly targetInstanceId: string;
    }
  | { readonly type: "sell-item"; readonly instanceId: string }
  | { readonly type: "use-consumable"; readonly instanceId: string }
  | { readonly type: "reroll-shop" }
  | { readonly type: "leave-shop" }
  | { readonly type: "abandon-run" }
  | { readonly type: "advance" };
export type RunEvent =
  | { readonly type: "run-started"; readonly seed: number }
  | { readonly type: "encounter-prepared"; readonly brief: EncounterBrief }
  | { readonly type: "encounter-started"; readonly encounterId: string }
  | { readonly type: "rule-introduced"; readonly rule: RuleReference }
  | {
      readonly type: "encounter-won" | "encounter-lost";
      readonly encounterId: string;
      readonly score: number;
      readonly target: number;
    }
  | {
      readonly type: "currency-awarded";
      readonly amount: number;
      readonly total: number;
    }
  | {
      readonly type: "shop-entered" | "shop-rerolled";
      readonly offers: readonly ShopOffer[];
      readonly cost?: number;
    }
  | {
      readonly type: "item-purchased";
      readonly offerId: string;
      readonly instance: ContentInstance;
    }
  | { readonly type: "acquisition-target-requested"; readonly offerId: string }
  | {
      readonly type: "acquisition-target-resolved";
      readonly offerId: string;
      readonly targetInstanceId: string;
      readonly instance: ContentInstance;
    }
  | { readonly type: "run-upgrade-applied"; readonly definitionId: string }
  | {
      readonly type: "shop-candidate-rejected";
      readonly providerId: string;
      readonly candidateId: string;
      readonly reason: string;
    }
  | {
      readonly type: "item-sold";
      readonly instanceId: string;
      readonly amount: number;
    }
  | {
      readonly type: "consumable-used";
      readonly instanceId: string;
      readonly handler?: RuleReference;
    }
  | {
      readonly type: "modifier-triggered";
      readonly instanceId: string;
      readonly label: string;
    }
  | {
      readonly type: "stored-value-increased";
      readonly instanceId: string;
      readonly value: number;
    }
  | { readonly type: "run-completed"; readonly currency: number }
  | { readonly type: "run-failed"; readonly encounterNumber: number }
  | { readonly type: "run-abandoned" }
  | {
      readonly type: "command-rejected";
      readonly command: RunCommand["type"];
      readonly phase: RunPhase;
      readonly reason: string;
    };
export interface TransitionResult {
  readonly state: RunState;
  readonly events: readonly RunEvent[];
}

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
const EMPTY_CONFIGURATION: RunConfiguration = {
  content: EMPTY_PROVIDER,
  defaultLoadoutId: "core:empty-loadout",
};
const definitionsOf = (
  configuration: RunConfiguration,
  gameplayModuleId = "core:unselected",
) => configuration.content?.listDefinitions({ gameplayModuleId }) ?? [];
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
    policyReferences: policyReferences(
      configuration.policies ?? defaultPolicies,
    ),
    currentEncounter: null,
    currency: 0,
    inventory,
    shop: null,
    pendingAcquisition: null,
    nextInstanceId: 1,
    nextOfferId: 1,
    lastReport: null,
    scoreBreakdown: [],
    scoreLedger: [],
    gameplayModuleId: "core:unselected",
    loadoutId: null,
    gameplaySession: null,
    encounterEffects: [],
  };
}
function prepareEncounter(
  state: RandomState,
  entry: EncounterScheduleEntry,
  configuration: RunConfiguration,
) {
  const policies = configuration.policies ?? defaultPolicies;
  const derived = nextUint32(state);
  const brief: EncounterBrief = {
    id: entry.id,
    number: entry.ordinal,
    target: policies.target.targetForEncounter({ entry, rng: state }),
    rules: entry.rules,
    moduleSeed: derived.value,
  };
  return { rng: derived.state, brief };
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
    policies.shopGeneration.offerCount({ entry }),
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
function resolveScore(
  state: Readonly<RunState>,
  report: EncounterReport,
  configuration: RunConfiguration,
) {
  const allInstances = [
    ...state.inventory.instances,
    ...state.encounterEffects,
  ];
  const definitions: EffectDefinition[] = definitionsOf(configuration)
    .filter((definition) => definition.triggers)
    .map((definition) => ({
      id: definition.id,
      label: definition.id,
      tags: [
        definition.category,
        ...(definition.rarity ? [definition.rarity] : []),
      ],
      triggers: definition.triggers!,
    }));
  const signal = {
    id: `score-${state.encounterNumber}`,
    sequence: 1,
    type: "score",
    tags: report.tags,
    values: report.metrics,
    context: {
      encounterId: report.encounterId,
      actionId: `action-${state.encounterNumber}`,
      encounterNumber: state.encounterNumber,
      special: state.currentEncounter!.rules.length > 0,
      occurrence: {
        chain: 1,
        action: 1,
        encounter: 1,
        run: state.encounterNumber,
      },
    },
  } as const;
  const resolved = resolveEffects(
    {
      score: report.score,
      target: state.currentEncounter!.target,
      currency: state.currency,
      priceModifier: 0,
      rng: state.rng,
      instances: allInstances,
      encounterTags: state.currentEncounter!.rules.map((rule) => rule.id),
      allowances: {},
      nextInstanceId: state.nextInstanceId,
    },
    signal,
    definitions,
  );
  const instances = state.inventory.instances.map((owned) => {
    const changed = resolved.state.instances.find(
      (item) => item.instanceId === owned.instanceId,
    );
    return changed
      ? {
          ...owned,
          storedValues: changed.storedValues,
          disabled: changed.disabled,
        }
      : owned;
  });
  const events: RunEvent[] = [];
  for (const entry of resolved.ledgerEntries)
    if (
      entry.source.instanceId &&
      state.inventory.instances.some(
        (item) => item.instanceId === entry.source.instanceId,
      )
    )
      events.push({
        type: "modifier-triggered",
        instanceId: entry.source.instanceId,
        label: entry.label,
      });
  for (const event of resolved.events)
    if (event.type === "stored-value-changed" && event.source.instanceId)
      events.push({
        type: "stored-value-increased",
        instanceId: event.source.instanceId,
        value: event.value ?? 0,
      });
  const base: ScoreLedgerEntry = {
    sequence: 1,
    encounterId: report.encounterId,
    actionId: signal.context.actionId,
    source: { definitionId: "core:gameplay-report" },
    triggerId: "reported-score",
    operation: "base",
    label: "Reported score",
    before: 0,
    after: report.score,
    amount: report.score,
    stage: "gameplay",
  };
  const effectLedger = resolved.ledgerEntries.map((entry, index) => ({
    ...entry,
    sequence: index + 2,
  }));
  const final: ScoreLedgerEntry = {
    sequence: effectLedger.length + 2,
    encounterId: report.encounterId,
    actionId: signal.context.actionId,
    source: { definitionId: "core:encounter-result" },
    triggerId: "final-score",
    operation: "final",
    label: "Final score",
    before: resolved.state.score,
    after: resolved.state.score,
    stage: "post-result",
  };
  const ledger = [base, ...effectLedger, final];
  const lines: ScoreLine[] = ledger.map((entry) => ({
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
  return {
    score: resolved.state.score,
    target: resolved.state.target,
    currency: resolved.state.currency,
    rng: resolved.state.rng,
    inventory: { ...state.inventory, instances },
    events,
    lines,
    ledger,
  };
}
export function createRunEngine(configuration: RunConfiguration) {
  if (!configuration.policies)
    throw new FrameworkError(
      "invalid-policy",
      "createRunEngine requires an explicit policy set",
    );
  const references = Object.values(policyReferences(configuration.policies));
  if (new Set(references.map(({ id }) => id)).size !== references.length)
    throw new FrameworkError(
      "duplicate-id",
      "Each run policy role requires a distinct policy",
    );
  const providers = configuration.shopProviders ?? [];
  if (
    providers.some(
      (provider) =>
        !provider.id.includes(":") ||
        !Number.isSafeInteger(provider.version) ||
        provider.version < 1,
    )
  )
    throw new FrameworkError(
      "invalid-policy",
      "Shop provider IDs must be namespaced and versions must be positive integers",
    );
  if (
    new Set(providers.map((provider) => provider.id)).size !== providers.length
  )
    throw new FrameworkError(
      "duplicate-id",
      "Shop provider IDs must be unique",
    );
  const handleConfigured = (
    state: Readonly<RunState>,
    command: RunCommand,
  ): TransitionResult => handle(state, command, configuration);
  return {
    createInitialState: () => createInitialRunState(configuration),
    handle: handleConfigured,
    definitionFor: (id: string) => definitionFor(id, configuration),
    policyReferences: policyReferences(configuration.policies),
    configuration,
  } as const;
}
export function handle(
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
        schedule = policies.schedule.createSchedule({
          seed,
          rng: initialRng,
          gameplayModuleId: moduleId,
        });
      if (
        schedule.length === 0 ||
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
      const generated = prepareEncounter(
        initialRng,
        schedule[0]!,
        configuration,
      );
      const next = {
        ...createInitialRunState(configuration),
        phase: "encounter-ready",
        seed,
        rng: generated.rng,
        encounterNumber: schedule[0]!.ordinal,
        schedule,
        schedulePosition: 0,
        currentEncounter: generated.brief,
        currency: policies.start.initialCurrency({
          seed,
          loadoutCurrency: loadout.currency,
        }),
        inventory,
        nextInstanceId: inventory.instances.length + 1,
        gameplayModuleId: moduleId,
        loadoutId: loadout.id,
      } satisfies RunState;
      return {
        state: next,
        events: [
          { type: "run-started", seed },
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
      const resolved = resolveScore(state, command.report, configuration);
      const encounterWon = resolved.score >= resolved.target;
      const entry = state.schedule[state.schedulePosition]!;
      const outcome = policies.outcome.evaluate({
        entry,
        encounterWon,
        hasNextEncounter: state.schedulePosition + 1 < state.schedule.length,
      });
      if (!encounterWon) {
        const failed = outcome === "lost";
        return {
          state: {
            ...state,
            phase: failed ? "run-failed" : "reward",
            inventory: resolved.inventory,
            rng: resolved.rng,
            lastReport: { ...command.report, score: resolved.score },
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
      const reward = policies.reward.rewardForEncounter({
        entry,
        score: resolved.score,
        target: resolved.target,
        rng: resolved.rng,
      });
      const total = resolved.currency + reward,
        complete = outcome === "won";
      return {
        state: {
          ...state,
          phase: complete ? "run-complete" : "reward",
          currency: total,
          rng: resolved.rng,
          inventory: resolved.inventory,
          lastReport: { ...command.report, score: resolved.score },
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
          { type: "currency-awarded", amount: reward, total },
          ...(complete
            ? [{ type: "run-completed" as const, currency: total }]
            : []),
        ],
      };
    }
    case "enter-shop": {
      if (state.phase !== "reward")
        return reject(state, command, "A won encounter reward is required");
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
      const count = state.inventory.instances.filter(
        (item) =>
          findDefinition(configuration, item.definitionId)?.category ===
            offer.category &&
          findDefinition(configuration, item.definitionId)?.occupiesCapacity,
      ).length;
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
      if (state.phase !== "encounter-ready" || !state.currentEncounter)
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
    case "advance": {
      if (
        state.phase !== "shop" &&
        !(command.type === "advance" && state.phase === "reward")
      )
        return reject(state, command, "An open shop is required");
      const schedulePosition = state.schedulePosition + 1;
      const entry = state.schedule[schedulePosition];
      if (!entry)
        return reject(state, command, "No scheduled encounter remains");
      const generated = prepareEncounter(state.rng, entry, configuration);
      return {
        state: {
          ...state,
          phase: "encounter-ready",
          rng: generated.rng,
          encounterNumber: entry.ordinal,
          schedulePosition,
          currentEncounter: generated.brief,
          gameplaySession: null,
          encounterEffects: [],
          shop: null,
          lastReport: null,
          scoreBreakdown: [],
          scoreLedger: [],
        },
        events: [{ type: "encounter-prepared", brief: generated.brief }],
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
