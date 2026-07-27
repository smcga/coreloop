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
}
export interface TargetPolicy extends VersionedPolicy {
  /** Policy RNG is an immutable snapshot. Target calculation never advances run RNG. */
  targetForEncounter(context: {
    readonly entry: EncounterScheduleEntry;
    readonly rng: RandomState;
  }): number;
}
export interface RewardPolicy extends VersionedPolicy {
  /** Policy RNG is an immutable snapshot. Reward calculation never advances run RNG. */
  rewardForEncounter(context: {
    readonly entry: EncounterScheduleEntry;
    readonly score: number;
    readonly target: number;
    readonly rng: RandomState;
  }): number;
}
export interface ShopGenerationPolicy extends VersionedPolicy {
  offerCount(context: { readonly entry: EncounterScheduleEntry }): number;
}
export interface ShopPricingPolicy extends VersionedPolicy {
  offerPrice(context: {
    readonly basePrice: number;
    readonly category: string;
    readonly entry: EncounterScheduleEntry;
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
export interface RunOutcomePolicy extends VersionedPolicy {
  evaluate(context: {
    readonly entry: EncounterScheduleEntry;
    readonly encounterWon: boolean;
    readonly hasNextEncounter: boolean;
  }): RunOutcome | null;
}
export interface RunPolicySet {
  readonly start: RunStartPolicy;
  readonly schedule: EncounterSchedulePolicy;
  readonly target: TargetPolicy;
  readonly reward: RewardPolicy;
  readonly shopGeneration: ShopGenerationPolicy;
  readonly shopPricing: ShopPricingPolicy;
  readonly inventory: InventoryPolicy;
  readonly outcome: RunOutcomePolicy;
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
    offerPrice: ({ basePrice }) => basePrice,
    rerollPrice: ({ rerollCount }) => 5 + rerollCount * 2,
  },
  inventory: {
    id: "core:standard-inventory",
    version: 1,
    limitFor: (_category, loadoutLimit) => loadoutLimit,
  },
  outcome: {
    id: "core:six-win-outcome",
    version: 1,
    evaluate: ({ encounterWon, hasNextEncounter }) =>
      !encounterWon ? "lost" : hasNextEncounter ? null : "won",
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
    "outcome",
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
