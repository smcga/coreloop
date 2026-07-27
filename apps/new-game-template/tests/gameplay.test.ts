import { describe, expect, it } from "vitest";
import { importReplay } from "@core-loop/core";
import { starterContentRegistry } from "../src/content";
import { starterSession } from "../src/composition";
import { choiceModule } from "../src/gameplay";
import { StarterRuntime, type TextStore } from "../src/runtime";

const memoryStore = (): TextStore => {
  let text: string | null = null;
  return {
    read: () => text,
    write: (value) => {
      text = value;
    },
    remove: () => {
      text = null;
    },
  };
};

function playEncounter(runtime: StarterRuntime) {
  expect(runtime.command({ type: "start-encounter" })).toBe(true);
  while (runtime.state.phase === "encounter-active") {
    const state = choiceModule.validateState(
      runtime.state.gameplaySession!.data,
    );
    expect(
      runtime.action(choiceModule.createBotStrategy!().nextAction(state)),
    ).toBe(true);
  }
}

function playRun(runtime: StarterRuntime) {
  while (
    runtime.state.phase !== "run-complete" &&
    runtime.state.phase !== "run-failed"
  ) {
    if (runtime.state.phase === "encounter-ready") playEncounter(runtime);
    else if (runtime.state.phase === "reward")
      expect(runtime.command({ type: "enter-shop" })).toBe(true);
    else if (runtime.state.phase === "shop")
      expect(runtime.command({ type: "leave-shop" })).toBe(true);
    else throw new Error(`Unexpected phase ${runtime.state.phase}`);
  }
}

describe("canonical starter composition", () => {
  it("reproduces module and authoritative run state from a seed and actions", () => {
    const a = new StarterRuntime(),
      b = new StarterRuntime();
    a.newRun(42);
    b.newRun(42);
    playEncounter(a);
    playEncounter(b);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it("traverses reward and shop in its four-challenge policy", () => {
    const runtime = new StarterRuntime();
    runtime.newRun(42);
    playRun(runtime);
    expect(runtime.state.schedule).toHaveLength(4);
    expect(runtime.state.schedule[3]?.rules).toEqual([
      { id: "starter:last-step", version: 1 },
    ]);
    expect(runtime.events.map((event) => event.type)).toContain("shop-entered");
    expect(["run-complete", "run-failed"]).toContain(runtime.state.phase);
  });

  it("applies authored passive and consumable effects and exposes attachment and upgrade offers", () => {
    const runtime = new StarterRuntime();
    runtime.newRun(8);
    const consumable = runtime.state.inventory.instances.find(
      (item) => item.definitionId === "starter:pulse",
    )!;
    expect(
      runtime.command({
        type: "use-consumable",
        instanceId: consumable.instanceId,
      }),
    ).toBe(true);
    playEncounter(runtime);
    expect(runtime.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "effect-runtime",
          fact: expect.objectContaining({
            type: "trigger-resolved",
            triggerId: "choice-bonus",
          }),
        }),
      ]),
    );
    expect(runtime.state.scoreLedger.map((line) => line.label)).toContain(
      "Score pulse",
    );
    const categories = starterContentRegistry.pack.definitions.map(
      (d) => d.category,
    );
    expect(categories).toEqual(
      expect.arrayContaining([
        "attached-modifier",
        "run-upgrade",
        "reward-container",
      ]),
    );
  });

  it("rejects invalid actions and commands atomically", () => {
    const runtime = new StarterRuntime();
    runtime.newRun(1);
    runtime.command({ type: "start-encounter" });
    const before = runtime.state;
    expect(runtime.action({ type: "choose", index: 99 })).toBe(false);
    expect(runtime.state).toBe(before);
    expect(runtime.command({ type: "reroll-shop" })).toBe(false);
    expect(runtime.state).toBe(before);
  });

  it("autosaves every phase and resumes with framework compatibility validation", () => {
    const store = memoryStore(),
      runtime = new StarterRuntime(store);
    runtime.newRun(42);
    for (const command of [{ type: "start-encounter" } as const]) {
      runtime.command(command);
      const restored = new StarterRuntime(store);
      expect(restored.continue()).toBe(true);
      expect(restored.state).toEqual(runtime.state);
    }
    runtime.action({ type: "choose", index: 0 });
    const restored = new StarterRuntime(store);
    expect(restored.continue()).toBe(true);
    expect(restored.state).toEqual(runtime.state);
  });

  it("exports a replay that verifies and detects a modified action", () => {
    const runtime = new StarterRuntime();
    runtime.newRun(42);
    playEncounter(runtime);
    const text = runtime.exportReplay();
    expect(runtime.verifyReplay(text).ok).toBe(true);
    const replay = importReplay(text),
      index = replay.inputs.findIndex(
        (input) => input.type === "gameplay-action",
      );
    const modified = {
      ...replay,
      inputs: replay.inputs.map((input, i) =>
        i === index && input.type === "gameplay-action"
          ? { ...input, action: { type: "choose", index: 99 } }
          : input,
      ),
    };
    expect(runtime.verifyReplay(JSON.stringify(modified)).ok).toBe(false);
  });

  it("lets the deterministic bot finish a headless run without changing core", () => {
    const runtime = new StarterRuntime();
    runtime.newRun(42);
    playRun(runtime);
    expect(runtime.state.schedulePosition).toBe(3);
    expect(starterSession.configuration.policies?.schedule.id).toBe(
      "starter:four-challenges",
    );
  });
});
