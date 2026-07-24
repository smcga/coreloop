export const SIMULATION_REPORT_VERSION = 1;

export interface SimulationRequest {
  readonly contentPackId: string;
  readonly gameplayModuleId: string;
  readonly policySetId: string;
  readonly loadoutId: string;
  readonly strategyId: string;
  readonly runCount: number;
  readonly seedStart: number;
  readonly maxOutliers: number;
}

export interface EncounterMetrics {
  readonly encounter: number;
  readonly attempts: number;
  readonly wins: number;
  readonly winRate: number;
  readonly averageScore: number;
  readonly medianScore: number;
  readonly minimumScore: number;
  readonly maximumScore: number;
  readonly averageTarget: number;
  readonly scoreToTargetRatio: number;
  readonly averageOverkill: number;
  readonly averageFailureMargin: number;
  readonly specialFrequency: number;
  readonly specialFailureRate: number;
}

export interface ContentMetrics {
  readonly definitionId: string;
  readonly eligible: number;
  readonly offered: number;
  readonly purchased: number;
  readonly sold: number;
  readonly triggered: number;
  readonly scoreContribution: number;
  readonly currencyContribution: number;
  readonly averageEncounterAcquired: number | null;
}

export interface SimulationReport {
  readonly reportFormatVersion: number;
  readonly frameworkVersion: string;
  readonly content: { readonly id: string; readonly version: number };
  readonly module: { readonly id: string; readonly version: number };
  readonly policySet: { readonly id: string; readonly version: number };
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
    readonly message: string;
  }[];
}
