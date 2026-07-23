import type { CustomEffectHandler, TargetPolicy } from "@core-loop/core";

/** Application-owned proof that extension registration needs no core edits. */
export const steepTargetPolicy: TargetPolicy = {
  id: "threshold-lab:steep-targets",
  version: 1,
  targetForEncounter: ({ encounterNumber }) => 20 + encounterNumber * 7,
};

/** Adds a deterministic encounter tag through the typed effect result. */
export const reverseMeterDirectionEffect: CustomEffectHandler = ({
  state,
}) => ({
  state: {
    ...state,
    encounterTags: [...state.encounterTags, "reverse-meter-direction"],
  },
  events: [],
});
