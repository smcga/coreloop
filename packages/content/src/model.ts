import type { EffectTrigger } from "@core-loop/core";
export const CONTENT_SCHEMA_VERSION = 1;
export const definitionCategories = [
  "playable-object",
  "passive-modifier",
  "consumable",
  "attached-modifier",
  "run-upgrade",
  "reward-container",
  "encounter",
  "special-encounter-rule",
  "shop-pool",
  "starting-loadout",
] as const;
export type DefinitionCategory = (typeof definitionCategories)[number];
export type RarityId =
  "threshold-lab:common" | "threshold-lab:uncommon" | "threshold-lab:rare";
export interface Presentation {
  readonly name: string;
  readonly description: string;
  readonly shortLabel?: string;
  readonly iconKey?: string;
}
export interface Availability {
  readonly encounterMin?: number;
  readonly encounterMax?: number;
  readonly special?: boolean;
  readonly requiredTags?: readonly string[];
  readonly forbiddenTags?: readonly string[];
  readonly requiredOwnedIds?: readonly string[];
  readonly maximumCopies?: number;
  readonly capabilityTags?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly forbiddenCapabilities?: readonly string[];
  readonly supportedModuleIds?: readonly string[];
}
export interface BaseDefinition {
  readonly id: string;
  readonly category: DefinitionCategory;
  readonly tags: readonly string[];
  readonly rarity?: RarityId;
  readonly basePrice?: number;
  readonly weight?: number;
  readonly availability?: Availability;
  readonly presentation: Presentation;
}
export interface TriggerDefinition extends BaseDefinition {
  readonly triggers?: readonly EffectTrigger[];
  readonly initialStoredValues?: Readonly<Record<string, number>> | undefined;
}
export interface PlayableObjectDefinition extends BaseDefinition {
  readonly category: "playable-object";
  readonly baseValues: Readonly<Record<string, number>>;
  readonly compatibleAttachmentTags?: readonly string[];
  readonly gameplay: Readonly<Record<string, unknown>>;
}
export interface PassiveModifierDefinition extends TriggerDefinition {
  readonly category: "passive-modifier";
  readonly attachmentSlots?: number;
  readonly unique?: boolean;
}
export interface ConsumableDefinition extends TriggerDefinition {
  readonly category: "consumable";
  readonly legalPhases: readonly string[];
  readonly operation: "effect" | "duplicate" | "transform" | "attach";
  readonly targetCategories?: readonly DefinitionCategory[] | undefined;
  readonly transformationTargets?: readonly string[] | undefined;
}
export interface AttachedModifierDefinition extends TriggerDefinition {
  readonly category: "attached-modifier";
  readonly hostCategories: readonly ("playable-object" | "passive-modifier")[];
  readonly requiredHostTags?: readonly string[];
  readonly occupiesInventory: boolean;
}
export interface RunUpgradeDefinition extends BaseDefinition {
  readonly category: "run-upgrade";
  readonly changes: Readonly<Record<string, number>>;
}
export interface RewardContainerDefinition extends BaseDefinition {
  readonly category: "reward-container";
  readonly rewardType: "choice" | "currency" | "targeted";
  readonly choiceCount?: number | undefined;
  readonly poolId?: string | undefined;
  readonly currency?: number | undefined;
  readonly targetOperation?: "attach" | "duplicate" | "transform" | undefined;
}
export interface EncounterDefinition extends BaseDefinition {
  readonly category: "encounter";
  readonly targetBase: number;
  readonly playableObjectIds: readonly string[];
  readonly specialRuleIds?: readonly string[];
  readonly rewardContainerIds: readonly string[];
}
export interface SpecialEncounterRuleDefinition extends TriggerDefinition {
  readonly category: "special-encounter-rule";
  readonly severity: number;
}
export interface WeightedEntry {
  readonly definitionId: string;
  readonly weight: number;
}
export interface ShopPoolDefinition extends BaseDefinition {
  readonly category: "shop-pool";
  readonly entries: readonly WeightedEntry[];
  readonly allowDuplicates: boolean;
  readonly categories?: readonly DefinitionCategory[];
}
export interface StartingLoadoutDefinition extends BaseDefinition {
  readonly category: "starting-loadout";
  readonly currency: number;
  readonly ownedDefinitionIds: readonly string[];
  readonly capacities: Readonly<Partial<Record<DefinitionCategory, number>>>;
  readonly upgradeIds?: readonly string[];
}
export type ContentDefinition =
  | PlayableObjectDefinition
  | PassiveModifierDefinition
  | ConsumableDefinition
  | AttachedModifierDefinition
  | RunUpgradeDefinition
  | RewardContainerDefinition
  | EncounterDefinition
  | SpecialEncounterRuleDefinition
  | ShopPoolDefinition
  | StartingLoadoutDefinition;
export const terminologyKeys = [
  "run",
  "stage",
  "encounter",
  "special-encounter",
  "playable-object",
  "passive-modifier",
  "consumable",
  "attached-modifier",
  "run-upgrade",
  "reward-container",
  "shop",
  "currency",
  "score",
  "target",
  "inventory",
  "reroll",
  "buy",
  "sell",
] as const;
export type TerminologyKey = (typeof terminologyKeys)[number];
export interface Term {
  readonly singular: string;
  readonly plural: string;
  readonly short?: string;
}
export interface TerminologyPack {
  readonly id: string;
  readonly terms: Readonly<Record<TerminologyKey, Term>>;
  readonly applicationTitle?: string;
}
export interface RarityDefinition {
  readonly id: RarityId;
  readonly defaultWeight: number;
  readonly priceMultiplier: number;
  readonly presentation: Presentation;
}
export interface ContentPack {
  readonly id: string;
  readonly version: number;
  readonly schemaVersion: number;
  readonly metadata: Presentation;
  readonly tags?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly definitions: readonly ContentDefinition[];
  readonly rarities: readonly RarityDefinition[];
  readonly terminology: readonly TerminologyPack[];
  readonly defaultTerminologyId: string;
  readonly presentation?: Readonly<Record<string, string>>;
}
export interface ContentInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly storedValues: Readonly<Record<string, number>>;
  readonly disabled: boolean;
  readonly expiresAfterEncounter?: number | undefined;
  readonly temporaryTags: readonly string[];
  readonly attachmentIds: readonly string[];
  readonly hostInstanceId?: string | undefined;
  readonly transformationHistory: readonly string[];
}
export interface InstanceCounters {
  readonly nextInstanceId: number;
}
