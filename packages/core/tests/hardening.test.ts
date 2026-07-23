import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EffectHandlerRegistry,
  FrameworkError,
  PolicyRegistry,
  SaveMigrationRegistry,
  canonicalJson,
  createInitialRunState,
  createReplay,
  createSaveFile,
  defaultPolicies,
  exportReplay,
  handle,
  importReplay,
  loadSaveFile,
  parseReplayIdentifier,
  replayIdentifier,
  stableHash,
  verifyReplay,
  type ReplayEnvelope,
  type RunCommand,
} from "../src";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/saves/${name}`, import.meta.url), "utf8");

describe("canonical serialisation", () => {
  it("sorts object keys but preserves array order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
    expect(stableHash({ debug: 1, state: 2 }, { excludeKeys: ["debug"] })).toBe(
      stableHash({ state: 2 }),
    );
  });
  it.each([undefined, NaN, Infinity, () => 1])(
    "rejects unsupported %s",
    (value) => expect(() => canonicalJson(value)).toThrowError(FrameworkError),
  );
});

describe("policies and external effects", () => {
  it("registers small versioned policies and preserves default parity", () => {
    const registry = new PolicyRegistry([defaultPolicies.target]);
    expect(
      registry
        .get<typeof defaultPolicies.target>({
          id: "core:linear-target",
          version: 1,
        })
        .targetForEncounter({ encounterNumber: 6 }),
    ).toBe(49);
    expect(() =>
      registry.get({ id: "missing:policy", version: 1 }),
    ).toThrowError(expect.objectContaining({ code: "unknown-policy" }));
    expect(() => registry.register(defaultPolicies.target)).toThrowError(
      expect.objectContaining({ code: "duplicate-id" }),
    );
  });
  it("requires namespaced, unique, versioned effect handlers and isolates mutation", () => {
    const registry = new EffectHandlerRegistry();
    registry.register(
      "test:add-tag",
      ({ state }) => ({
        state: {
          ...state,
          encounterTags: [...state.encounterTags, "external"],
        },
      }),
      2,
    );
    expect(registry.references()).toEqual([{ id: "test:add-tag", version: 2 }]);
    expect(() => registry.register("bad", () => ({}))).toThrowError(
      FrameworkError,
    );
    expect(() => registry.register("test:add-tag", () => ({}))).toThrowError(
      expect.objectContaining({ code: "duplicate-id" }),
    );
    expect(() => registry.register("core:builtin", () => ({}))).toThrowError(
      FrameworkError,
    );
  });
});

describe("versioned save migrations", () => {
  const compatibility = {
    contentPacks: new Map([["threshold-lab:default", [3]]]),
    gameplayModules: new Map([["threshold-lab:combination-grid", [1]]]),
  };
  it.each([
    "v1-earliest.json",
    "v2-before-modules.json",
    "v3-before-current-schema.json",
  ])(
    "migrates textual fixture %s without changing deterministic state",
    (name) => {
      const loaded = loadSaveFile(fixture(name), compatibility);
      expect(loaded.save.formatVersion).toBe(4);
      expect(loaded.save.run.rng).toEqual({
        algorithm: "mulberry32",
        value: 0,
      });
      expect(loaded.migratedFrom).not.toBeNull();
    },
  );
  it("does not rewrite a current save", () =>
    expect(
      loadSaveFile(JSON.stringify(createSaveFile(createInitialRunState())))
        .migratedFrom,
    ).toBeNull());
  it("reports corrupt, missing content, and module incompatibility", () => {
    expect(() =>
      loadSaveFile(fixture("corrupted.json"), compatibility),
    ).toThrowError(
      expect.objectContaining({ code: "unsupported-save-version" }),
    );
    expect(() =>
      loadSaveFile(fixture("missing-pack.json"), compatibility),
    ).toThrowError(expect.objectContaining({ code: "missing-content-pack" }));
    expect(() =>
      loadSaveFile(fixture("unsupported-module.json"), compatibility),
    ).toThrowError(
      expect.objectContaining({ code: "incompatible-module-version" }),
    );
  });
  it("keeps input immutable and diagnoses missing/duplicate/failing steps", () => {
    const input = { formatVersion: 1, nested: { value: 2 } };
    const registry = new SaveMigrationRegistry().register({
      fromVersion: 1,
      toVersion: 2,
      migrate: (value) => ({ ...value, formatVersion: 2 }),
    });
    expect(registry.migrate(input, 2)).not.toBe(input);
    expect(input.formatVersion).toBe(1);
    expect(() =>
      registry.register({
        fromVersion: 1,
        toVersion: 3,
        migrate: () => ({ formatVersion: 3 }),
      }),
    ).toThrowError(expect.objectContaining({ code: "duplicate-id" }));
    expect(() => new SaveMigrationRegistry().migrate(input, 2)).toThrowError(
      expect.objectContaining({ code: "migration-path-unavailable" }),
    );
    expect(() =>
      new SaveMigrationRegistry()
        .register({
          fromVersion: 1,
          toVersion: 2,
          migrate: () => {
            throw new Error("boom");
          },
        })
        .migrate(input, 2),
    ).toThrowError(expect.objectContaining({ code: "migration-failed" }));
  });
});

describe("deterministic replay", () => {
  const commands: RunCommand[] = [
    { type: "start-run", seed: 42 },
    { type: "start-encounter" },
  ];
  const execute = (inputs = commands) => {
    let state = createInitialRunState();
    const events: unknown[] = [];
    const checkpoints = [];
    for (let i = 0; i < inputs.length; i++) {
      const result = handle(state, inputs[i]!);
      state = result.state;
      events.push(...result.events);
      checkpoints.push({
        sequence: i + 1,
        boundary: inputs[i]!.type,
        stateHash: stableHash(state),
        eventHash: stableHash(events),
      });
    }
    return { state, events, checkpoints };
  };
  const make = (): ReplayEnvelope => {
    const result = execute();
    return createReplay({
      gameplay: {
        moduleId: "threshold-lab:combination-grid",
        moduleVersion: 1,
      },
      policies: {},
      customEffects: [],
      seed: 42,
      inputs: commands.map((command, i) => ({
        sequence: i + 1,
        type: "run-command" as const,
        command,
      })),
      checkpoints: result.checkpoints,
      finalStateHash: stableHash(result.state),
      finalEventHash: stableHash(result.events),
    });
  };
  const executor = {
    initialState: () => createInitialRunState(),
    runCommand: handle,
    gameplayAction: () => {
      throw new Error("not used");
    },
  };
  it("exports, imports and verifies identical state and ordered events", () => {
    const replay = importReplay(exportReplay(make()));
    expect(verifyReplay(replay, executor)).toMatchObject({
      ok: true,
      stateHash: replay.finalStateHash,
    });
  });
  it("round trips a bounded share identifier", () =>
    expect(parseReplayIdentifier(replayIdentifier(make()))).toEqual(make()));
  it("stops at the first modified command with actionable divergence", () => {
    const replay = make();
    const modified = {
      ...replay,
      inputs: [
        replay.inputs[0]!,
        {
          sequence: 2,
          type: "run-command" as const,
          command: { type: "abandon-run" as const },
        },
      ],
    };
    expect(verifyReplay(modified, executor)).toMatchObject({
      ok: false,
      divergence: {
        sequence: 2,
        inputType: "run-command",
        phase: "abandoned",
        moduleId: "threshold-lab:combination-grid",
        encounterNumber: 0,
      },
    });
  });
  it("rejects malformed and oversized replay text", () => {
    expect(() => importReplay("{")).toThrowError(
      expect.objectContaining({ code: "malformed-json" }),
    );
    expect(() => importReplay("x".repeat(1_000_001))).toThrowError(
      expect.objectContaining({ code: "invalid-replay" }),
    );
  });
});
