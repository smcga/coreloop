import type {
  ContentQueryContext,
  RuntimeContentDefinition,
  RuntimeContentProvider,
  RuntimeStartingLoadout,
  ShopContext,
  ShopPoolProvider,
} from "@core-loop/core";
import { ContentRegistry, isDefinitionCompatible } from "./registry";

const runtimeDefinition = (
  definition: ReturnType<ContentRegistry["get"]>,
): RuntimeContentDefinition => {
  if (definition.category === "starting-loadout")
    throw new Error(
      `'${definition.id}' is a loadout, not runtime-owned content`,
    );
  const triggered = "triggers" in definition ? definition : undefined;
  return Object.freeze({
    id: definition.id,
    category: definition.category,
    tags: definition.tags,
    ...(definition.groups ? { groups: definition.groups } : {}),
    ...(definition.rarity ? { rarity: definition.rarity } : {}),
    ...(definition.basePrice !== undefined
      ? { basePrice: definition.basePrice }
      : {}),
    ...(definition.weight !== undefined ? { weight: definition.weight } : {}),
    ...(definition.availability
      ? {
          availability: definition.availability,
          maximumCopies: definition.availability.maximumCopies,
        }
      : {}),
    sellable: definition.category !== "attached-modifier",
    occupiesCapacity:
      definition.category !== "attached-modifier" ||
      definition.occupiesInventory,
    ...(triggered?.initialStoredValues
      ? { initialStoredValues: triggered.initialStoredValues }
      : {}),
    ...(triggered?.triggers ? { triggers: triggered.triggers } : {}),
    ...(definition.category === "consumable" &&
    definition.operation === "effect"
      ? { use: { type: "encounter-effect" as const } }
      : {}),
    ...(definition.category === "attached-modifier"
      ? {
          hostCategories: definition.hostCategories,
          requiredHostTags: definition.requiredHostTags,
          attachmentSlot: definition.slot,
          acquisition: {
            type: "attachment" as const,
            hostCategories: definition.hostCategories,
            ...(definition.requiredHostTags
              ? { requiredHostTags: definition.requiredHostTags }
              : {}),
            ...(definition.slot ? { slot: definition.slot } : {}),
          },
        }
      : {}),
    ...(definition.category === "run-upgrade"
      ? {
          upgradeChanges: definition.changes,
          acquisition: { type: "run-upgrade" as const },
        }
      : {}),
  });
};

/** Adapts validated authored content without leaking presentation into core state. */
export function createRuntimeContentProvider(
  registry: ContentRegistry,
): RuntimeContentProvider {
  return Object.freeze({
    identity: { packId: registry.pack.id, packVersion: registry.pack.version },
    getDefinition: (id: string) => runtimeDefinition(registry.get(id)),
    getStartingLoadout: (id: string): RuntimeStartingLoadout => {
      const definition = registry.getAs(id, "starting-loadout");
      return {
        id,
        currency: definition.currency,
        ownedDefinitionIds: definition.ownedDefinitionIds,
        capacities: definition.capacities,
        upgradeIds: definition.upgradeIds ?? [],
      };
    },
    listDefinitions: (context: ContentQueryContext) =>
      registry.pack.definitions
        .filter((definition) => definition.category !== "starting-loadout")
        .filter((definition) =>
          isDefinitionCompatible(definition, {
            id: context.gameplayModuleId,
            capabilities: context.capabilities ?? [],
          }),
        )
        .map(runtimeDefinition),
  });
}

/** Converts authored pools to deterministic, presentation-free shop candidates. */
export function createShopPoolProviders(
  registry: ContentRegistry,
): readonly ShopPoolProvider[] {
  return registry.pack.definitions
    .filter((definition) => definition.category === "shop-pool")
    .map((pool) =>
      Object.freeze({
        id: `${registry.pack.id}:shop-provider`,
        version: registry.pack.version,
        poolIds: [pool.id],
        getCandidates: (context: ShopContext) =>
          pool.entries.flatMap((entry) => {
            const authored = registry.get(entry.definitionId);
            if (pool.categories && !pool.categories.includes(authored.category))
              return [];
            if (
              !isDefinitionCompatible(authored, {
                id: context.gameplayModuleId,
                capabilities: context.capabilities,
              })
            )
              return [];
            const availability = authored.availability;
            if (
              (availability?.encounterMin ?? 0) > context.encounterNumber ||
              (availability?.encounterMax ?? Infinity) < context.encounterNumber
            )
              return [];
            if (
              availability?.special !== undefined &&
              availability.special !== context.previousEncounterSpecial
            )
              return [];
            if (
              availability?.requiredOwnedIds?.some(
                (id) => !context.ownedDefinitionIds.includes(id),
              )
            )
              return [];
            const definition = runtimeDefinition(authored);
            return [
              {
                id: `${pool.id}:${authored.id}`,
                definitionId: authored.id,
                providerId: `${registry.pack.id}:shop-provider`,
                providerVersion: registry.pack.version,
                poolId: pool.id,
                category: authored.category,
                ...(authored.rarity ? { rarity: authored.rarity } : {}),
                tags: authored.tags,
                ...(authored.groups ? { groups: authored.groups } : {}),
                weight: entry.weight,
                basePrice: authored.basePrice ?? 0,
                ...(availability?.maximumCopies !== undefined
                  ? { maximumCopies: availability.maximumCopies }
                  : {}),
                acquisition: definition.acquisition ?? {
                  type: "instance" as const,
                },
              },
            ];
          }),
      }),
    );
}
