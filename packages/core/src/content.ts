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
  readonly occupiesCapacity: boolean;
  readonly initialStoredValues?: Readonly<Record<string, number>>;
  readonly triggers?: readonly EffectTrigger[];
  readonly use?:
    | { readonly type: "encounter-effect" }
    | { readonly type: "custom"; readonly handler: RuleReference };
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
