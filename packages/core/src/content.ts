import type { EffectTrigger } from "./effects";
import type { RuleReference } from "./gameplay";

export interface ContentQueryContext {
  readonly gameplayModuleId: string;
  readonly capabilities?: readonly string[];
  readonly encounterNumber?: number;
  readonly special?: boolean;
}
export interface RuntimeContentDefinition {
  readonly id: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly groups?: readonly string[];
  readonly rarity?: string;
  readonly basePrice?: number;
  readonly weight?: number;
  readonly availability?: RuntimeAvailability;
  readonly maximumCopies?: number;
  readonly sellable?: boolean;
  readonly sellPrice?: number;
  readonly acquisition?: AcquisitionOperation;
  readonly reward?: {
    readonly type: "choice" | "currency" | "targeted";
    readonly choiceCount?: number;
    readonly poolId?: string;
    readonly currency?: number;
    readonly targetOperation?: "attach" | "duplicate" | "transform";
  };
  readonly hostCategories?: readonly string[];
  readonly requiredHostTags?: readonly string[];
  readonly attachmentSlot?: string;
  readonly upgradeChanges?: Readonly<Record<string, number>>;
  readonly occupiesCapacity: boolean;
  readonly initialStoredValues?: Readonly<Record<string, number>>;
  readonly triggers?: readonly EffectTrigger[];
  readonly use?:
    | { readonly type: "encounter-effect" }
    | { readonly type: "custom"; readonly handler: RuleReference };
}
export interface RuntimeAvailability {
  readonly encounterMin?: number;
  readonly encounterMax?: number;
  readonly special?: boolean;
  readonly requiredCapabilities?: readonly string[];
  readonly forbiddenCapabilities?: readonly string[];
  readonly requiredOwnedIds?: readonly string[];
}
export type AcquisitionOperation =
  | { readonly type: "instance" }
  | { readonly type: "run-upgrade" }
  | {
      readonly type: "attachment";
      readonly hostCategories: readonly string[];
      readonly requiredHostTags?: readonly string[];
      readonly slot?: string;
    };
export interface ShopContext {
  readonly encounterNumber: number;
  readonly schedulePosition: number;
  readonly previousEncounterSpecial: boolean;
  readonly gameplayModuleId: string;
  readonly capabilities: readonly string[];
  readonly currency: number;
  readonly ownedDefinitionIds: readonly string[];
  readonly ownedCategories: readonly string[];
  readonly ownedTags: readonly string[];
  readonly copyCounts: Readonly<Record<string, number>>;
  readonly activeRunUpgrades: readonly string[];
  readonly shopNumber: number;
  readonly rerollNumber: number;
  readonly runTags: readonly string[];
  readonly poolIds: readonly string[];
}
export interface ShopCandidate {
  readonly id: string;
  readonly definitionId: string;
  readonly providerId: string;
  readonly providerVersion: number;
  readonly poolId: string;
  readonly category: string;
  readonly rarity?: string;
  readonly tags: readonly string[];
  readonly groups?: readonly string[];
  readonly weight: number;
  readonly basePrice: number;
  readonly maximumCopies?: number;
  readonly acquisition: AcquisitionOperation;
}
export interface ShopPoolProvider {
  readonly id: string;
  readonly version: number;
  readonly poolIds: readonly string[];
  getCandidates(context: ShopContext): readonly ShopCandidate[];
}
export interface RuntimeStartingLoadout {
  readonly id: string;
  readonly currency: number;
  readonly ownedDefinitionIds: readonly string[];
  readonly capacities: Readonly<Record<string, number>>;
  readonly upgradeIds: readonly string[];
}
/** The only authored-content boundary known by the headless run engine. */
export interface RuntimeContentProvider {
  readonly identity: { readonly packId: string; readonly packVersion: number };
  getDefinition(id: string): RuntimeContentDefinition;
  getStartingLoadout(id: string): RuntimeStartingLoadout;
  listDefinitions(
    context: ContentQueryContext,
  ): readonly RuntimeContentDefinition[];
}
