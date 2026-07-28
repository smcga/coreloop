import { nextUint32, type RandomState } from "../random";
import {
  defaultPolicies,
  type EncounterScheduleEntry,
  type StageContext,
} from "../policies";
import type { EncounterBrief, RunConfiguration } from "../run/reducer";

/** Convert a schedule entry into the gameplay-neutral brief consumed by a module. */
export function prepareEncounter(
  state: RandomState,
  entry: EncounterScheduleEntry,
  configuration: RunConfiguration,
  stage?: StageContext,
): { readonly rng: RandomState; readonly brief: EncounterBrief } {
  const policies = configuration.policies ?? defaultPolicies;
  const derived = nextUint32(state);
  const scalarTarget = policies.target.targetForEncounter({
    entry,
    rng: state,
    stage,
  });
  return {
    rng: derived.state,
    brief: {
      id: entry.id,
      number: entry.ordinal,
      target: scalarTarget,
      requirements: policies.target.requirementsForEncounter?.({
        entry,
        rng: state,
        stage,
      }) ?? {
        targets: { score: scalarTarget },
        objectives: [],
        limits: {},
      },
      rules: entry.rules,
      moduleSeed: derived.value,
    },
  };
}
