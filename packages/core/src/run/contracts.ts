import type {
  EffectDiagnostic,
  EffectHandlerRegistry,
  EffectRuntimeEvent,
  ScoreLedgerEntry,
  EffectDefinition,
} from "../effects";
import type {
  GameplayContextProjection,
  GameplaySessionState,
  RuleReference,
} from "../gameplay";
import type {
  AcquisitionOperation,
  RuntimeContentProvider,
  ShopPoolProvider,
} from "../content";
import type {
  EncounterOutcome,
  EncounterReward,
  EncounterScheduleEntry,
  PolicyReference,
  PostEncounterDestination,
  RunPolicyKey,
  RunPolicySet,
  StageScheduleEntry,
} from "../policies";
import type { RandomState } from "../random";

export interface RunConfiguration {
  readonly policies?: RunPolicySet;
  readonly content?: RuntimeContentProvider;
  readonly defaultLoadoutId?: string;
  readonly shopProviders?: readonly ShopPoolProvider[];
  readonly gameplayCapabilities?: Readonly<Record<string, readonly string[]>>;
  /** Encounter-scoped allowance baselines, supplied by registered modules. */
  readonly gameplayAllowanceDefaults?: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
  readonly rarityPriceMultipliers?: Readonly<Record<string, number>>;
  readonly gameplayProjection?: GameplayContextProjection;
  /** Generic effect packages activated by matching prepared rule references. */
  readonly encounterRuleEffects?: Readonly<Record<string, EffectDefinition>>;
  /** Immutable after composition; all custom operations execute through it. */
  readonly effectHandlers?: EffectHandlerRegistry;
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
export interface RewardOption {
  readonly id: string;
  readonly definitionId: string;
  readonly acquisition: AcquisitionOperation;
}
export type PendingReward =
  | {
      readonly type: "container";
      readonly definitionId: string;
      readonly remaining: readonly EncounterReward[];
      readonly completesRun: boolean;
    }
  | {
      readonly type: "choice";
      readonly definitionId: string;
      readonly options: readonly RewardOption[];
      readonly remainingChoices: number;
      readonly selectedDefinitionIds: readonly string[];
      readonly remaining: readonly EncounterReward[];
      readonly completesRun: boolean;
    }
  | {
      readonly type: "target";
      readonly definitionId: string;
      readonly option: RewardOption;
      readonly selectedDefinitionIds: readonly string[];
      readonly remaining: readonly EncounterReward[];
      readonly completesRun: boolean;
    };
export interface CompletedReward {
  readonly definitionId?: string;
  readonly selectedDefinitionIds: readonly string[];
}
export interface EncounterBrief {
  readonly id: string;
  readonly number: number;
  readonly target: number;
  readonly requirements: EncounterRequirements;
  readonly rules: readonly RuleReference[];
  /** Derived by consuming exactly one value from the authoritative run RNG. */
  readonly moduleSeed: number;
}
export interface ObjectiveRequirement {
  readonly key: string;
  readonly expected?: boolean;
}
export interface EncounterRequirements {
  readonly targets: Readonly<Record<string, number>>;
  readonly objectives: readonly ObjectiveRequirement[];
  readonly limits: Readonly<Record<string, number>>;
}
export interface GameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
}
export interface EncounterReport {
  readonly encounterId: string;
  /** Scalar compatibility view of tracks.score. */
  readonly score: number;
  readonly tracks?: Readonly<Record<string, number>>;
  readonly objectives?: Readonly<Record<string, boolean>>;
  readonly resources?: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly statistics?: Readonly<Record<string, number>>;
  readonly signals: readonly GameplaySignal[];
}
export interface ScoreLine {
  readonly track?: string;
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
  readonly stages: readonly StageScheduleEntry[];
  readonly progress: {
    readonly stagePosition: number;
    readonly encounterPositionInStage: number;
  };
  readonly policyReferences: Readonly<Record<RunPolicyKey, PolicyReference>>;
  readonly currentEncounter: EncounterBrief | null;
  readonly currency: number;
  readonly inventory: Inventory;
  readonly shop: ShopState | null;
  readonly pendingAcquisition: PendingAcquisition | null;
  readonly pendingReward: PendingReward | null;
  /** The policy-resolved destination; hosts may render it but cannot replace it. */
  readonly pendingRoute: PostEncounterDestination | null;
  readonly shopCount: number;
  readonly rewardHistory: readonly CompletedReward[];
  readonly nextRewardOptionId: number;
  readonly nextInstanceId: number;
  readonly nextOfferId: number;
  readonly lastReport: EncounterReport | null;
  readonly lastOutcome: EncounterOutcome | null;
  readonly scoreBreakdown: readonly ScoreLine[];
  readonly scoreLedger: readonly ScoreLedgerEntry[];
  readonly gameplayModuleId: string;
  readonly loadoutId: string | null;
  readonly gameplaySession: GameplaySessionState | null;
  readonly encounterEffects: readonly ContentInstance[];
  /** Persistent inputs and counters owned by the deterministic effect transaction. */
  readonly effects: RunEffectState;
}
export interface RunEffectState {
  readonly priceModifier: number;
  readonly allowances: Readonly<Record<string, number>>;
  readonly encounterTags: readonly string[];
  readonly runTags: readonly string[];
  readonly nextSignalSequence: number;
  readonly nextEventSequence: number;
  readonly diagnostics: readonly EffectDiagnostic[];
}
export type RunCommand =
  | {
      readonly type: "start-run";
      readonly seed: number;
      readonly gameplayModuleId?: string;
      readonly loadoutId?: string;
    }
  | {
      /** @deprecated Internal coordinator command; hosts use handleGameplayAction. */
      readonly type: "store-gameplay-session";
      readonly session: GameplaySessionState;
      /** Accepted module action facts, in authored order. */
      readonly actionId?: string;
      readonly signals?: readonly GameplaySignal[];
    }
  | { readonly type: "start-encounter" }
  | {
      /** @deprecated Internal coordinator command; reports are module-authored. */
      readonly type: "submit-encounter";
      readonly report: EncounterReport;
    }
  | { readonly type: "enter-shop" }
  | { readonly type: "open-reward-container" }
  | { readonly type: "choose-reward"; readonly optionId: string }
  | {
      readonly type: "choose-reward-target";
      readonly optionId: string;
      readonly targetInstanceId: string;
    }
  | { readonly type: "skip-reward" }
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
  | { readonly type: "advance" }
  | { readonly type: "continue" };
type RunEventFact =
  | { readonly type: "run-started"; readonly seed: number }
  | {
      readonly type: "stage-started";
      readonly stageId: string;
      readonly ordinal: number;
    }
  | {
      readonly type: "stage-completed";
      readonly stageId: string;
      readonly ordinal: number;
    }
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
  | { readonly type: "reward-container-opened"; readonly definitionId: string }
  | {
      readonly type: "reward-options-generated";
      readonly options: readonly RewardOption[];
    }
  | {
      readonly type: "reward-selected";
      readonly optionId: string;
      readonly definitionId: string;
    }
  | { readonly type: "reward-target-requested"; readonly optionId: string }
  | {
      readonly type: "reward-target-resolved";
      readonly optionId: string;
      readonly targetInstanceId: string;
    }
  | { readonly type: "reward-completed"; readonly definitionId?: string }
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
  | { readonly type: "instance-expired"; readonly instanceId: string }
  | {
      readonly type: "effect-runtime";
      readonly fact: EffectRuntimeEvent;
    }
  | {
      readonly type: "command-rejected";
      readonly command: RunCommand["type"];
      readonly phase: RunPhase;
      readonly reason: string;
    };
export type RunEvent = RunEventFact & { readonly sequence?: number };
export interface TransitionResult {
  readonly state: RunState;
  readonly events: readonly RunEvent[];
}
