import { FrameworkError, requireSafeNumber } from "./errors";
import type { RuleReference } from "./gameplay";
import type { RandomState } from "./random";

export interface PolicyReference {
  readonly id: string;
  readonly version: number;
}
export type VersionedPolicy = PolicyReference;
export interface EncounterScheduleEntry {
  readonly id: string;
  readonly ordinal: number;
  readonly kind: string;
  readonly rules: readonly RuleReference[];
}
export interface StageScheduleEntry {
  readonly id: string;
  readonly ordinal: number;
  readonly encounters: readonly EncounterScheduleEntry[];
  readonly metadata?:
    | null
    | boolean
    | number
    | string
    | readonly unknown[]
    | Readonly<Record<string, unknown>>;
}
export interface StageContext {
  readonly stage: StageScheduleEntry;
  readonly stagePosition: number;
  readonly encounterPositionInStage: number;
}
export interface RunStartPolicy extends VersionedPolicy {
  initialCurrency(context: {
    readonly seed: number;
    readonly loadoutCurrency: number;
  }): number;
}
export interface EncounterSchedulePolicy extends VersionedPolicy {
  /** Policy RNG is an immutable snapshot. Schedule creation never advances run RNG. */
  createSchedule(context: {
    readonly seed: number;
    readonly rng: RandomState;
    readonly gameplayModuleId: string;
  }): readonly EncounterScheduleEntry[];
  /** Stage-aware policies use this; flat policies are adapted to one stage. */
  createStages?(context: {
    readonly seed: number;
    readonly rng: RandomState;
    readonly gameplayModuleId: string;
  }): readonly StageScheduleEntry[];
}
export interface TargetPolicy extends VersionedPolicy {
  /** Policy RNG is an immutable snapshot. Target calculation never advances run RNG. */
  targetForEncounter(context: {
    readonly entry: EncounterScheduleEntry;
    readonly rng: RandomState;
    readonly stage?: StageContext | undefined;
  }): number;
  requirementsForEncounter?(context: {
    readonly entry: EncounterScheduleEntry;
    readonly rng: RandomState;
    readonly stage?: StageContext | undefined;
  }): import("./engine").EncounterRequirements;
}
export type EncounterReward =
  | { readonly type: "currency"; readonly amount: number }
  | { readonly type: "container"; readonly definitionId: string }
  | { readonly type: "sequence"; readonly rewards: readonly EncounterReward[] };
export interface RewardPolicy extends VersionedPolicy {
  /** Policy RNG is an immutable snapshot. Reward calculation never advances run RNG. */
  rewardForEncounter(context: {
    readonly entry: EncounterScheduleEntry;
    readonly score: number;
    readonly target: number;
    readonly rng: RandomState;
    readonly stage?: StageContext | undefined;
  }): number | EncounterReward;
}
export interface ShopGenerationPolicy extends VersionedPolicy {
  offerCount(context: {
    readonly entry: EncounterScheduleEntry;
    readonly stage?: StageContext | undefined;
  }): number;
}
export interface ShopPricingPolicy extends VersionedPolicy {
  offerPrice(context: {
    readonly basePrice: number;
    readonly category: string;
    readonly entry: EncounterScheduleEntry;
    readonly rarity?: string;
    readonly rarityMultiplier?: number;
    readonly providerId?: string;
    readonly poolId?: string;
    readonly rerollCount?: number;
    readonly upgradeIds?: readonly string[];
    readonly priceAdjustment?: number;
  }): number;
  sellPrice?(context: {
    readonly basePrice: number;
    readonly category: string;
    readonly upgradeIds: readonly string[];
  }): number;
  rerollPrice(context: {
    readonly rerollCount: number;
    readonly entry: EncounterScheduleEntry;
  }): number;
}
export interface InventoryPolicy extends VersionedPolicy {
  limitFor(category: string, loadoutLimit: number): number;
}
export interface ContentCompatibilityPolicy extends VersionedPolicy {
  supports(context: {
    readonly packId: string;
    readonly packVersion: number;
  }): boolean;
}
export type RunOutcome = "won" | "lost";
export interface EncounterOutcome {
  readonly status: "won" | "lost" | "draw" | "completed";
  readonly success: boolean;
  readonly reasons: readonly OutcomeReason[];
}
export interface OutcomeReason {
  readonly code: string;
  readonly key?: string;
  readonly expected?: number | boolean;
  readonly actual?: number | boolean;
}
export interface EncounterOutcomePolicy extends VersionedPolicy {
  evaluate(context: {
    readonly requirements: import("./engine").EncounterRequirements;
    readonly tracks: Readonly<Record<string, number>>;
    readonly objectives: Readonly<Record<string, boolean>>;
    readonly resources: Readonly<Record<string, number>>;
    readonly tags: readonly string[];
    readonly statistics: Readonly<Record<string, number>>;
    readonly entry: EncounterScheduleEntry;
  }): EncounterOutcome;
}
export interface RunOutcomePolicy extends VersionedPolicy {
  evaluate(context: {
    readonly entry: EncounterScheduleEntry;
    readonly encounterOutcome?: EncounterOutcome;
    /** @deprecated Use encounterOutcome.success. */
    readonly encounterWon: boolean;
    readonly hasNextEncounter: boolean;
  }): RunOutcome | null;
}
export type PostEncounterDestination =
  | { readonly type: "reward" }
  | { readonly type: "shop" }
  | { readonly type: "next-encounter" }
  | { readonly type: "run-complete" }
  | { readonly type: "run-failed" };
export interface PostEncounterContext {
  readonly entry: EncounterScheduleEntry;
  readonly schedulePosition: number;
  readonly scheduleLength: number;
  readonly encounterOutcome: EncounterOutcome;
  readonly hasNextEncounter: boolean;
  readonly hasPendingReward: boolean;
  readonly runOutcome: RunOutcome | null;
  readonly runTags: readonly string[];
  readonly currency: number;
  readonly upgradeIds: readonly string[];
  readonly previousShopCount: number;
  readonly stage?: StageContext | undefined;
}

export const adaptFlatScheduleToStage = (
  encounters: readonly EncounterScheduleEntry[],
  id = "core:stage",
): readonly StageScheduleEntry[] => [{ id, ordinal: 1, encounters }];
export interface PostEncounterPolicy extends VersionedPolicy {
  /** Routing is pure: the policy is deliberately not given the run RNG. */
  destination(context: PostEncounterContext): PostEncounterDestination;
}
export interface RunPolicySet {
  readonly start: RunStartPolicy;
  readonly schedule: EncounterSchedulePolicy;
  readonly target: TargetPolicy;
  readonly reward: RewardPolicy;
  readonly shopGeneration: ShopGenerationPolicy;
  readonly shopPricing: ShopPricingPolicy;
  readonly inventory: InventoryPolicy;
  readonly encounterOutcome: EncounterOutcomePolicy;
  readonly outcome: RunOutcomePolicy;
  readonly postEncounter: PostEncounterPolicy;
}
export type RunPolicyKey = keyof RunPolicySet;

export class PolicyRegistry {
  private readonly values = new Map<string, VersionedPolicy>();
  constructor(policies: readonly VersionedPolicy[] = []) {
    policies.forEach((policy) => this.register(policy));
  }
  register<T extends VersionedPolicy>(policy: T): this {
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(policy.id))
      throw new FrameworkError(
        "invalid-policy",
        `Policy ID '${policy.id}' must be namespaced`,
        { policyId: policy.id },
      );
    requireSafeNumber(policy.version, `policies.${policy.id}.version`, {
      integer: true,
      minimum: 1,
    });
    if (this.values.has(policy.id))
      throw new FrameworkError(
        "duplicate-id",
        `Duplicate policy ID '${policy.id}'`,
        { policyId: policy.id },
      );
    this.values.set(policy.id, policy);
    return this;
  }
  get<T extends VersionedPolicy>(reference: PolicyReference): T {
    const policy = this.values.get(reference.id);
    if (!policy)
      throw new FrameworkError(
        "unknown-policy",
        `Unknown policy ID '${reference.id}'`,
        { policyId: reference.id },
      );
    if (policy.version !== reference.version)
      throw new FrameworkError(
        "invalid-policy",
        `Policy '${reference.id}' version ${reference.version} is incompatible with ${policy.version}`,
        {
          policyId: reference.id,
          expected: policy.version,
          actual: reference.version,
        },
      );
    return policy as T;
  }
  references(): readonly PolicyReference[] {
    return [...this.values.values()].map(({ id, version }) => ({
      id,
      version,
    }));
  }
}

export const defaultPolicies: RunPolicySet = {
  start: { id: "core:standard-start", version: 1, initialCurrency: () => 10 },
  schedule: {
    id: "core:six-encounters",
    version: 1,
    createSchedule: () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: `encounter-${index + 1}`,
        ordinal: index + 1,
        kind: index === 5 ? "special" : "ordinary",
        rules: [],
      })),
  },
  target: {
    id: "core:linear-target",
    version: 1,
    targetForEncounter: ({ entry }) => 25 + entry.ordinal * 4,
  },
  reward: {
    id: "core:linear-reward",
    version: 1,
    rewardForEncounter: ({ entry }) => 10 + entry.ordinal * 2,
  },
  shopGeneration: { id: "core:three-offers", version: 1, offerCount: () => 3 },
  shopPricing: {
    id: "core:base-pricing",
    version: 1,
    offerPrice: ({ basePrice, rarityMultiplier = 1, priceAdjustment = 0 }) =>
      Math.max(0, Math.round(basePrice * rarityMultiplier + priceAdjustment)),
    rerollPrice: ({ rerollCount }) => 5 + rerollCount * 2,
    sellPrice: ({ basePrice }) => Math.max(0, Math.floor(basePrice / 2)),
  },
  inventory: {
    id: "core:standard-inventory",
    version: 1,
    limitFor: (_category, loadoutLimit) => loadoutLimit,
  },
  encounterOutcome: {
    id: "core:scalar-threshold-outcome",
    version: 1,
    evaluate: ({ requirements, tracks }) => {
      const target = requirements.targets.score;
      const score = tracks.score;
      const success =
        typeof target === "number" &&
        typeof score === "number" &&
        score >= target;
      return {
        status: success ? "won" : "lost",
        success,
        reasons: [
          {
            code: success ? "core:target-met" : "core:target-missed",
            key: "score",
            ...(target === undefined ? {} : { expected: target }),
            ...(score === undefined ? {} : { actual: score }),
          },
        ],
      };
    },
  },
  outcome: {
    id: "core:six-win-outcome",
    version: 1,
    evaluate: ({ encounterOutcome, encounterWon, hasNextEncounter }) =>
      !(encounterOutcome?.success ?? encounterWon)
        ? "lost"
        : hasNextEncounter
          ? null
          : "won",
  },
  postEncounter: {
    id: "core:reward-shop-progression",
    version: 1,
    destination: ({ runOutcome }) =>
      runOutcome === "won"
        ? { type: "run-complete" }
        : runOutcome === "lost"
          ? { type: "run-failed" }
          : { type: "shop" },
  },
};

export function policyReferences(
  policies: RunPolicySet,
): Readonly<Record<RunPolicyKey, PolicyReference>> {
  return Object.fromEntries(
    Object.entries(policies).map(([key, { id, version }]) => [
      key,
      { id, version },
    ]),
  ) as unknown as Readonly<Record<RunPolicyKey, PolicyReference>>;
}

export function resolvePolicySet(
  registry: PolicyRegistry,
  references: Readonly<Record<RunPolicyKey, PolicyReference>>,
): RunPolicySet {
  const keys: readonly RunPolicyKey[] = [
    "start",
    "schedule",
    "target",
    "reward",
    "shopGeneration",
    "shopPricing",
    "inventory",
    "encounterOutcome",
    "outcome",
    "postEncounter",
  ];
  for (const key of keys)
    if (!references[key])
      throw new FrameworkError(
        "invalid-policy",
        `Missing policy reference '${key}'`,
      );
  return Object.fromEntries(
    keys.map((key) => [key, registry.get(references[key])]),
  ) as unknown as RunPolicySet;
}
