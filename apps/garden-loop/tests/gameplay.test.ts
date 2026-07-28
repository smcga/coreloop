import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createReplay,
  createHeadlessRunSession,
  createSaveFile,
  createSessionReplayExecutor,
  loadSaveFile,
  stableHash,
  verifyReplay,
  type RecordedInput,
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
  it("carries Bee Friend's resilient-placement bonus into the final report, saves, and replay", () => {
    const session = createGardenSession();
    const withBee = (state: RunState): RunState => ({
      ...state,
      inventory: {
        ...state.inventory,
        instances: [
          ...state.inventory.instances,
          {
            instanceId: "item-bee",
            definitionId: "garden-loop:bee-friend",
            storedValues: { encounterHarvest: 0 },
            disabled: false,
            destroyed: false,
            temporaryTags: [],
            attachmentIds: [],
            transformationHistory: [],
          },
        ],
      },
    });
    const started = withBee(
      session.handleCommand(session.createInitialState(), {
        type: "start-run",
        seed: 8,
        gameplayModuleId: gardenModule.id,
      }).state,
    );
    const inputs: readonly RecordedInput[] = [
      {
        sequence: 1,
        type: "run-command",
        command: { type: "start-encounter" },
      },
      {
        sequence: 2,
        type: "gameplay-action",
        moduleId: gardenModule.id,
        action: { type: "plant", index: 0 },
      },
      {
        sequence: 3,
        type: "gameplay-action",
        moduleId: gardenModule.id,
        action: { type: "plant", index: 1 },
      },
    ];
    const execute = () => {
      let state = started;
      const events = [];
      const checkpoints = [];
      for (const input of inputs) {
        const result =
          input.type === "run-command"
            ? session.handleCommand(state, input.command)
            : session.handleGameplayAction(state, input.action);
        state = result.state;
        events.push(...result.events);
        checkpoints.push({
          sequence: input.sequence,
          boundary: input.type,
          stateHash: stableHash(state),
          eventHash: stableHash(events),
        });
      }
      return { state, events, checkpoints };
    };

    let beforeSecond = session.handleCommand(started, {
      type: "start-encounter",
    }).state;
    beforeSecond = session.handleGameplayAction(beforeSecond, {
      type: "plant",
      index: 0,
    }).state;
    expect(
      beforeSecond.inventory.instances.find(
        (item) => item.instanceId === "item-bee",
      )?.storedValues.encounterHarvest,
    ).toBe(2);
    const envelope = createSaveFile(beforeSecond, "2026-01-01T00:00:00.000Z", {
      content: { packId: gardenContentPack.id, packVersion: 1 },
      gameplay: { moduleId: gardenModule.id, moduleVersion: 1 },
    });
    const restored = loadSaveFile(JSON.stringify(envelope), {
      contentPacks: new Map([[gardenContentPack.id, [1]]]),
      gameplayModules: new Map([[gardenModule.id, [1]]]),
    }).save.run;
    const savedResult = session.handleGameplayAction(restored, {
      type: "plant",
      index: 1,
    }).state;
    const direct = execute();

    expect(savedResult).toEqual(direct.state);
    expect(direct.state.lastReport?.score).toBe(16);
    const beeRows = direct.state.scoreLedger.filter(
      (entry) => entry.source.definitionId === "garden-loop:bee-friend",
    );
    expect(beeRows).toHaveLength(1);
    expect(beeRows[0]).toMatchObject({
      triggerId: "apply-resilient-plant-bonus",
      operation: "add",
      before: 14,
      after: 16,
      amount: 2,
    });
    expect(
      direct.events.filter(
        (event) =>
          event.type === "effect-runtime" &&
          event.fact.type === "stored-value-changed" &&
          event.fact.source.definitionId === "garden-loop:bee-friend" &&
          event.fact.value === 2,
      ),
    ).toHaveLength(1);

    const replay = createReplay({
      gameplay: { moduleId: gardenModule.id, moduleVersion: 1 },
      content: { packId: gardenContentPack.id, packVersion: 1 },
      run: direct.state,
      customEffects: [],
      seed: 8,
      inputs,
      checkpoints: direct.checkpoints,
      finalStateHash: stableHash(direct.state),
      finalEventHash: stableHash(direct.events),
    });
    const baseExecutor = createSessionReplayExecutor(session);
    expect(
      verifyReplay(replay, {
        ...baseExecutor,
        initialState: (seed, moduleId) =>
          withBee(baseExecutor.initialState(seed, moduleId)),
      }),
    ).toMatchObject({ ok: true, state: direct.state });
  });

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

  it("projects a purchased authored plant into the next growing session", () => {
    const session = createGardenSession();
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 0,
      gameplayModuleId: gardenModule.id,
    }).state;
    state = play(state);
    state = resolveReward(state);
    state = session.handleCommand(state, { type: "continue" }).state;
    state = play(state);
    state = resolveReward(state);
    state = session.handleCommand(state, { type: "continue" }).state;
    expect(state.phase).toBe("shop");
    const offer = state.shop!.offers.find(
      (candidate) => candidate.category === "playable-object",
    )!;
    const purchase = session.handleCommand(state, {
      type: "buy-offer",
      offerId: offer.id,
    });
    state = purchase.state;
    const purchased = purchase.events.find(
      (event) => event.type === "item-purchased",
    );
    expect(purchased).toMatchObject({ type: "item-purchased" });
    if (!purchased || purchased.type !== "item-purchased")
      throw new Error("Expected the fixed seed to purchase a plant");
    expect(purchased.instance.instanceId).toBe("item-5");
    const rngAfterPurchase = state.rng;
    state = session.handleCommand(state, { type: "leave-shop" }).state;
    state = session.handleCommand(state, { type: "start-encounter" }).state;
    const growing = gardenModule.validateState(state.gameplaySession!.data);
    expect(growing.plants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instanceId: purchased.instance.instanceId,
          definitionId: offer.definitionId,
        }),
      ]),
    );
    expect(rngAfterPurchase).toEqual(purchase.state.rng);
  });

  it("removes an attached trait with its sold host", () => {
    const session = createGardenSession();
    let state = session.handleCommand(session.createInitialState(), {
      type: "start-run",
      seed: 12,
      gameplayModuleId: gardenModule.id,
    }).state;
    const host = state.inventory.instances[0]!;
    state = {
      ...state,
      phase: "shop",
      inventory: {
        ...state.inventory,
        instances: [
          ...state.inventory.instances.map((item) =>
            item.instanceId === host.instanceId
              ? { ...item, attachmentIds: ["item-trait"] }
              : item,
          ),
          {
            instanceId: "item-trait",
            definitionId: "garden-loop:deep-rooted",
            storedValues: {},
            disabled: false,
            destroyed: false,
            temporaryTags: [],
            attachmentIds: [],
            hostInstanceId: host.instanceId,
            transformationHistory: [],
          },
        ],
      },
    };
    const sold = session.handleCommand(state, {
      type: "sell-item",
      instanceId: host.instanceId,
    });
    expect(sold.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "item-sold",
          instanceId: host.instanceId,
        }),
      ]),
    );
    expect(
      sold.state.inventory.instances.some((item) =>
        [host.instanceId, "item-trait"].includes(item.instanceId),
      ),
    ).toBe(false);
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
