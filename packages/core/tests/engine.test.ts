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

const MODULE = "test:first";
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
  return handle(createInitialRunState(), {
    type: "start-run",
    seed,
    gameplayModuleId: MODULE,
  }).state;
}
function activate(state: RunState): RunState {
  const stored = handle(state, {
    type: "store-gameplay-session",
    session: {
      moduleId: MODULE,
      moduleVersion: 1,
      encounterId: state.currentEncounter!.id,
      data: { complete: true },
    },
  }).state;
  return handle(stored, { type: "start-encounter" }).state;
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

describe("generic run engine", () => {
  it("derives one deterministic module seed without creating gameplay state", () => {
    const a = start(99),
      b = start(99),
      c = start(100);
    expect(a).toEqual(b);
    expect(a.currentEncounter?.moduleSeed).not.toBe(
      c.currentEncounter?.moduleSeed,
    );
    expect(a.currentEncounter).toEqual({
      id: "encounter-1",
      number: 1,
      target: 29,
      rules: [],
      moduleSeed: a.currentEncounter!.moduleSeed,
    });
  });
  it("requires module-owned state before accepting a report", () => {
    const activeWithoutSession = handle(start(), {
      type: "start-encounter",
    }).state;
    const rejected = handle(activeWithoutSession, {
      type: "submit-encounter",
      report: report(activeWithoutSession, 999),
    });
    expect(rejected.state).toBe(activeWithoutSession);
    expect(rejected.events[0]).toMatchObject({ type: "command-rejected" });
  });
  it("completes the same lifecycle for an arbitrary module", () => {
    let state = start();
    for (let number = 1; number <= ENCOUNTER_COUNT; number += 1) {
      state = activate(state);
      state = handle(state, {
        type: "submit-encounter",
        report: report(state, 999),
      }).state;
      if (number < ENCOUNTER_COUNT)
        state = handle(state, { type: "advance" }).state;
    }
    expect(state.phase).toBe("run-complete");
  });
  it("rejects invalid commands atomically without advancing RNG", () => {
    const ready = start();
    expect(handle(ready, { type: "advance" }).state).toBe(ready);
    expect(
      handle(ready, {
        type: "store-gameplay-session",
        session: {
          moduleId: "test:other",
          moduleVersion: 1,
          encounterId: ready.currentEncounter!.id,
          data: null,
        },
      }).state,
    ).toBe(ready);
  });
  it("continues deterministically after JSON restoration", () => {
    let state = activate(start());
    state = handle(state, {
      type: "submit-encounter",
      report: report(state, 999),
    }).state;
    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    expect(handle(restored, { type: "advance" })).toEqual(
      handle(state, { type: "advance" }),
    );
  });
});
