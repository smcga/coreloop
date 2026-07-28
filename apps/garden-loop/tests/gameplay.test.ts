import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createHeadlessRunSession,
  createSaveFile,
  loadSaveFile,
  type RunState,
} from "@core-loop/core";
import { gardenContentPack } from "../src/content";
import {
  createGardenSession,
  gardenPolicies,
  gardenGameplayProjection,
  gardenModules,
  gardenRegistry,
  gardenRunConfiguration,
} from "../src/configuration";
import { gardenModule } from "../src/gameplay";

const projection = {
  plants: [
    {
      instanceId: "item-1",
      definitionId: "garden-loop:bean",
      growth: 6,
      water: 2,
      resilience: 4,
    },
  ],
};

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

const resolveReward = (state: RunState) => {
  const session = createGardenSession();
  let next = state;
  while (next.pendingReward) {
    const pending = next.pendingReward;
    if (pending.type === "container")
      next = session.handleCommand(next, {
        type: "open-reward-container",
      }).state;
    else if (pending.type === "choice")
      next = session.handleCommand(next, {
        type: "choose-reward",
        optionId: pending.options[0]!.id,
      }).state;
    else
      next = session.handleCommand(next, {
        type: "choose-reward-target",
        optionId: pending.option.id,
        targetInstanceId: next.inventory.instances.find(
          (item) => !item.hostInstanceId,
        )!.instanceId,
      }).state;
  }
  return next;
};

describe("Garden Loop configured season", () => {
  it("projects stable owned plants and applies attached traits", () => {
    const session = createGardenSession();
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 51,
      gameplayModuleId: gardenModule.id,
    }).state;
    const beforeRng = state.rng;
    state = session.handleCommand(state, { type: "start-encounter" }).state;
    const created = gardenModule.validateState(state.gameplaySession!.data);
    expect(created.plants[0]).toMatchObject({
      instanceId: "item-1",
      definitionId: "garden-loop:bean",
    });
    expect(state.gameplaySession?.projection).toEqual({
      id: gardenGameplayProjection.id,
      version: gardenGameplayProjection.version,
    });
    // Starting the module consumes only its derived seed; projection itself
    // does not touch the authoritative run RNG.
    expect(state.rng).toEqual(beforeRng);

    const projected = gardenGameplayProjection.project({
      encounter: state.currentEncounter!,
      inventory: {
        activeRunUpgradeIds: [],
        instances: [
          {
            instanceId: "plant-7",
            definitionId: "garden-loop:marigold",
            category: "playable-object",
            tags: ["plant"],
            storedValues: { growth: 5, water: 1, resilience: 3 },
            disabled: false,
            destroyed: false,
            attachmentIds: ["trait-8"],
            transformationHistory: [],
          },
          {
            instanceId: "trait-8",
            definitionId: "garden-loop:deep-rooted",
            category: "attached-modifier",
            tags: ["plant-trait"],
            storedValues: {},
            disabled: false,
            destroyed: false,
            attachmentIds: [],
            hostInstanceId: "plant-7",
            transformationHistory: [],
          },
        ],
      },
      content: gardenRunConfiguration.content,
      runTags: [],
      encounterTags: [],
      allowances: {},
    });
    expect(projected).toEqual({
      plants: [
        {
          instanceId: "plant-7",
          definitionId: "garden-loop:marigold",
          growth: 5,
          water: 1,
          resilience: 5,
        },
      ],
    });
  });

  it("rejects non-serialisable projections without changing prepared state", () => {
    const session = createHeadlessRunSession({
      configuration: {
        ...gardenRunConfiguration,
        gameplayProjection: {
          ...gardenGameplayProjection,
          project: () => ({ invalid: Number.NaN }),
        },
      },
      modules: gardenModules,
    });
    const ready = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 52,
      gameplayModuleId: gardenModule.id,
    }).state;
    const result = session.handleCommand(ready, { type: "start-encounter" });
    expect(result.state).toBe(ready);
    expect(result.state.rng).toEqual(ready.rng);
    expect(result.events[0]).toMatchObject({ type: "command-rejected" });
  });
  it("creates deterministic module state and applies both weather payloads", () => {
    const ordinary = gardenModule.createEncounter({
      encounterId: "one",
      encounterNumber: 1,
      target: 10,
      rules: [],
      seed: 9,
      projection,
      allowances: { action: 8 },
      encounterTags: [],
      runTags: [],
    });
    expect(ordinary).toEqual(
      gardenModule.createEncounter({
        encounterId: "one",
        encounterNumber: 1,
        target: 10,
        rules: [],
        seed: 9,
        projection,
        allowances: { action: 8 },
        encounterTags: [],
        runTags: [],
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
      projection,
      allowances: { action: 7 },
      encounterTags: [],
      runTags: [],
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
      projection,
      allowances: { action: 8 },
      encounterTags: [],
      runTags: [],
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
      else if (state.phase === "reward") {
        state = resolveReward(state);
        if (state.phase === "reward")
          state = session.handleCommand(state, { type: "continue" }).state;
      } else if (state.phase === "shop")
        state = session.handleCommand(state, { type: "leave-shop" }).state;
    }
    expect(state.encounterNumber).toBeGreaterThanOrEqual(2);
    expect(["run-complete", "run-failed"]).toContain(state.phase);
  });

  it("resolves authored currency, choice and targeted rewards as saveable run state", () => {
    const session = createGardenSession();
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 72,
      gameplayModuleId: gardenModule.id,
    }).state;
    const seen: string[] = [];
    for (let encounter = 1; encounter <= 3; encounter++) {
      state = play(state);
      expect(state.pendingReward?.type).toBe("container");
      seen.push(state.pendingReward!.definitionId);
      const restored = JSON.parse(JSON.stringify(state)) as RunState;
      expect(resolveReward(restored)).toEqual(resolveReward(state));
      state = resolveReward(state);
      if (encounter < 3)
        state = session.handleCommand(state, { type: "continue" }).state;
      if (state.phase === "shop")
        state = session.handleCommand(state, { type: "leave-shop" }).state;
    }
    expect(seen).toEqual([
      "garden-loop:compost-reward",
      "garden-loop:plant-choice",
      "garden-loop:trait-reward",
    ]);
    expect(state.inventory.instances.some((item) => item.hostInstanceId)).toBe(
      true,
    );
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
    expect(main).not.toMatch(
      /encounterNumber.*(?:2|4)|(?:2|4).*encounterNumber/,
    );
    expect(main).not.toContain("gardenModule.handleAction");
    expect(main).toContain("session.handleGameplayAction");
  });
});
