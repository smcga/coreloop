import {
  createGameplayModuleRegistry,
  createHeadlessRunSession,
  defaultPolicies,
  type GameplayContextProjection,
  type RunConfiguration,
} from "@core-loop/core";
import {
  diceContentPack,
  diceContentProvider,
  diceShopProviders,
} from "./content.js";
import { diceModule } from "./gameplay.js";

export const diceProjection: GameplayContextProjection = {
  id: "dice:owned-dice",
  version: 1,
  moduleId: diceModule.id,
  project: ({ inventory }) => ({
    dice: inventory.instances
      .filter((item) => item.category === "playable-object")
      .map((item) => ({
        id: item.instanceId,
        sides: item.storedValues.value ?? 6,
      })),
  }),
};

/** TODO after generating: rename this policy ID and tune the authored curve. */
export const dicePolicies = {
  ...defaultPolicies,
  schedule: {
    id: "dice:four-challenges",
    version: 1,
    createSchedule: () =>
      Array.from({ length: 4 }, (_, index) => ({
        id: `challenge-${index + 1}`,
        ordinal: index + 1,
        kind: index === 3 ? "special" : "ordinary",
        rules: index === 3 ? [{ id: "dice:last-step", version: 1 }] : [],
      })),
  },
  target: {
    id: "dice:dice-targets",
    version: 1,
    targetForEncounter: ({ entry }: { entry: { ordinal: number } }) =>
      12 + entry.ordinal,
  },
  outcome: {
    id: "dice:practice-outcome",
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

export const diceRunConfiguration: RunConfiguration = {
  policies: dicePolicies,
  content: diceContentProvider,
  defaultLoadoutId: "dice:balanced",
  shopProviders: diceShopProviders,
  gameplayCapabilities: { [diceModule.id]: diceModule.capabilities },
  gameplayProjection: diceProjection,
  rarityPriceMultipliers: Object.fromEntries(
    diceContentPack.rarities.map((r) => [r.id, r.priceMultiplier]),
  ),
};

export const diceModules = createGameplayModuleRegistry([diceModule]);
export const diceSession = createHeadlessRunSession({
  configuration: diceRunConfiguration,
  modules: diceModules,
});
