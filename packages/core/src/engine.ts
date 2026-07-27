import {
  createRandom,
  nextUint32,
  randomInteger,
  type RandomState,
} from "./random";
import {
  resolveEffects,
  type EffectDefinition,
  type EffectTrigger,
  type ScoreLedgerEntry,
} from "./effects";
import type { GameplaySessionState, RuleReference } from "./gameplay";
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
export type Rarity = string;
export type ItemCategory = "modifier" | "consumable";

export interface ItemDefinition {
  readonly id: string;
  readonly category: ItemCategory;
  readonly name: string;
  readonly description: string;
  readonly rarity: Rarity;
  readonly weight: number;
  readonly basePrice: number;
  readonly triggers?: readonly EffectTrigger[];
  readonly use?:
    | { readonly type: "encounter-effect" }
    | { readonly type: "custom"; readonly handler: RuleReference };
}
export interface RunConfiguration {
  readonly policies?: RunPolicySet;
  readonly definitions?: readonly ItemDefinition[];
  readonly initialItems?: readonly string[];
}
export interface OwnedItem {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly storedValues: Readonly<Record<string, number>>;
  readonly disabled: boolean;
}
export interface Inventory {
  readonly modifiers: readonly OwnedItem[];
  readonly consumables: readonly OwnedItem[];
  readonly modifierCapacity: number;
  readonly consumableCapacity: number;
}
export interface ShopOffer {
  readonly id: string;
  readonly definitionId: string;
  readonly category: ItemCategory;
  readonly price: number;
}
export interface ShopState {
  readonly offers: readonly ShopOffer[];
  readonly rerollCount: number;
  readonly rerollPrice: number;
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
  readonly nextInstanceId: number;
  readonly nextOfferId: number;
  readonly lastReport: EncounterReport | null;
  readonly scoreBreakdown: readonly ScoreLine[];
  readonly scoreLedger: readonly ScoreLedgerEntry[];
  readonly gameplayModuleId: string;
  readonly gameplaySession: GameplaySessionState | null;
  readonly encounterEffects: readonly OwnedItem[];
}
export type RunCommand =
  | {
      readonly type: "start-run";
      readonly seed: number;
      readonly gameplayModuleId?: string;
    }
  | {
      readonly type: "store-gameplay-session";
      readonly session: GameplaySessionState;
    }
  | { readonly type: "start-encounter" }
  | { readonly type: "submit-encounter"; readonly report: EncounterReport }
  | { readonly type: "enter-shop" }
  | { readonly type: "buy-offer"; readonly offerId: string }
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
      readonly instance: OwnedItem;
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

const EMPTY_CONFIGURATION: RunConfiguration = {};
const definitionsOf = (configuration: RunConfiguration) =>
  configuration.definitions ?? [];
const findDefinition = (configuration: RunConfiguration, id: string) =>
  definitionsOf(configuration).find((definition) => definition.id === id);
export function definitionFor(
  id: string,
  configuration: RunConfiguration = EMPTY_CONFIGURATION,
): ItemDefinition | undefined {
  return findDefinition(configuration, id);
}
const initialInventory = (configuration: RunConfiguration): Inventory => {
  const policies = configuration.policies ?? defaultPolicies;
  let next = 1;
  const items = (configuration.initialItems ?? []).flatMap(
    (definitionId): OwnedItem[] =>
      findDefinition(configuration, definitionId)
        ? [
            {
              instanceId: `item-${next++}`,
              definitionId,
              storedValues: {},
              disabled: false,
            },
          ]
        : [],
  );
  return {
    modifiers: items.filter(
      (item) =>
        findDefinition(configuration, item.definitionId)?.category ===
        "modifier",
    ),
    consumables: items.filter(
      (item) =>
        findDefinition(configuration, item.definitionId)?.category ===
        "consumable",
    ),
    modifierCapacity: policies.inventory.limitFor("modifier"),
    consumableCapacity: policies.inventory.limitFor("consumable"),
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
    nextInstanceId:
      inventory.modifiers.length + inventory.consumables.length + 1,
    nextOfferId: 1,
    lastReport: null,
    scoreBreakdown: [],
    scoreLedger: [],
    gameplayModuleId: "core:unselected",
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
function weightedDefinition(
  state: RandomState,
  configuration: RunConfiguration,
) {
  const definitions = definitionsOf(configuration);
  const total = definitions.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return { rng: state, definition: undefined };
  const roll = randomInteger(state, 1, total);
  let cursor = roll.value;
  for (const item of definitions) {
    cursor -= item.weight;
    if (cursor <= 0) return { rng: roll.state, definition: item };
  }
  return { rng: roll.state, definition: definitions[0] };
}
function generateShop(
  state: RandomState,
  nextOfferId: number,
  configuration: RunConfiguration,
  entry: EncounterScheduleEntry,
) {
  const policies = configuration.policies ?? defaultPolicies;
  let rng = state,
    id = nextOfferId;
  const offers: ShopOffer[] = [];
  const maximum = Math.min(
    policies.shopGeneration.offerCount({ entry }),
    definitionsOf(configuration).length,
  );
  let attempts = 0;
  while (offers.length < maximum && attempts++ < 100) {
    const choice = weightedDefinition(rng, configuration);
    rng = choice.rng;
    if (
      !choice.definition ||
      offers.some((offer) => offer.definitionId === choice.definition!.id)
    )
      continue;
    offers.push({
      id: `offer-${id++}`,
      definitionId: choice.definition.id,
      category: choice.definition.category,
      price: policies.shopPricing.offerPrice({
        basePrice: choice.definition.basePrice,
        category: choice.definition.category,
        entry,
      }),
    });
  }
  return { rng, offers, nextOfferId: id };
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
    ...state.inventory.modifiers,
    ...state.encounterEffects,
  ];
  const definitions: EffectDefinition[] = definitionsOf(configuration)
    .filter((definition) => definition.triggers)
    .map((definition) => ({
      id: definition.id,
      label: definition.name,
      tags: [definition.category, definition.rarity],
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
  const modifiers = state.inventory.modifiers.map((owned) => {
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
      state.inventory.modifiers.some(
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
    inventory: { ...state.inventory, modifiers },
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
      const seed = command.seed >>> 0,
        inventory = initialInventory(configuration),
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
        currency: policies.start.initialCurrency({ seed }),
        inventory,
        gameplayModuleId: moduleId,
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
          state.rng,
          state.nextOfferId,
          configuration,
          state.schedule[state.schedulePosition]!,
        ),
        shop = {
          offers: generated.offers,
          rerollCount: 0,
          rerollPrice: policies.shopPricing.rerollPrice({
            rerollCount: 0,
            entry: state.schedule[state.schedulePosition]!,
          }),
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
        events: [{ type: "shop-entered", offers: shop.offers }],
      };
    }
    case "reroll-shop": {
      if (state.phase !== "shop" || !state.shop)
        return reject(state, command, "An open shop is required");
      if (state.currency < state.shop.rerollPrice)
        return reject(state, command, "Insufficient currency");
      const generated = generateShop(
          state.rng,
          state.nextOfferId,
          configuration,
          state.schedule[state.schedulePosition]!,
        ),
        cost = state.shop.rerollPrice,
        shop = {
          offers: generated.offers,
          rerollCount: state.shop.rerollCount + 1,
          rerollPrice: policies.shopPricing.rerollPrice({
            rerollCount: state.shop.rerollCount + 1,
            entry: state.schedule[state.schedulePosition]!,
          }),
        };
      return {
        state: {
          ...state,
          currency: state.currency - cost,
          rng: generated.rng,
          shop,
          nextOfferId: generated.nextOfferId,
        },
        events: [{ type: "shop-rerolled", offers: shop.offers, cost }],
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
      const list =
          offer.category === "modifier"
            ? state.inventory.modifiers
            : state.inventory.consumables,
        capacity =
          offer.category === "modifier"
            ? state.inventory.modifierCapacity
            : state.inventory.consumableCapacity;
      if (list.length >= capacity)
        return reject(state, command, "Inventory is full");
      const instance = {
          instanceId: `item-${state.nextInstanceId}`,
          definitionId: offer.definitionId,
          storedValues: {},
          disabled: false,
        },
        inventory = {
          ...state.inventory,
          [offer.category === "modifier" ? "modifiers" : "consumables"]: [
            ...list,
            instance,
          ],
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
    case "sell-item": {
      if (state.phase !== "shop")
        return reject(state, command, "Items can only be sold in the shop");
      const owned = [
        ...state.inventory.modifiers,
        ...state.inventory.consumables,
      ].find((item) => item.instanceId === command.instanceId);
      if (!owned) return reject(state, command, "Item was not found");
      const definition = findDefinition(configuration, owned.definitionId);
      if (!definition)
        return reject(state, command, "Item definition is unavailable");
      const amount = Math.floor(definition.basePrice / 2);
      return {
        state: {
          ...state,
          currency: state.currency + amount,
          inventory: {
            ...state.inventory,
            modifiers: state.inventory.modifiers.filter(
              (item) => item.instanceId !== owned.instanceId,
            ),
            consumables: state.inventory.consumables.filter(
              (item) => item.instanceId !== owned.instanceId,
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
      const owned = state.inventory.consumables.find(
        (item) => item.instanceId === command.instanceId,
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
            consumables: state.inventory.consumables.filter(
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
