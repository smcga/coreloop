import {
  ContentRegistry,
  createRuntimeContentProvider,
  createShopPoolProviders,
} from "@core-loop/content";
import {
  createGameplayModuleRegistry,
  createHeadlessRunSession,
  defaultPolicies,
  type RunPolicySet,
  type GameplayContextProjection,
} from "@core-loop/core";
import { gardenContentPack } from "./content";
import { gardenModule } from "./gameplay";

/** Five authored entries replace every former round-number/modulo branch. */
export const gardenPolicies: RunPolicySet = {
  encounterOutcome: defaultPolicies.encounterOutcome,
  start: {
    id: "garden-loop:season-start",
    version: 1,
    initialCurrency: ({ loadoutCurrency }) => loadoutCurrency,
  },
  schedule: {
    id: "garden-loop:five-session-season",
    version: 1,
    createSchedule: () => [
      { id: "spring-bed", ordinal: 1, kind: "ordinary", rules: [] },
      { id: "early-summer", ordinal: 2, kind: "ordinary", rules: [] },
      {
        id: "dry-spell",
        ordinal: 3,
        kind: "special",
        rules: [
          {
            id: "garden-loop:dry-spell",
            version: 1,
            payload: { waterPenalty: 1 },
          },
        ],
      },
      { id: "late-summer", ordinal: 4, kind: "ordinary", rules: [] },
      {
        id: "severe-storm",
        ordinal: 5,
        kind: "special",
        rules: [
          {
            id: "garden-loop:severe-storm",
            version: 1,
            payload: { minimumResilience: 6 },
          },
        ],
      },
    ],
  },
  target: {
    id: "garden-loop:harvest-curve",
    version: 1,
    targetForEncounter: ({ entry }) =>
      9 + entry.ordinal + (entry.kind === "special" ? 1 : 0),
  },
  reward: {
    id: "garden-loop:compost-reward",
    version: 1,
    rewardForEncounter: ({ entry }) => 3 + entry.ordinal,
  },
  shopGeneration: {
    id: "garden-loop:garden-centre-offers",
    version: 1,
    offerCount: ({ entry }) =>
      entry.ordinal === 2 || entry.ordinal === 4 ? 3 : 2,
  },
  shopPricing: {
    id: "garden-loop:compost-pricing",
    version: 1,
    offerPrice: ({ basePrice, rarityMultiplier = 1, priceAdjustment = 0 }) =>
      Math.max(0, Math.round(basePrice * rarityMultiplier + priceAdjustment)),
    rerollPrice: ({ rerollCount }) => 2 + rerollCount,
    sellPrice: ({ basePrice }) => Math.max(1, Math.floor(basePrice / 2)),
  },
  inventory: {
    id: "garden-loop:shed-capacity",
    version: 1,
    limitFor: (_category, loadoutLimit) => loadoutLimit,
  },
  outcome: {
    id: "garden-loop:one-ordinary-setback",
    version: 1,
    evaluate: ({ entry, encounterWon, hasNextEncounter }) =>
      encounterWon
        ? hasNextEncounter
          ? null
          : "won"
        : entry.ordinal === 1
          ? null
          : "lost",
  },
};

export const gardenRegistry = new ContentRegistry(gardenContentPack);
export const gardenGameplayProjection: GameplayContextProjection = {
  id: "garden-loop:owned-plants",
  version: 1,
  moduleId: gardenModule.id,
  project: ({ inventory }) => ({
    plants: inventory.instances
      .filter(
        (instance) =>
          instance.category === "playable-object" &&
          !instance.disabled &&
          !instance.destroyed &&
          !instance.hostInstanceId,
      )
      .map((instance) => ({
        instanceId: instance.instanceId,
        definitionId: instance.definitionId,
        growth: instance.storedValues.growth ?? 0,
        water: instance.storedValues.water ?? 0,
        resilience:
          (instance.storedValues.resilience ?? 0) +
          (instance.attachmentIds.some((id) => {
            const attachment = inventory.instances.find(
              (candidate) => candidate.instanceId === id,
            );
            return attachment?.definitionId === "garden-loop:deep-rooted";
          })
            ? 2
            : 0),
      })),
  }),
};
export const gardenRunConfiguration = {
  policies: gardenPolicies,
  content: createRuntimeContentProvider(gardenRegistry),
  defaultLoadoutId: "garden-loop:balanced-bed",
  shopProviders: createShopPoolProviders(gardenRegistry),
  gameplayCapabilities: { [gardenModule.id]: gardenModule.capabilities },
  rarityPriceMultipliers: Object.fromEntries(
    gardenContentPack.rarities.map((rarity) => [
      rarity.id,
      rarity.priceMultiplier,
    ]),
  ),
  gameplayProjection: gardenGameplayProjection,
} as const;

export const gardenModules = createGameplayModuleRegistry([gardenModule]);
export const createGardenSession = () =>
  createHeadlessRunSession({
    configuration: gardenRunConfiguration,
    modules: gardenModules,
  });
