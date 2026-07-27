import {
  createGameplayModuleRegistry,
  createHeadlessRunSession,
  defaultPolicies,
  type RunConfiguration,
} from "@core-loop/core";
import {
  starterContentPack,
  starterContentProvider,
  starterShopProviders,
} from "./content";
import { choiceModule } from "./gameplay";

/** TODO after generating: rename this policy ID and tune the authored curve. */
export const starterPolicies = {
  ...defaultPolicies,
  schedule: {
    id: "starter:four-challenges",
    version: 1,
    createSchedule: () =>
      Array.from({ length: 4 }, (_, index) => ({
        id: `challenge-${index + 1}`,
        ordinal: index + 1,
        kind: index === 3 ? "special" : "ordinary",
        rules: index === 3 ? [{ id: "starter:last-step", version: 1 }] : [],
      })),
  },
  target: {
    id: "starter:choice-targets",
    version: 1,
    targetForEncounter: ({ entry }: { entry: { ordinal: number } }) =>
      12 + entry.ordinal,
  },
  outcome: {
    id: "starter:practice-outcome",
    version: 1,
    evaluate: ({
      encounterWon,
      hasNextEncounter,
    }: {
      encounterWon: boolean;
      hasNextEncounter: boolean;
    }) =>
      hasNextEncounter
        ? null
        : encounterWon
          ? ("won" as const)
          : ("lost" as const),
  },
};

export const starterRunConfiguration: RunConfiguration = {
  policies: starterPolicies,
  content: starterContentProvider,
  defaultLoadoutId: "starter:balanced",
  shopProviders: starterShopProviders,
  gameplayCapabilities: { [choiceModule.id]: choiceModule.capabilities },
  rarityPriceMultipliers: Object.fromEntries(
    starterContentPack.rarities.map((r) => [r.id, r.priceMultiplier]),
  ),
};

export const starterModules = createGameplayModuleRegistry([choiceModule]);
export const starterSession = createHeadlessRunSession({
  configuration: starterRunConfiguration,
  modules: starterModules,
});
