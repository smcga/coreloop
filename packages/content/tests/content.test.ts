import { describe, expect, it } from "vitest";
import {
  attach,
  ContentRegistry,
  createInstance,
  detach,
  duplicateInstance,
  formatTerm,
  selectWeighted,
  thresholdLabContentPack,
  transformInstance,
  validateContentPack,
  type ContentPack,
} from "../src";
import { createRandom } from "@core-loop/core";
const registry = new ContentRegistry(thresholdLabContentPack);
const broken = (change: Partial<ContentPack>): ContentPack => ({
  ...thresholdLabContentPack,
  ...change,
});

describe("content-pack validation and index", () => {
  it("loads every shipped category in canonical authored order", () => {
    expect(validateContentPack(thresholdLabContentPack)).toEqual([]);
    expect(
      new Set(thresholdLabContentPack.definitions.map((d) => d.category)),
    ).toEqual(
      new Set([
        "playable-object",
        "passive-modifier",
        "consumable",
        "attached-modifier",
        "run-upgrade",
        "reward-container",
        "encounter",
        "special-encounter-rule",
        "shop-pool",
        "starting-loadout",
      ]),
    );
    expect(registry.byCategory("passive-modifier")).toHaveLength(30);
    expect(registry.byCategory("consumable")).toHaveLength(10);
    expect(registry.byCategory("attached-modifier")).toHaveLength(12);
    expect(registry.byCategory("special-encounter-rule")).toHaveLength(6);
    expect(registry.byCategory("starting-loadout")).toHaveLength(4);
    expect(registry.byCategory("reward-container")).toHaveLength(3);
    expect(registry.byTag("starter").map((d) => d.id)).toEqual(
      thresholdLabContentPack.definitions
        .filter((d) => d.tags.includes("starter"))
        .map((d) => d.id),
    );
    expect(Object.isFrozen(registry.get("threshold-lab:cyan-focus"))).toBe(
      true,
    );
  });
  it("collects actionable duplicate, reference, price, weight, rarity and terminology errors", () => {
    const first = thresholdLabContentPack.definitions[0]!;
    const errors = validateContentPack(
      broken({
        definitions: [
          first,
          { ...first, basePrice: -1, rarity: "missing" as never },
          {
            ...registry.getAs("threshold-lab:main-pool", "shop-pool"),
            id: "threshold-lab:bad-pool",
            entries: [{ definitionId: "threshold-lab:missing", weight: 0 }],
          },
        ],
        terminology: [{ id: "threshold-lab:broken", terms: {} as never }],
        defaultTerminologyId: "threshold-lab:broken",
      }),
    );
    expect(errors.map((e) => e.reason).join(" ")).toMatch(/duplicate/);
    expect(errors.map((e) => e.reason).join(" ")).toMatch(/unknown rarity/);
    expect(errors.map((e) => e.reason).join(" ")).toMatch(/missing referenced/);
    expect(errors.map((e) => e.path)).toContain("entries[0].weight");
    expect(
      errors.some((e) => e.path.includes("terminology.threshold-lab:broken")),
    ).toBe(true);
    expect(errors.every((e) => e.packId === thresholdLabContentPack.id)).toBe(
      true,
    );
  });
  it("rejects unsupported custom handlers and wrong-category references", () => {
    const custom = {
      ...registry.getAs("threshold-lab:cyan-focus", "passive-modifier"),
      id: "threshold-lab:custom",
      triggers: [
        {
          id: "x",
          event: "score",
          operations: [
            { type: "custom" as const, handlerId: "future:missing" },
          ],
        },
      ],
    };
    const encounter = {
      ...registry.getAs("threshold-lab:six-challenge-run", "encounter"),
      playableObjectIds: ["threshold-lab:cyan-focus"],
    };
    const errors = validateContentPack(
      broken({
        definitions: [
          ...thresholdLabContentPack.definitions.filter(
            (d) => d.id !== encounter.id,
          ),
          encounter,
          custom,
        ],
      }),
    );
    expect(errors.some((e) => e.reason.includes("unknown custom"))).toBe(true);
    expect(
      errors.some((e) => e.reason.includes("must target playable-object")),
    ).toBe(true);
  });
});

describe("instances and deterministic pools", () => {
  it("creates stable IDs, attaches, detaches, duplicates state, and transforms in place", () => {
    const host = createInstance(registry, "threshold-lab:sequence-learner", {
        nextInstanceId: 1,
      }),
      child = createInstance(
        registry,
        "threshold-lab:red-finish",
        host.counters,
      );
    let instances = attach(
      registry,
      [{ ...host.instance, storedValues: { bonus: 9 } }, child.instance],
      child.instance.instanceId,
      host.instance.instanceId,
    );
    expect(instances[0]!.attachmentIds).toEqual(["instance-2"]);
    expect(instances[1]!.hostInstanceId).toBe("instance-1");
    expect(detach(instances, "instance-2")[0]!.attachmentIds).toEqual([]);
    const copy = duplicateInstance(
      registry,
      instances,
      "instance-1",
      child.counters,
    );
    expect(copy.instances[2]).toMatchObject({
      instanceId: "instance-3",
      storedValues: { bonus: 9 },
      attachmentIds: [],
    });
    instances = transformInstance(
      registry,
      instances,
      "instance-1",
      "threshold-lab:steady-growth",
    );
    expect(instances[0]).toMatchObject({
      instanceId: "instance-1",
      definitionId: "threshold-lab:steady-growth",
      transformationHistory: ["threshold-lab:sequence-learner"],
    });
  });
  it("rejects incompatible and full hosts", () => {
    const host = createInstance(registry, "threshold-lab:object-1", {
        nextInstanceId: 1,
      }),
      a = createInstance(registry, "threshold-lab:red-finish", host.counters),
      b = createInstance(registry, "threshold-lab:blue-finish", a.counters);
    const attached = attach(
      registry,
      [host.instance, a.instance, b.instance],
      a.instance.instanceId,
      host.instance.instanceId,
    );
    expect(() =>
      attach(
        registry,
        attached,
        b.instance.instanceId,
        host.instance.instanceId,
      ),
    ).toThrow(/capacity/);
  });
  it("selects identically from identical RNG states and fails controlled empty pools", () => {
    const entries = registry.getAs(
        "threshold-lab:main-pool",
        "shop-pool",
      ).entries,
      a = selectWeighted(entries, createRandom(55)),
      b = selectWeighted(entries, createRandom(55));
    expect(a).toEqual(b);
    expect(() => selectWeighted([], createRandom(1))).toThrow(/No eligible/);
  });
});

describe("terminology", () => {
  it("provides complete count-aware packs without changing content identity", () => {
    const lab = registry.terminology("threshold-lab:lab-terms"),
      music = registry.terminology("threshold-lab:music-terms");
    expect(formatTerm(lab, "encounter", 0)).toBe("Challenges");
    expect(formatTerm(lab, "encounter", 1)).toBe("Challenge");
    expect(formatTerm(music, "encounter", 2)).toBe("Gigs");
    expect(registry.get("threshold-lab:cyan-focus").id).toBe(
      "threshold-lab:cyan-focus",
    );
  });
});
