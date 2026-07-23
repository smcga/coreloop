import {
  createRandom,
  createGameplayModuleRegistry,
  type GameplayModule,
} from "@core-loop/core";
import { describe, expect, it } from "vitest";
import { runGameplayModuleScenario } from "@core-loop/testing";
import {
  combinationGridModule,
  timingMeterModule,
  classifyTimingPosition,
  type TimingMeterState,
} from "../src/gameplay/modules";

const context = {
  encounterId: "encounter-1",
  encounterNumber: 1,
  target: 29,
  specialRuleId: null,
  rng: createRandom(1234),
};

describe("gameplay module registry", () => {
  it("registers both modules in stable order and rejects duplicates", () => {
    const registry = createGameplayModuleRegistry([
      combinationGridModule as GameplayModule<unknown, unknown>,
      timingMeterModule as GameplayModule<unknown, unknown>,
    ]);
    expect(registry.list().map((module) => module.id)).toEqual([
      "threshold-lab:combination-grid",
      "threshold-lab:timing-meter",
    ]);
    expect(() => registry.get("missing:module")).toThrow(
      "Unknown gameplay module",
    );
    expect(() =>
      createGameplayModuleRegistry([
        timingMeterModule as GameplayModule<unknown, unknown>,
        timingMeterModule as GameplayModule<unknown, unknown>,
      ]),
    ).toThrow("Duplicate gameplay module ID");
  });

  it("validates versioned restored state", () => {
    const created = timingMeterModule.createEncounter(context);
    const registry = createGameplayModuleRegistry([
      timingMeterModule as GameplayModule<unknown, unknown>,
    ]);
    expect(
      registry.restore({
        moduleId: timingMeterModule.id,
        moduleVersion: 1,
        encounterId: context.encounterId,
        data: created.state as never,
      }),
    ).toEqual(created.state);
    expect(() =>
      registry.restore({
        moduleId: timingMeterModule.id,
        moduleVersion: 2,
        encounterId: context.encounterId,
        data: created.state as never,
      }),
    ).toThrow("incompatible");
  });
});

describe("Timing Meter", () => {
  it("generates deterministic serialisable configurations", () => {
    expect(timingMeterModule.createEncounter(context)).toEqual(
      timingMeterModule.createEncounter(context),
    );
  });

  it.each([
    [0, "miss", "missed", 0],
    [200, "fair", "early", 12],
    [340, "good", "early", 20],
    [450, "perfect", "centred", 30],
    [550, "perfect", "centred", 30],
    [660, "good", "late", 20],
    [800, "fair", "late", 12],
    [1000, "miss", "missed", 0],
  ] as const)(
    "classifies inclusive boundary %i",
    (position, grade, side, score) => {
      expect(classifyTimingPosition(position)).toEqual({ grade, side, score });
    },
  );

  it("progresses attempts, streaks, completion and rejects double actions", () => {
    let state = timingMeterModule.createEncounter(context).state;
    for (const position of [500, 400, 0, 500]) {
      const result = timingMeterModule.handleAction(
        state,
        { type: "stop", position },
        context,
      );
      expect(result.accepted).toBe(true);
      state = result.state;
    }
    expect(state.complete).toBe(true);
    expect(state.bestStreak).toBe(2);
    expect(
      timingMeterModule.handleAction(
        state,
        { type: "stop", position: 500 },
        context,
      ).accepted,
    ).toBe(false);
    const report = timingMeterModule.createReport(state, context);
    expect(report.metrics).toMatchObject({
      perfectCount: 2,
      goodCount: 1,
      missCount: 1,
      bestStreak: 2,
    });
    expect(report.score).toBe(84);
  });

  it("replays explicit actions into the identical report", () => {
    const play = (): TimingMeterState =>
      [500, 420, 600, 1000].reduce(
        (state, position) =>
          timingMeterModule.handleAction(
            state,
            { type: "stop", position },
            context,
          ).state,
        timingMeterModule.createEncounter(context).state,
      );
    expect(timingMeterModule.createReport(play(), context)).toEqual(
      timingMeterModule.createReport(play(), context),
    );
  });
});

describe("Combination Grid adapter", () => {
  it("is deterministic and produces a generic report", () => {
    const first = combinationGridModule.createEncounter(context);
    const second = combinationGridModule.createEncounter(context);
    expect(first).toEqual(second);
    let state = first.state;
    for (const object of state.objects.slice(0, 5))
      state = combinationGridModule.handleAction(
        state,
        { type: "toggle", objectId: object.id },
        context,
      ).state;
    state = combinationGridModule.handleAction(
      state,
      { type: "submit" },
      context,
    ).state;
    expect(combinationGridModule.createReport(state, context)).toMatchObject({
      encounterId: context.encounterId,
      tags: expect.arrayContaining(["action-completed"]),
    });
  });
});

describe.each([
  {
    name: "Combination Grid",
    module: combinationGridModule,
    actions: (
      state: ReturnType<typeof combinationGridModule.createEncounter>["state"],
    ) => [
      ...[...state.objects]
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((object) => ({ type: "toggle" as const, objectId: object.id })),
      { type: "submit" as const },
    ],
  },
  {
    name: "Timing Meter",
    module: timingMeterModule,
    actions: () =>
      Array.from({ length: 4 }, () => ({
        type: "stop" as const,
        position: 500,
      })),
  },
] as const)("shared full-run scenario: $name", ({ module, actions }) => {
  it("wins six encounters, traverses shops, saves, and replays identically", () => {
    // The union is narrowed at the reusable harness boundary; both rows execute the same lifecycle.
    const run = () =>
      runGameplayModuleScenario({
        module: module as GameplayModule<unknown, unknown>,
        seed: 9876,
        actions: actions as (state: Readonly<unknown>) => readonly unknown[],
        specialRuleFor: (number) =>
          number === 3
            ? `${module.id}:special-three`
            : number === 6
              ? `${module.id}:special-six`
              : null,
      });
    const first = run();
    expect(first.state.phase).toBe("run-complete");
    expect(first.serialisedCheckpoints).toHaveLength(6);
    expect(
      first.events.filter((event) => event.type === "shop-entered"),
    ).toHaveLength(5);
    expect(run()).toEqual(first);
  });
});
