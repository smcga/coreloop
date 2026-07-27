import type {
  ContentQueryContext,
  RuntimeContentDefinition,
  RuntimeContentProvider,
  RuntimeStartingLoadout,
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
