import { canonicalJson, stableHash } from "./canonical";
import { FrameworkError } from "./errors";
import type { JsonValue } from "./gameplay";
import type { PolicyReference } from "./policies";
import type { RunCommand, RunEvent, RunPhase, RunState } from "./engine";
import { FRAMEWORK_VERSION, DEFAULT_CONTENT, RNG_VERSION } from "./save";

export const REPLAY_FORMAT_VERSION = 1;
export const MAX_REPLAY_TEXT_LENGTH = 1_000_000;
export const MAX_SHARE_IDENTIFIER_LENGTH = 8_000;
export type RecordedInput =
  | {
      readonly sequence: number;
      readonly type: "run-command";
      readonly command: RunCommand;
    }
  | {
      readonly sequence: number;
      readonly type: "gameplay-action";
      readonly moduleId: string;
      readonly action: JsonValue;
    };
export interface ReplayCheckpoint {
  readonly sequence: number;
  readonly boundary: string;
  readonly stateHash: string;
  readonly eventHash: string;
}
export interface ReplayEnvelope {
  readonly formatVersion: typeof REPLAY_FORMAT_VERSION;
  readonly frameworkVersion: string;
  readonly content: { readonly packId: string; readonly packVersion: number };
  readonly gameplay: {
    readonly moduleId: string;
    readonly moduleVersion: number;
  };
  readonly policies: Readonly<Record<string, PolicyReference>>;
  readonly customEffects: readonly PolicyReference[];
  readonly rngVersion: string;
  readonly seed: number;
  readonly loadoutId?: string;
  readonly inputs: readonly RecordedInput[];
  readonly checkpoints: readonly ReplayCheckpoint[];
  readonly finalStateHash: string;
  readonly finalEventHash: string;
}
export interface ReplayExecutor {
  initialState(seed: number, moduleId: string): RunState;
  runCommand(
    state: Readonly<RunState>,
    command: RunCommand,
  ): { readonly state: RunState; readonly events: readonly RunEvent[] };
  gameplayAction(
    state: Readonly<RunState>,
    moduleId: string,
    action: JsonValue,
  ): { readonly state: RunState; readonly events: readonly RunEvent[] };
}
export interface ReplayDivergence {
  readonly sequence: number;
  readonly inputType: RecordedInput["type"] | "final";
  readonly expectedStateHash: string;
  readonly actualStateHash: string;
  readonly expectedEventHash: string;
  readonly actualEventHash: string;
  readonly phase: RunPhase;
  readonly moduleId: string;
  readonly encounterNumber: number;
  readonly message: string;
}
export type ReplayVerification =
  | {
      readonly ok: true;
      readonly state: RunState;
      readonly stateHash: string;
      readonly eventHash: string;
    }
  | { readonly ok: false; readonly divergence: ReplayDivergence };

export function exportReplay(replay: ReplayEnvelope): string {
  validateReplay(replay);
  return JSON.stringify(replay, null, 2);
}
export function importReplay(text: string): ReplayEnvelope {
  if (text.length > MAX_REPLAY_TEXT_LENGTH)
    throw new FrameworkError(
      "invalid-replay",
      "Replay text exceeds the maximum size",
      { expected: MAX_REPLAY_TEXT_LENGTH, actual: text.length },
    );
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new FrameworkError(
      "malformed-json",
      "Replay is not valid JSON",
      { path: "$" },
      { cause },
    );
  }
  validateReplay(value);
  return value;
}
export function replayIdentifier(replay: ReplayEnvelope): string {
  const text = exportReplay(replay);
  const encoded = encodeURIComponent(text);
  if (encoded.length > MAX_SHARE_IDENTIFIER_LENGTH)
    throw new FrameworkError(
      "invalid-replay",
      "Replay is too large for a URL; use text export",
      { expected: MAX_SHARE_IDENTIFIER_LENGTH, actual: encoded.length },
    );
  return `coreloop-replay-v1:${encoded}`;
}
export function parseReplayIdentifier(identifier: string): ReplayEnvelope {
  const prefix = "coreloop-replay-v1:";
  if (!identifier.startsWith(prefix))
    throw new FrameworkError(
      "invalid-replay",
      "Unknown replay identifier version",
      { actual: identifier.slice(0, 32) },
    );
  try {
    return importReplay(decodeURIComponent(identifier.slice(prefix.length)));
  } catch (cause) {
    if (cause instanceof FrameworkError) throw cause;
    throw new FrameworkError(
      "invalid-replay",
      "Malformed replay identifier",
      {},
      { cause },
    );
  }
}

export function verifyReplay(
  replay: ReplayEnvelope,
  executor: ReplayExecutor,
): ReplayVerification {
  validateReplay(replay);
  let state = executor.initialState(replay.seed, replay.gameplay.moduleId);
  const events: RunEvent[] = [];
  for (const input of replay.inputs) {
    let result;
    try {
      result =
        input.type === "run-command"
          ? executor.runCommand(state, input.command)
          : executor.gameplayAction(state, input.moduleId, input.action);
    } catch (cause) {
      throw new FrameworkError(
        "invalid-replay-action",
        `Replay input ${input.sequence} failed`,
        { inputSequence: input.sequence, moduleId: replay.gameplay.moduleId },
        { cause },
      );
    }
    state = result.state;
    events.push(...result.events);
    const checkpoint = replay.checkpoints.find(
      (item) => item.sequence === input.sequence,
    );
    if (checkpoint) {
      const actualStateHash = stableHash(state);
      const actualEventHash = stableHash(events);
      if (
        actualStateHash !== checkpoint.stateHash ||
        actualEventHash !== checkpoint.eventHash
      )
        return {
          ok: false,
          divergence: divergence(
            input.sequence,
            input.type,
            checkpoint.stateHash,
            actualStateHash,
            checkpoint.eventHash,
            actualEventHash,
            state,
          ),
        };
    }
  }
  const stateHash = stableHash(state),
    eventHash = stableHash(events);
  if (
    stateHash !== replay.finalStateHash ||
    eventHash !== replay.finalEventHash
  )
    return {
      ok: false,
      divergence: divergence(
        replay.inputs.length,
        "final",
        replay.finalStateHash,
        stateHash,
        replay.finalEventHash,
        eventHash,
        state,
      ),
    };
  return { ok: true, state, stateHash, eventHash };
}
function divergence(
  sequence: number,
  inputType: RecordedInput["type"] | "final",
  expectedStateHash: string,
  actualStateHash: string,
  expectedEventHash: string,
  actualEventHash: string,
  state: RunState,
): ReplayDivergence {
  return {
    sequence,
    inputType,
    expectedStateHash,
    actualStateHash,
    expectedEventHash,
    actualEventHash,
    phase: state.phase,
    moduleId: state.gameplayModuleId,
    encounterNumber: state.encounterNumber,
    message: `Replay diverged at input ${sequence} (${inputType}) during ${state.phase}`,
  };
}

export function createReplay(
  options: Omit<
    ReplayEnvelope,
    "formatVersion" | "frameworkVersion" | "content" | "rngVersion"
  > & { readonly content?: ReplayEnvelope["content"] },
): ReplayEnvelope {
  return {
    formatVersion: REPLAY_FORMAT_VERSION,
    frameworkVersion: FRAMEWORK_VERSION,
    content: options.content ?? DEFAULT_CONTENT,
    rngVersion: RNG_VERSION,
    ...options,
  };
}
function validateReplay(value: unknown): asserts value is ReplayEnvelope {
  if (
    !record(value) ||
    value.formatVersion !== REPLAY_FORMAT_VERSION ||
    !record(value.gameplay) ||
    typeof value.gameplay.moduleId !== "string" ||
    !Number.isSafeInteger(value.gameplay.moduleVersion) ||
    !Number.isSafeInteger(value.seed) ||
    !Array.isArray(value.inputs) ||
    !Array.isArray(value.checkpoints) ||
    typeof value.finalStateHash !== "string" ||
    typeof value.finalEventHash !== "string"
  )
    throw new FrameworkError("invalid-replay", "Replay envelope is invalid", {
      path: "$",
      ...(record(value) && typeof value.formatVersion === "number"
        ? { replayVersion: value.formatVersion }
        : {}),
    });
  value.inputs.forEach((input, index) => {
    if (
      !record(input) ||
      input.sequence !== index + 1 ||
      (input.type !== "run-command" && input.type !== "gameplay-action")
    )
      throw new FrameworkError(
        "invalid-replay-action",
        `Invalid replay input at index ${index}`,
        { path: `inputs[${index}]`, inputSequence: index + 1 },
      );
  });
  canonicalJson(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
