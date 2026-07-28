import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createRandom } from "../src/random";
import { prepareEncounter } from "../src/encounters/preparation";
import { inventoryCategoryCount } from "../src/economy/inventory";
import { defaultPolicies } from "../src/policies";
import type { Inventory } from "../src/engine";

const source = (path: string) =>
  readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("core subsystem boundaries", () => {
  it("keeps the public engine as a small facade", () => {
    const engine = source("../src/engine.ts");
    expect(engine.split("\n").length).toBeLessThan(60);
    expect(engine).toContain('from "./run/reducer"');
  });

  it("prevents inward dependencies on applications, presentation, or gameplay modules", () => {
    for (const file of [
      "../src/economy/inventory.ts",
      "../src/encounters/preparation.ts",
      "../src/run/reducer.ts",
    ]) {
      const contents = source(file);
      expect(contents).not.toMatch(/from ["'][^"']*(apps|phaser)[/"']/);
      expect(contents).not.toMatch(/from ["'][^"']*gameplay-modules/);
    }
  });

  it("derives a brief while advancing the RNG exactly once", () => {
    const state = createRandom(57);
    const entry = defaultPolicies.schedule.createSchedule({
      seed: 57,
      rng: state,
      gameplayModuleId: "test:module",
    })[0]!;
    const prepared = prepareEncounter(state, entry, {
      policies: defaultPolicies,
    });
    expect(prepared.brief.id).toBe(entry.id);
    expect(prepared.brief.moduleSeed).toBe(3166060519);
    expect(prepared.rng).not.toEqual(state);
  });

  it("centralises category capacity counting without mutating inventory", () => {
    const item = (instanceId: string, definitionId: string) => ({
      instanceId,
      definitionId,
      storedValues: {},
      disabled: false,
      destroyed: false,
      temporaryTags: [],
      attachmentIds: [],
      transformationHistory: [],
    });
    const inventory: Inventory = {
      capacities: { passive: 2 },
      upgradeIds: [],
      instances: [item("item-1", "test:a"), item("item-2", "test:b")],
    };
    expect(
      inventoryCategoryCount(
        inventory,
        () => "passive",
        "passive",
        (id) => id === "test:a",
      ),
    ).toBe(1);
    expect(inventory.instances).toHaveLength(2);
  });
});
