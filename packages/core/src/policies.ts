import type { RandomState } from "./random";
import type { ItemCategory, SpecialRule } from "./engine";
import { FrameworkError, requireSafeNumber } from "./errors";

export interface PolicyReference {
  readonly id: string;
  readonly version: number;
}
export type VersionedPolicy = PolicyReference;
export interface EncounterSchedulePolicy extends VersionedPolicy {
  createSchedule(context: {
    readonly seed: number;
    readonly rng: RandomState;
  }): readonly {
    readonly number: number;
    readonly specialRule: SpecialRule | null;
  }[];
}
export interface TargetPolicy extends VersionedPolicy {
  targetForEncounter(context: {
    readonly encounterNumber: number;
    readonly rng: RandomState;
  }): number;
}
export interface RewardPolicy extends VersionedPolicy {
  rewardForEncounter(context: {
    readonly encounterNumber: number;
    readonly score: number;
    readonly target: number;
    readonly rng: RandomState;
  }): number;
}
export interface ShopGenerationPolicy extends VersionedPolicy {
  offerCount(context: { readonly encounterNumber: number }): number;
}
export interface ShopPricingPolicy extends VersionedPolicy {
  price(context: {
    readonly basePrice: number;
    readonly rerollCount: number;
    readonly category: ItemCategory;
  }): number;
}
export interface InventoryPolicy extends VersionedPolicy {
  limitFor(category: ItemCategory): number;
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
    readonly encounterNumber: number;
    readonly encounterWon: boolean;
  }): RunOutcome | null;
}
export type FrameworkPolicy =
  | EncounterSchedulePolicy
  | TargetPolicy
  | RewardPolicy
  | ShopGenerationPolicy
  | ShopPricingPolicy
  | InventoryPolicy
  | ContentCompatibilityPolicy
  | RunOutcomePolicy;

export class PolicyRegistry {
  private readonly values = new Map<string, VersionedPolicy>();
  constructor(policies: readonly VersionedPolicy[] = []) {
    policies.forEach((p) => this.register(p));
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

export const defaultPolicies = {
  schedule: {
    id: "core:six-encounters",
    version: 1,
    createSchedule: () =>
      Array.from({ length: 6 }, (_, index) => ({
        number: index + 1,
        specialRule:
          index === 2
            ? ("reduced-limit" as const)
            : index === 5
              ? ("cyan-penalty" as const)
              : null,
      })),
  },
  target: {
    id: "core:linear-target",
    version: 1,
    targetForEncounter: ({
      encounterNumber,
    }: {
      readonly encounterNumber: number;
    }) => 25 + encounterNumber * 4,
  },
  reward: {
    id: "core:linear-reward",
    version: 1,
    rewardForEncounter: ({
      encounterNumber,
    }: {
      readonly encounterNumber: number;
    }) => 10 + encounterNumber * 2,
  },
  shopGeneration: { id: "core:three-offers", version: 1, offerCount: () => 3 },
  shopPricing: {
    id: "core:base-pricing",
    version: 1,
    price: ({ basePrice }: { readonly basePrice: number }) => basePrice,
  },
  inventory: {
    id: "core:standard-inventory",
    version: 1,
    limitFor: (category: ItemCategory) => (category === "modifier" ? 4 : 2),
  },
  content: { id: "core:exact-content", version: 1, supports: () => true },
  outcome: {
    id: "core:six-win-outcome",
    version: 1,
    evaluate: ({
      encounterNumber,
      encounterWon,
    }: {
      readonly encounterNumber: number;
      readonly encounterWon: boolean;
    }) =>
      !encounterWon
        ? ("lost" as const)
        : encounterNumber === 6
          ? ("won" as const)
          : null,
  },
} as const;
