import type { Inventory } from "../run/reducer";

/** Count live, top-level inventory instances in a content category. */
export function inventoryCategoryCount(
  inventory: Readonly<Inventory>,
  categoryByDefinition: (definitionId: string) => string | undefined,
  category: string,
  occupiesCapacity: (definitionId: string) => boolean = () => true,
): number {
  return inventory.instances.filter(
    (instance) =>
      categoryByDefinition(instance.definitionId) === category &&
      occupiesCapacity(instance.definitionId),
  ).length;
}

export function hasInventoryCapacity(
  inventory: Readonly<Inventory>,
  categoryByDefinition: (definitionId: string) => string | undefined,
  category: string,
  occupiesCapacity?: (definitionId: string) => boolean,
): boolean {
  return (
    inventoryCategoryCount(
      inventory,
      categoryByDefinition,
      category,
      occupiesCapacity,
    ) < (inventory.capacities[category] ?? 0)
  );
}
