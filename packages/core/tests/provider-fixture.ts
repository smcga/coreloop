import type { RuntimeContentDefinition, RuntimeContentProvider } from "../src";
export function provider(
  definitions: readonly RuntimeContentDefinition[],
  ownedDefinitionIds: readonly string[] = [],
): RuntimeContentProvider {
  return {
    identity: { packId: "test:pack", packVersion: 1 },
    getDefinition(id) {
      const value = definitions.find((item) => item.id === id);
      if (!value) throw new Error(`unknown ${id}`);
      return value;
    },
    getStartingLoadout(id) {
      if (id !== "test:loadout") throw new Error(`unknown ${id}`);
      return {
        id,
        currency: 10,
        ownedDefinitionIds,
        capacities: { "passive-modifier": 4, consumable: 2 },
        upgradeIds: [],
      };
    },
    listDefinitions() {
      return definitions;
    },
  };
}
