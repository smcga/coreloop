import { describe, expect, it } from "vitest";
import {
  applyUnlockPolicy,
  createInitialRunState,
  createPlayerProfile,
  defaultPolicies,
  handle,
  loadPlayerProfile,
  ProfileMigrationRegistry,
  type RunPolicySet,
} from "../src";

const policies: RunPolicySet = {
  ...defaultPolicies,
  schedule: {
    id: "test:stages",
    version: 1,
    createSchedule: () => [],
    createStages: () => [
      {
        id: "test:first",
        ordinal: 1,
        encounters: [
          { id: "a", ordinal: 1, kind: "ordinary", rules: [] },
          { id: "b", ordinal: 2, kind: "special", rules: [] },
        ],
      },
      {
        id: "test:second",
        ordinal: 2,
        encounters: [{ id: "c", ordinal: 3, kind: "ordinary", rules: [] }],
      },
    ],
  },
};

describe("stage progression", () => {
  it("adapts flat schedules and starts a single stage", () => {
    const result = handle(createInitialRunState(), {
      type: "start-run",
      seed: 1,
      gameplayModuleId: "test:module",
    });
    expect(result.state.stages).toHaveLength(1);
    expect(result.state.progress).toEqual({
      stagePosition: 0,
      encounterPositionInStage: 0,
    });
    expect(result.events.map((event) => event.type).slice(0, 3)).toEqual([
      "run-started",
      "stage-started",
      "encounter-prepared",
    ]);
  });

  it("authors unequal stages and special encounters without fixed constants", () => {
    const result = handle(
      createInitialRunState({ policies }),
      { type: "start-run", seed: 2, gameplayModuleId: "test:module" },
      { policies },
    );
    expect(result.state.stages.map((stage) => stage.encounters.length)).toEqual(
      [2, 1],
    );
    expect(result.state.schedule[1]?.kind).toBe("special");
  });

  it("crosses a stage atomically with ordered lifecycle events", () => {
    const started = handle(
      createInitialRunState({ policies }),
      { type: "start-run", seed: 2, gameplayModuleId: "test:module" },
      { policies },
    ).state;
    const boundary = {
      ...started,
      phase: "reward" as const,
      schedulePosition: 1,
      encounterNumber: 2,
      currentEncounter: { ...started.currentEncounter!, id: "b", number: 2 },
      progress: { stagePosition: 0, encounterPositionInStage: 1 },
      pendingRoute: { type: "next-encounter" as const },
    };
    const result = handle(boundary, { type: "advance" }, { policies });
    expect(result.state.progress).toEqual({
      stagePosition: 1,
      encounterPositionInStage: 0,
    });
    expect(result.events.map((event) => event.type).slice(0, 3)).toEqual([
      "stage-completed",
      "stage-started",
      "encounter-prepared",
    ]);
  });
});

describe("persistent profiles", () => {
  it("applies deterministic namespaced unlocks without removing unknown IDs", () => {
    const profile = {
      ...createPlayerProfile({ packId: "test:pack", packVersion: 1 }),
      unlockedIds: ["legacy:unknown"],
    };
    const next = applyUnlockPolicy(
      profile,
      { outcome: "won", loadoutId: "test:first", completedEncounterIds: ["a"] },
      {
        id: "test:unlock",
        version: 1,
        evaluate: ({ outcome }) =>
          outcome === "won" ? ["test:second-loadout"] : [],
      },
    );
    expect(next.unlockedIds).toEqual(["legacy:unknown", "test:second-loadout"]);
  });

  it("migrates independently and diagnoses incompatible content", () => {
    const migrations = new ProfileMigrationRegistry().register({
      fromVersion: 1,
      toVersion: 2,
      migrate: (old) => ({ ...old, formatVersion: 2 }),
    });
    const profile = createPlayerProfile({
      packId: "test:pack",
      packVersion: 1,
    });
    expect(migrations.migrate({ ...profile }, 2).formatVersion).toBe(2);
    expect(() =>
      loadPlayerProfile(JSON.stringify(profile), {
        packId: "other:pack",
        packVersion: 1,
      }),
    ).toThrow(/incompatible/i);
  });
});
