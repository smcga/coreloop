import { nextUint32, type RandomState } from "@core-loop/core";
import type {
  ContentInstance,
  DefinitionCategory,
  InstanceCounters,
  WeightedEntry,
} from "./model";
import { ContentRegistry } from "./registry";

export function createInstance(
  registry: ContentRegistry,
  definitionId: string,
  counters: InstanceCounters,
) {
  const definition = registry.get(definitionId);
  if (
    ![
      "playable-object",
      "passive-modifier",
      "consumable",
      "attached-modifier",
      "run-upgrade",
    ].includes(definition.category)
  )
    throw new Error(`${definitionId} cannot be instantiated`);
  const storedValues =
    "initialStoredValues" in definition
      ? (definition.initialStoredValues ?? {})
      : {};
  const instance: ContentInstance = {
    instanceId: `instance-${counters.nextInstanceId}`,
    definitionId,
    storedValues: { ...storedValues },
    disabled: false,
    temporaryTags: [],
    attachmentIds: [],
    transformationHistory: [],
  };
  return {
    instance,
    counters: { nextInstanceId: counters.nextInstanceId + 1 },
  };
}
export function attach(
  registry: ContentRegistry,
  instances: readonly ContentInstance[],
  attachmentId: string,
  hostId: string,
): readonly ContentInstance[] {
  const attachment = instances.find((i) => i.instanceId === attachmentId),
    host = instances.find((i) => i.instanceId === hostId);
  if (!attachment || !host)
    throw new Error("Attachment and host instances must exist");
  const a = registry.getAs(attachment.definitionId, "attached-modifier"),
    h = registry.get(host.definitionId);
  if (
    !a.hostCategories.includes(
      h.category as "playable-object" | "passive-modifier",
    ) ||
    a.requiredHostTags?.some((tag) => !h.tags.includes(tag))
  )
    throw new Error(
      `${attachment.definitionId} is incompatible with ${host.definitionId}`,
    );
  const slots =
    h.category === "passive-modifier" ? (h.attachmentSlots ?? 1) : 1;
  if (host.attachmentIds.length >= slots)
    throw new Error(`${host.instanceId} has no attachment capacity`);
  return instances.map((i) =>
    i.instanceId === hostId
      ? { ...i, attachmentIds: [...i.attachmentIds, attachmentId] }
      : i.instanceId === attachmentId
        ? { ...i, hostInstanceId: hostId }
        : i,
  );
}
export function detach(
  instances: readonly ContentInstance[],
  attachmentId: string,
): readonly ContentInstance[] {
  const attachment = instances.find((i) => i.instanceId === attachmentId);
  if (!attachment?.hostInstanceId) return instances;
  return instances.map((i) =>
    i.instanceId === attachment.hostInstanceId
      ? {
          ...i,
          attachmentIds: i.attachmentIds.filter((id) => id !== attachmentId),
        }
      : i.instanceId === attachmentId
        ? { ...i, hostInstanceId: undefined }
        : i,
  );
}
export function duplicateInstance(
  registry: ContentRegistry,
  instances: readonly ContentInstance[],
  instanceId: string,
  counters: InstanceCounters,
) {
  const source = instances.find((i) => i.instanceId === instanceId);
  if (!source) throw new Error(`Unknown instance '${instanceId}'`);
  const definition = registry.get(source.definitionId);
  if ("unique" in definition && definition.unique)
    throw new Error(`${source.definitionId} is unique`);
  const created = createInstance(registry, source.definitionId, counters);
  return {
    instances: [
      ...instances,
      {
        ...created.instance,
        storedValues: { ...source.storedValues },
        transformationHistory: [...source.transformationHistory],
      },
    ],
    counters: created.counters,
  };
}
export function transformInstance(
  registry: ContentRegistry,
  instances: readonly ContentInstance[],
  instanceId: string,
  targetId: string,
): readonly ContentInstance[] {
  const source = instances.find((i) => i.instanceId === instanceId);
  if (!source) throw new Error(`Unknown instance '${instanceId}'`);
  const from = registry.get(source.definitionId),
    to = registry.get(targetId);
  if (from.category !== to.category)
    throw new Error(
      `Transformation category mismatch: ${from.category} to ${to.category}`,
    );
  const compatible = source.attachmentIds.filter((id) => {
    const child = instances.find((i) => i.instanceId === id);
    if (!child) return false;
    const a = registry.getAs(child.definitionId, "attached-modifier");
    return (
      a.hostCategories.includes(
        to.category as "playable-object" | "passive-modifier",
      ) && !a.requiredHostTags?.some((tag) => !to.tags.includes(tag))
    );
  });
  return instances.map((i) =>
    i.instanceId === instanceId
      ? {
          ...i,
          definitionId: targetId,
          storedValues:
            "initialStoredValues" in to
              ? { ...(to.initialStoredValues ?? {}) }
              : {},
          disabled: false,
          expiresAfterEncounter: undefined,
          attachmentIds: compatible,
          transformationHistory: [
            ...i.transformationHistory,
            source.definitionId,
          ],
        }
      : source.attachmentIds.includes(i.instanceId) &&
          !compatible.includes(i.instanceId)
        ? { ...i, hostInstanceId: undefined }
        : i,
  );
}
export function selectWeighted(
  entries: readonly WeightedEntry[],
  rng: RandomState,
) {
  if (!entries.length) throw new Error("No eligible weighted entries");
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (!Number.isFinite(total) || total <= 0)
    throw new Error("Eligible weighted entries have no positive weight");
  const next = nextUint32(rng);
  let cursor = (next.value / 0x1_0000_0000) * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0)
      return { definitionId: entry.definitionId, rng: next.state };
  }
  return { definitionId: entries.at(-1)!.definitionId, rng: next.state };
}
export function inventoryCount(
  registry: ContentRegistry,
  instances: readonly ContentInstance[],
  category: DefinitionCategory,
) {
  return instances.filter(
    (i) =>
      registry.get(i.definitionId).category === category && !i.hostInstanceId,
  ).length;
}
