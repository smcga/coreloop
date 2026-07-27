import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSaveFile, loadSaveFile, type RunState } from "@core-loop/core";
import { gardenContentPack } from "../src/content";
import {
  createGardenSession,
  gardenPolicies,
  gardenRegistry,
} from "../src/configuration";
import { gardenModule } from "../src/gameplay";

const play = (state: RunState) => {
  const session = createGardenSession();
  let next = session.handleCommand(state, { type: "start-encounter" }).state;
  const bot = gardenModule.createBotStrategy!();
  while (next.phase === "encounter-active") {
    const moduleState = gardenModule.validateState(next.gameplaySession!.data);
    next = session.handleGameplayAction(
      next,
      bot.nextAction(moduleState),
    ).state;
  }
  return next;
};

describe("Garden Loop configured season", () => {
  it("creates deterministic module state and applies both weather payloads", () => {
    const ordinary = gardenModule.createEncounter({
      encounterId: "one",
      encounterNumber: 1,
      target: 10,
      rules: [],
      seed: 9,
    });
    expect(ordinary).toEqual(
      gardenModule.createEncounter({
        encounterId: "one",
        encounterNumber: 1,
        target: 10,
        rules: [],
        seed: 9,
      }),
    );
    const dry = gardenModule.createEncounter({
      encounterId: "dry",
      encounterNumber: 3,
      target: 13,
      rules: [
        {
          id: "garden-loop:dry-spell",
          version: 1,
          payload: { waterPenalty: 1 },
        },
      ],
      seed: 9,
    }).state;
    const storm = gardenModule.createEncounter({
      encounterId: "storm",
      encounterNumber: 5,
      target: 16,
      rules: [
        {
          id: "garden-loop:severe-storm",
          version: 1,
          payload: { minimumResilience: 6 },
        },
      ],
      seed: 9,
    }).state;
    expect(dry.waterAllowance).toBe(7);
    expect(storm.minimumResilience).toBe(6);
  });

  it("drives a five-session season entirely through the coordinator", () => {
    const session = createGardenSession();
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 18,
      gameplayModuleId: gardenModule.id,
    }).state;
    expect(
      state.schedule.map((entry) => [entry.kind, entry.rules[0]?.id]),
    ).toEqual([
      ["ordinary", undefined],
      ["ordinary", undefined],
      ["special", "garden-loop:dry-spell"],
      ["ordinary", undefined],
      ["special", "garden-loop:severe-storm"],
    ]);
    while (state.phase !== "run-complete" && state.phase !== "run-failed") {
      if (state.phase === "encounter-ready") state = play(state);
      else if (state.phase === "reward")
        state = session.handleCommand(state, {
          type: [2, 4].includes(state.encounterNumber)
            ? "enter-shop"
            : "advance",
        }).state;
      else if (state.phase === "shop")
        state = session.handleCommand(state, { type: "leave-shop" }).state;
    }
    expect(state.encounterNumber).toBeGreaterThanOrEqual(2);
    expect(["run-complete", "run-failed"]).toContain(state.phase);
  });

  it("permits the authored first-session setback but fails a later loss", () => {
    expect(
      gardenPolicies.outcome.evaluate({
        entry: { id: "spring", ordinal: 1, kind: "ordinary", rules: [] },
        encounterWon: false,
        hasNextEncounter: true,
      }),
    ).toBeNull();
    expect(
      gardenPolicies.outcome.evaluate({
        entry: { id: "storm", ordinal: 3, kind: "special", rules: [] },
        encounterWon: false,
        hasNextEncounter: true,
      }),
    ).toBe("lost");
  });

  it("round-trips exact in-encounter and shop state in the framework envelope", () => {
    const session = createGardenSession();
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 4,
      gameplayModuleId: gardenModule.id,
    }).state;
    state = session.handleCommand(state, { type: "start-encounter" }).state;
    state = session.handleGameplayAction(state, {
      type: "plant",
      index: 0,
    }).state;
    const envelope = createSaveFile(state, "2026-01-01T00:00:00.000Z", {
      content: { packId: gardenContentPack.id, packVersion: 1 },
      gameplay: { moduleId: gardenModule.id, moduleVersion: 1 },
    });
    const loaded = loadSaveFile(JSON.stringify(envelope), {
      contentPacks: new Map([[gardenContentPack.id, [1]]]),
      gameplayModules: new Map([[gardenModule.id, [1]]]),
    }).save.run;
    expect(session.validateRestoredState(loaded)).toEqual(state);
  });

  it("validates one pack containing helpers, supplies, traits, facilities, rewards and shops", () => {
    expect(gardenRegistry.pack).toEqual(gardenContentPack);
    const categories = gardenRegistry.pack.definitions.map(
      (definition) => definition.category,
    );
    expect(categories).toEqual(
      expect.arrayContaining([
        "passive-modifier",
        "consumable",
        "attached-modifier",
        "run-upgrade",
        "reward-container",
        "shop-pool",
        "special-encounter-rule",
      ]),
    );
  });

  it("has no manual authoritative round state or Threshold Lab dependency", () => {
    const main = readFileSync(
      new URL("../src/main.ts", import.meta.url),
      "utf8",
    );
    expect(main).not.toMatch(/let\s+round|round\s*\+\+|%\s*3|threshold-lab/i);
    expect(main).not.toContain("gardenModule.handleAction");
    expect(main).toContain("session.handleGameplayAction");
  });
});
