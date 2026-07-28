import type {
  GameplayModuleRegistry,
  GameplayOperationRegistry,
  RunConfiguration,
  RunState,
} from "@core-loop/core";

export const SIMULATION_REPORT_VERSION = 2;

export interface SimulationDefaults {
  readonly gameplayModuleId: string;
  readonly policySetId: string;
  readonly strategyId: string;
  readonly economyStrategyId: string;
  readonly loadoutId: string;
}

export interface SimulationStrategy {
  readonly id: string;
  readonly compatibleModuleIds?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  nextAction(context: {
    readonly state: unknown;
    readonly run: Readonly<RunState>;
    readonly moduleId: string;
  }): unknown;
}

export interface EconomyStrategy {
  readonly id: string;
  nextCommand(context: {
    readonly state: Readonly<RunState>;
    readonly definitionFor: (
      id: string,
    ) =>
      | { readonly category: string; readonly occupiesCapacity: boolean }
      | undefined;
  }): import("@core-loop/core").RunCommand;
}

export interface SimulationComposition {
  readonly id: string;
  readonly version: number;
  readonly provider: { readonly id: string; readonly version: number };
  readonly content: { readonly id: string; readonly version: number };
  readonly configuration: RunConfiguration;
  readonly modules: GameplayModuleRegistry;
  readonly operations?: GameplayOperationRegistry;
  readonly policySets: readonly {
    readonly id: string;
    readonly version: number;
  }[];
  readonly strategies: readonly SimulationStrategy[];
  readonly economyStrategies: readonly EconomyStrategy[];
  readonly defaults: SimulationDefaults;
}

export interface SimulationRequest {
  readonly compositionId: string;
  readonly contentPackId: string;
  readonly gameplayModuleId: string;
  readonly policySetId: string;
  readonly loadoutId: string;
  readonly strategyId: string;
  readonly economyStrategyId: string;
  readonly runCount: number;
  readonly seedStart: number;
  readonly maxOutliers: number;
  readonly maxCommands: number;
}

export interface EncounterMetrics {
  readonly position: number;
  readonly encounterId: string;
  readonly kind: string;
  readonly ruleIds: readonly string[];
  readonly attempts: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly tracks: readonly TrackMetrics[];
}
export interface TrackMetrics {
  readonly id: string;
  readonly average: number;
  readonly median: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly averageTarget: number | null;
}
export interface ContentMetrics {
  readonly definitionId: string;
  readonly eligible: number;
  readonly offered: number;
  readonly acquired: number;
  readonly purchased: number;
  readonly sold: number;
  readonly used: number;
  readonly triggered: number;
  readonly scoreContribution: Readonly<Record<string, number>>;
  readonly currencyContribution: number;
  readonly averageEncounterAcquired: number | null;
}
export interface SimulationReport {
  readonly reportFormatVersion: number;
  readonly frameworkVersion: string;
  readonly composition: { readonly id: string; readonly version: number };
  readonly provider: { readonly id: string; readonly version: number };
  readonly content: { readonly id: string; readonly version: number };
  readonly module: { readonly id: string; readonly version: number };
  readonly policySet: { readonly id: string; readonly version: number };
  readonly strategy: { readonly id: string };
  readonly economyStrategy: { readonly id: string };
  readonly request: SimulationRequest;
  readonly outcomes: {
    readonly total: number;
    readonly completed: number;
    readonly failed: number;
    readonly aborted: number;
    readonly completionRate: number;
    readonly averageEncounterReached: number;
    readonly averageCommands: number;
    readonly unusedCurrencyAverage: number;
  };
  readonly encounters: readonly EncounterMetrics[];
  readonly economy: {
    readonly currencyEarned: number;
    readonly currencySpent: number;
    readonly purchases: number;
    readonly rerolls: number;
    readonly sales: number;
    readonly phaseFrequency: Readonly<Record<string, number>>;
    readonly averagePurchasePrice: number;
  };
  readonly contentMetrics: readonly ContentMetrics[];
  readonly reachability: readonly {
    readonly type: string;
    readonly id: string;
  }[];
  readonly outliers: readonly {
    readonly seed: number;
    readonly score: number;
    readonly currency: number;
  }[];
  readonly diagnostics: readonly {
    readonly seed: number;
    readonly code: string;
    readonly message: string;
  }[];
}
