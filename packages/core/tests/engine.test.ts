import { describe, expect, it } from "vitest";
import {
  createInitialRunState,
  createRandom,
  ENCOUNTER_COUNT,
  handle,
  nextUint32,
  type EncounterReport,
  type RunState,
} from "../src/index";

function report(state: RunState, score: number): EncounterReport {
  return {
    encounterId: state.currentEncounter!.id,
    score,
    tags: [],
    metrics: {},
    signals: [],
  };
}
function start(seed = 123): RunState {
  return handle(createInitialRunState(), { type: "start-run", seed }).state;
}

describe("Mulberry32", () => {
  it("matches fixed uint32 vectors", () => {
    let rng = createRandom(1);
    const values: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const next = nextUint32(rng);
      rng = next.state;
      values.push(next.value);
    }
    expect(values).toEqual([
      2693262067, 11749833, 2265367787, 4213581821, 4159151403,
    ]);
  });
});

describe("run engine", () => {
  it("starts a seeded run and encounter with ordered events", () => {
    const started = handle(createInitialRunState(), {
      type: "start-run",
      seed: 42,
    });
    expect(started.state.phase).toBe("encounter-ready");
    expect(started.events.map((event) => event.type)).toEqual([
      "run-started",
      "encounter-prepared",
    ]);
    const active = handle(started.state, { type: "start-encounter" });
    expect(active.state.phase).toBe("encounter-active");
    expect(active.events[0]?.type).toBe("encounter-started");
  });
  it("replays identically and allows seeds to differ", () => {
    expect(start(99)).toEqual(start(99));
    expect(start(99).currentEncounter?.tiles).not.toEqual(
      start(100).currentEncounter?.tiles,
    );
  });
  it("loses immediately below target", () => {
    const active = handle(start(), { type: "start-encounter" }).state;
    const result = handle(active, {
      type: "submit-encounter",
      report: report(active, active.currentEncounter!.target - 1),
    });
    expect(result.state.phase).toBe("run-failed");
    expect(result.events.map((event) => event.type)).toEqual([
      "encounter-lost",
      "run-failed",
    ]);
  });
  it("wins at target, awards currency, and completes all six", () => {
    let state = start();
    for (let number = 1; number <= ENCOUNTER_COUNT; number += 1) {
      state = handle(state, { type: "start-encounter" }).state;
      const won = handle(state, {
        type: "submit-encounter",
        report: report(state, state.currentEncounter!.target),
      });
      expect(won.events.slice(0, 2).map((event) => event.type)).toEqual([
        "encounter-won",
        "currency-awarded",
      ]);
      expect(won.state.currency).toBeGreaterThan(0);
      state = won.state;
      if (number < ENCOUNTER_COUNT)
        state = handle(state, { type: "advance" }).state;
    }
    expect(state.phase).toBe("run-complete");
    expect(state.encounterNumber).toBe(6);
  });
  it("rejects invalid commands in important phases without changing state", () => {
    const idle = createInitialRunState();
    expect(handle(idle, { type: "advance" })).toMatchObject({
      state: idle,
      events: [{ type: "command-rejected", phase: "idle" }],
    });
    const ready = start();
    expect(handle(ready, { type: "advance" }).events[0]?.type).toBe(
      "command-rejected",
    );
    const active = handle(ready, { type: "start-encounter" }).state;
    expect(handle(active, { type: "start-encounter" }).events[0]?.type).toBe(
      "command-rejected",
    );
  });
  it("preserves the next generated encounter through JSON restoration", () => {
    let state = handle(start(), { type: "start-encounter" }).state;
    state = handle(state, {
      type: "submit-encounter",
      report: report(state, 999),
    }).state;
    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    expect(handle(restored, { type: "advance" })).toEqual(
      handle(state, { type: "advance" }),
    );
  });
  it("runs under Node without browser or Phaser globals", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });
});
