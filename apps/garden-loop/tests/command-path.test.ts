import { describe, expect, it } from "vitest";
import {
  createReplay,
  createSaveFile,
  createSessionReplayExecutor,
  loadSaveFile,
  stableHash,
  verifyReplay,
  type RecordedInput,
  type RunEvent,
  type RunState,
} from "@core-loop/core";
import { gardenContentPack } from "../src/content";
import { createGardenSession } from "../src/configuration";
import { gardenModule } from "../src/gameplay";

const compatibility = {
  contentPacks: new Map([[gardenContentPack.id, [gardenContentPack.version]]]),
  gameplayModules: new Map([[gardenModule.id, [gardenModule.version]]]),
};

type UnsequencedInput =
  | Omit<Extract<RecordedInput, { type: "run-command" }>, "sequence">
  | Omit<Extract<RecordedInput, { type: "gameplay-action" }>, "sequence">;

function createDriver(seed: number) {
  const session = createGardenSession();
  let state = session.handleCommand(session.createInitialState(), {
    type: "start-run",
    seed,
    gameplayModuleId: gardenModule.id,
  }).state;
  const inputs: RecordedInput[] = [];
  const events: RunEvent[] = [];
  const checkpoints: {
    sequence: number;
    boundary: RecordedInput["type"];
    stateHash: string;
    eventHash: string;
  }[] = [];

  const apply = (input: UnsequencedInput) => {
    const recorded = { ...input, sequence: inputs.length + 1 } as RecordedInput;
    const result =
      recorded.type === "run-command"
        ? session.handleCommand(state, recorded.command)
        : session.handleGameplayAction(state, recorded.action);
    state = result.state;
    inputs.push(recorded);
    events.push(...result.events);
    checkpoints.push({
      sequence: recorded.sequence,
      boundary: recorded.type,
      stateHash: stableHash(state),
      eventHash: stableHash(events),
    });
    return result;
  };
  const command = (
    command: Extract<RecordedInput, { type: "run-command" }>["command"],
  ) => apply({ type: "run-command", command });
  const action = (index: number) =>
    apply({
      type: "gameplay-action",
      moduleId: gardenModule.id,
      action: { type: "plant", index },
    });
  const playEncounter = () => {
    command({ type: "start-encounter" });
    const bot = gardenModule.createBotStrategy!();
    while (state.phase === "encounter-active") {
      const moduleState = gardenModule.validateState(
        state.gameplaySession!.data,
      );
      const next = bot.nextAction(moduleState);
      action(next.index);
    }
  };
  const resolveReward = () => {
    while (state.pendingReward) {
      const pending = state.pendingReward;
      if (pending.type === "container")
        command({ type: "open-reward-container" });
      else if (pending.type === "choice") {
        const option = pending.options.find((candidate) => {
          const definition = gardenContentPack.definitions.find(
            (item) => item.id === candidate.definitionId,
          );
          return (
            definition?.category === "playable-object" ||
            definition?.category === "consumable"
          );
        });
        command({
          type: "choose-reward",
          optionId: (option ?? pending.options[0]!).id,
        });
      } else
        command({
          type: "choose-reward-target",
          optionId: pending.option.id,
          targetInstanceId: state.inventory.instances.find(
            (item) =>
              !item.hostInstanceId && item.definitionId === "garden-loop:bean",
          )!.instanceId,
        });
    }
  };
  return {
    session,
    get state() {
      return state;
    },
    inputs,
    events,
    checkpoints,
    command,
    action,
    playEncounter,
    resolveReward,
  };
}

function saveRoundTrip(state: RunState) {
  const envelope = createSaveFile(state, "2026-01-01T00:00:00.000Z", {
    content: {
      packId: gardenContentPack.id,
      packVersion: gardenContentPack.version,
    },
    gameplay: {
      moduleId: gardenModule.id,
      moduleVersion: gardenModule.version,
    },
  });
  return loadSaveFile(JSON.stringify(envelope), compatibility).save.run;
}

describe("Garden Loop end-to-end command-path scenarios", () => {
  it("acquires Bee Friend from a stable shop offer before scoring and replay", () => {
    const driver = createDriver(7);
    driver.playEncounter();
    driver.resolveReward();
    driver.command({ type: "continue" });
    driver.playEncounter();
    driver.resolveReward();
    const entered = driver.command({ type: "continue" });
    expect(entered.events.map((event) => event.type)).toContain("shop-entered");
    expect(driver.state.phase).toBe("shop");
    const offer = driver.state.shop!.offers.find(
      (candidate) => candidate.definitionId === "garden-loop:bee-friend",
    );
    expect(offer).toMatchObject({ id: "offer-1", price: 5 });
    const existingHelper = driver.state.inventory.instances.find((item) => {
      const definition = gardenContentPack.definitions.find(
        (candidate) => candidate.id === item.definitionId,
      );
      return definition?.category === "passive-modifier";
    });
    if (existingHelper) {
      const sold = driver.command({
        type: "sell-item",
        instanceId: existingHelper.instanceId,
      });
      expect(sold.events.map((event) => event.type)).toContain("item-sold");
    }
    const currencyBefore = driver.state.currency;
    const rngBeforePurchase = driver.state.rng;
    const bought = driver.command({ type: "buy-offer", offerId: offer!.id });
    expect(bought.events.map((event) => event.type)).toContain(
      "item-purchased",
    );
    expect(driver.state.currency).toBe(currencyBefore - 5);
    expect(driver.state.rng).toEqual(rngBeforePurchase);
    const bee = driver.state.inventory.instances.find(
      (item) => item.definitionId === "garden-loop:bee-friend",
    )!;
    expect(bee.instanceId).toBe("item-5");

    driver.command({ type: "leave-shop" });
    driver.command({ type: "start-encounter" });
    const projected = gardenModule.validateState(
      driver.state.gameplaySession!.data,
    );
    expect(projected.plants.map((plant) => plant.resilience)).toEqual([3, 2]);
    const first = driver.action(0);
    expect(
      first.events.filter(
        (event) =>
          event.type === "effect-runtime" &&
          event.fact.type === "stored-value-changed" &&
          event.fact.source.definitionId === "garden-loop:bee-friend",
      ),
    ).toHaveLength(1);
    expect(
      driver.state.inventory.instances.find(
        (item) => item.instanceId === bee.instanceId,
      )?.storedValues.encounterHarvest,
    ).toBe(2);
    const saved = saveRoundTrip(driver.state);
    expect(driver.session.validateRestoredState(saved)).toEqual(driver.state);
    const direct = driver.action(1).state;
    const restored = driver.session.handleGameplayAction(saved, {
      type: "plant",
      index: 1,
    }).state;
    expect(restored).toEqual(direct);
    expect(direct.lastReport?.score).toBe(21);
    expect(
      direct.scoreLedger.filter(
        (row) => row.source.definitionId === "garden-loop:bee-friend",
      ),
    ).toEqual([
      expect.objectContaining({
        triggerId: "apply-resilient-plant-bonus",
        before: 19,
        after: 21,
        amount: 2,
      }),
    ]);

    const replay = createReplay({
      gameplay: {
        moduleId: gardenModule.id,
        moduleVersion: gardenModule.version,
      },
      content: {
        packId: gardenContentPack.id,
        packVersion: gardenContentPack.version,
      },
      run: direct,
      customEffects: [],
      seed: 7,
      inputs: driver.inputs,
      checkpoints: driver.checkpoints,
      finalStateHash: stableHash(direct),
      finalEventHash: stableHash(driver.events),
    });
    const executor = createSessionReplayExecutor(driver.session);
    expect(verifyReplay(replay, executor)).toMatchObject({
      ok: true,
      state: direct,
    });
    const divergent = {
      ...replay,
      inputs: replay.inputs.map((input, index) =>
        index === replay.inputs.length - 1 && input.type === "gameplay-action"
          ? { ...input, action: { type: "plant", index: 0 } }
          : input,
      ),
    };
    expect(verifyReplay(divergent, executor)).toMatchObject({
      ok: false,
      divergence: {
        sequence: replay.inputs.length,
        inputType: "gameplay-action",
      },
    });
  });

  it("targets Deep Rooted through its authored reward before projection and host sale", () => {
    const driver = createDriver(0);
    for (let encounter = 1; encounter <= 3; encounter++) {
      driver.playEncounter();
      if (encounter < 3) {
        driver.resolveReward();
        driver.command({ type: "continue" });
        if (driver.state.phase === "shop")
          driver.command({ type: "leave-shop" });
      }
    }
    driver.command({ type: "open-reward-container" });
    const generated = driver.state.pendingReward;
    expect(generated).toMatchObject({
      type: "choice",
      definitionId: "garden-loop:trait-reward",
    });
    if (generated?.type !== "choice")
      throw new Error("Expected generated trait choice");
    const deepRooted = generated.options.find(
      (option) => option.definitionId === "garden-loop:deep-rooted",
    );
    expect(deepRooted).toMatchObject({
      definitionId: "garden-loop:deep-rooted",
    });
    driver.command({ type: "choose-reward", optionId: deepRooted!.id });
    const pending = driver.state.pendingReward;
    expect(pending).toMatchObject({
      type: "target",
      definitionId: "garden-loop:trait-reward",
      option: {
        id: deepRooted!.id,
        definitionId: "garden-loop:deep-rooted",
      },
    });
    if (pending?.type !== "target")
      throw new Error("Expected targeted trait reward");
    const host = driver.state.inventory.instances.find(
      (item) =>
        item.definitionId === "garden-loop:bean" && !item.hostInstanceId,
    )!;
    const currencyBefore = driver.state.currency;
    const rngBeforeTarget = driver.state.rng;
    const attached = driver.command({
      type: "choose-reward-target",
      optionId: pending.option.id,
      targetInstanceId: host.instanceId,
    });
    expect(attached.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["reward-target-resolved", "reward-completed"]),
    );
    expect(driver.state.currency).toBe(currencyBefore);
    expect(driver.state.rng).toEqual(rngBeforeTarget);
    const child = driver.state.inventory.instances.find(
      (item) => item.definitionId === "garden-loop:deep-rooted",
    )!;
    expect(child).toMatchObject({
      instanceId: "item-5",
      hostInstanceId: host.instanceId,
    });
    expect(
      driver.state.inventory.instances.find(
        (item) => item.instanceId === host.instanceId,
      )?.attachmentIds,
    ).toContain(child.instanceId);

    driver.command({ type: "continue" });
    driver.command({ type: "start-encounter" });
    const projection = gardenModule.validateState(
      driver.state.gameplaySession!.data,
    );
    const projectedHost = projection.plants.find(
      (plant) => plant.instanceId === host.instanceId,
    )!;
    expect(projectedHost.resilience).toBeGreaterThanOrEqual(
      (host.storedValues.resilience ?? 0) + 1,
    );
    driver.action(0);
    driver.action(1);
    expect(
      driver.state.scoreLedger.filter(
        (row) => row.source.definitionId === "garden-loop:deep-rooted",
      ),
    ).toEqual([
      expect.objectContaining({ triggerId: "deep-rooted-harvest", amount: 2 }),
    ]);
    driver.resolveReward();
    driver.command({ type: "continue" });
    expect(driver.state.phase).toBe("shop");
    const sold = driver.command({
      type: "sell-item",
      instanceId: host.instanceId,
    });
    expect(sold.events.map((event) => event.type)).toContain("item-sold");
    expect(
      driver.state.inventory.instances.some((item) =>
        [host.instanceId, child.instanceId].includes(item.instanceId),
      ),
    ).toBe(false);
  });

  it("uses Watering Can transactionally, persists it, and expires it after one encounter", () => {
    const driver = createDriver(23);
    const can = driver.state.inventory.instances.find(
      (item) => item.definitionId === "garden-loop:watering-can",
    )!;
    const beforeRejected = driver.state;
    const rejected = driver.command({
      type: "use-consumable",
      instanceId: "missing-item",
    });
    expect(rejected.events[0]).toMatchObject({ type: "command-rejected" });
    expect(driver.state).toBe(beforeRejected);
    expect(driver.state.rng).toEqual(beforeRejected.rng);
    expect(driver.state.inventory.instances).toContain(can);

    const used = driver.command({
      type: "use-consumable",
      instanceId: can.instanceId,
    });
    expect(used.events.map((event) => event.type)).toContain("consumable-used");
    expect(driver.state.inventory.instances).not.toContain(can);
    expect(driver.state.encounterEffects).toEqual([
      expect.objectContaining({ instanceId: can.instanceId }),
    ]);
    const restored = saveRoundTrip(driver.state);
    expect(restored).toEqual(driver.state);
    driver.command({ type: "start-encounter" });
    driver.action(0);
    driver.action(1);
    expect(
      driver.state.scoreLedger.filter(
        (row) => row.source.definitionId === "garden-loop:watering-can",
      ),
    ).toEqual([
      expect.objectContaining({ triggerId: "watering-bonus", amount: 3 }),
    ]);
    driver.resolveReward();
    driver.command({ type: "continue" });
    expect(driver.state.encounterEffects).toEqual([]);
    driver.command({ type: "start-encounter" });
    driver.action(0);
    driver.action(1);
    expect(
      driver.state.scoreLedger.some(
        (row) => row.source.definitionId === "garden-loop:watering-can",
      ),
    ).toBe(false);
  });
});
