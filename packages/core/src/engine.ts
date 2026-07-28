/**
 * Public run-engine facade.
 *
 * Implementation details live in the domain modules under `run`, `encounters`,
 * `economy`, and `effects`; consumers should continue importing from this file
 * (or the package root).
 */
export {
  CONTENT_VERSION,
  createInitialRunState,
  createRunEngine,
  definitionFor,
  handle,
} from "./run/reducer";
export type {
  CompletedReward,
  ContentInstance,
  EncounterBrief,
  EncounterReport,
  EncounterRequirements,
  GameplaySignal,
  Inventory,
  ObjectiveRequirement,
  PendingAcquisition,
  PendingReward,
  RewardOption,
  RunCommand,
  RunConfiguration,
  RunEffectState,
  RunEvent,
  RunPhase,
  RunState,
  ScoreLine,
  ShopOffer,
  ShopState,
  TransitionResult,
} from "./run/reducer";
