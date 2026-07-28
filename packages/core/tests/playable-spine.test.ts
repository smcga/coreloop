import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createRunEngine,
  createSaveFile,
  defaultPolicies,
  loadSaveFile,
  type RunConfiguration,
} from "../src";
import { provider } from "./provider-fixture";

const configuration: RunConfiguration = {
  policies: {
    ...defaultPolicies,
    schedule: {
      ...defaultPolicies.schedule,
      createSchedule: () =>
        Array.from({ length: 6 }, (_, index) => ({
          id: `encounter-${index + 1}`,
          ordinal: index + 1,
          kind: index === 2 ? "special" : "ordinary",
          rules: index === 2 ? [{ id: "test:module-rule", version: 1 }] : [],
        })),
    },
  },
  content: provider(
    [
      {
        id: "test:boost",
        category: "consumable",
        tags: [],
        occupiesCapacity: true,
        rarity: "test:common",
        weight: 1,
        basePrice: 4,
        use: { type: "encounter-effect" },
        triggers: [
          {
            id: "boost",
            event: "score",
            stage: "additive",
            operations: [
              { type: "add-score", amount: { from: "constant", value: 5 } },
            ],
          },
        ],
      },
    ],
    ["test:boost"],
  ),
  defaultLoadoutId: "test:loadout",
};

describe("configured framework composition", () => {
  it("keeps concrete definitions outside state while resolving generic effects", () => {
    const engine = createRunEngine(configuration);
    let state = engine.handle(engine.createInitialState(), {
      type: "start-run",
      seed: 7,
      gameplayModuleId: "test:module",
    }).state;
    state = engine.handle(state, {
      type: "use-consumable",
      instanceId: state.inventory.instances.find(
        (item) =>
          engine.definitionFor(item.definitionId)?.category === "consumable",
      )!.instanceId,
    }).state;
    state = engine.handle(state, {
      type: "store-gameplay-session",
      session: {
        moduleId: "test:module",
        moduleVersion: 1,
        encounterId: state.currentEncounter!.id,
        data: { done: true },
      },
    }).state;
    state = engine.handle(state, { type: "start-encounter" }).state;
    state = engine.handle(state, {
      type: "submit-encounter",
      report: {
        encounterId: state.currentEncounter!.id,
        score: 30,
        tags: [],
        metrics: {},
        signals: [],
      },
    }).state;
    expect(state.lastReport?.score).toBe(35);
    expect(JSON.stringify(state)).not.toContain("Test score adjustment");
  });

  it("schedules and saves a module rule as an uninterpreted reference", () => {
    const engine = createRunEngine(configuration);
    let state = engine.handle(engine.createInitialState(), {
      type: "start-run",
      seed: 11,
      gameplayModuleId: "test:module",
    }).state;
    for (let number = 1; number < 3; number += 1) {
      state = engine.handle(state, {
        type: "store-gameplay-session",
        session: {
          moduleId: "test:module",
          moduleVersion: 1,
          encounterId: state.currentEncounter!.id,
          data: { done: true },
        },
      }).state;
      state = engine.handle(state, { type: "start-encounter" }).state;
      state = engine.handle(state, {
        type: "submit-encounter",
        report: {
          encounterId: state.currentEncounter!.id,
          score: 999,
          tags: [],
          metrics: {},
          signals: [],
        },
      }).state;
      state = engine.handle(state, { type: "continue" }).state;
      state = engine.handle(state, { type: "leave-shop" }).state;
    }
    expect(state.currentEncounter?.rules).toEqual([
      { id: "test:module-rule", version: 1 },
    ]);
    const loaded = loadSaveFile(
      JSON.stringify(
        createSaveFile(state, "2026-01-01T00:00:00.000Z", {
          content: { packId: "test:pack", packVersion: 1 },
          gameplay: { moduleId: "test:module", moduleVersion: 1 },
        }),
      ),
    );
    expect(loaded.save.run.currentEncounter?.rules).toEqual(
      state.currentEncounter?.rules,
    );
  });
});

describe("source dependency boundary", () => {
  it("does not import outward layers from core source", () => {
    const files = [
      "engine.ts",
      "effects.ts",
      "gameplay.ts",
      "policies.ts",
      "save.ts",
      "replay.ts",
    ];
    for (const file of files) {
      const source = readFileSync(resolve("packages/core/src", file), "utf8");
      expect(source).not.toMatch(
        /from ["'](?:@core-loop\/(?:content|phaser|simulation)|\.\.\/\.\.\/apps)/,
      );
    }
  });
  it("does not export or branch on concrete gameplay nouns", () => {
    const source = readFileSync(resolve("packages/core/src/engine.ts"), "utf8");
    expect(source).not.toMatch(
      /PlayableTile|cyan-penalty|combination-grid|timing-meter|refresh-tiles/,
    );
    expect(source).not.toMatch(/\.id\s*===\s*["'][^"']+:[^"']+["']/);
  });
});
