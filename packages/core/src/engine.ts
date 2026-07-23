import { createRandom, randomInteger, type RandomState } from "./random";

export const ENCOUNTER_COUNT = 6;

export type RunPhase =
  | "idle"
  | "encounter-ready"
  | "encounter-active"
  | "encounter-won"
  | "run-complete"
  | "run-failed";

export interface PlayableTile {
  readonly id: string;
  readonly value: number;
  readonly tags: readonly string[];
}

export interface EncounterBrief {
  readonly id: string;
  readonly number: number;
  readonly target: number;
  readonly selectionLimit: number;
  readonly tiles: readonly PlayableTile[];
}

export interface GameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
}

export interface EncounterReport {
  readonly encounterId: string;
  readonly score: number;
  readonly tags: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly signals: readonly GameplaySignal[];
}

export interface RunState {
  readonly phase: RunPhase;
  readonly seed: number | null;
  readonly rng: RandomState;
  readonly encounterNumber: number;
  readonly currentEncounter: EncounterBrief | null;
  readonly currency: number;
  readonly lastReport: EncounterReport | null;
}

export type RunCommand =
  | { readonly type: "start-run"; readonly seed: number }
  | { readonly type: "start-encounter" }
  | { readonly type: "submit-encounter"; readonly report: EncounterReport }
  | { readonly type: "advance" };

export type RunEvent =
  | { readonly type: "run-started"; readonly seed: number }
  | { readonly type: "encounter-prepared"; readonly brief: EncounterBrief }
  | { readonly type: "encounter-started"; readonly encounterId: string }
  | {
      readonly type: "encounter-won";
      readonly encounterId: string;
      readonly score: number;
      readonly target: number;
    }
  | {
      readonly type: "encounter-lost";
      readonly encounterId: string;
      readonly score: number;
      readonly target: number;
    }
  | {
      readonly type: "currency-awarded";
      readonly amount: number;
      readonly total: number;
    }
  | { readonly type: "run-completed"; readonly currency: number }
  | { readonly type: "run-failed"; readonly encounterNumber: number }
  | {
      readonly type: "command-rejected";
      readonly command: RunCommand["type"];
      readonly phase: RunPhase;
      readonly reason: string;
    };

export interface TransitionResult {
  readonly state: RunState;
  readonly events: readonly RunEvent[];
}

export function createInitialRunState(): RunState {
  return {
    phase: "idle",
    seed: null,
    rng: createRandom(0),
    encounterNumber: 0,
    currentEncounter: null,
    currency: 0,
    lastReport: null,
  };
}

/** Small balance boundary, deliberately replaceable without changing the engine. */
export function targetForEncounter(number: number): number {
  return 25 + number * 4;
}

function prepareEncounter(
  state: RandomState,
  number: number,
): { readonly rng: RandomState; readonly brief: EncounterBrief } {
  let rng = state;
  const tags = ["cyan", "amber", "violet"] as const;
  const values = [7, 8, 9, 10, 11, 12, 7, 8, 9, 10, 11, 12];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapResult = randomInteger(rng, 0, index);
    rng = swapResult.state;
    [values[index], values[swapResult.value]] = [
      values[swapResult.value]!,
      values[index]!,
    ];
  }
  const tiles: PlayableTile[] = [];
  for (let index = 0; index < 12; index += 1) {
    const tagResult = randomInteger(rng, 0, tags.length - 1);
    rng = tagResult.state;
    tiles.push({
      id: `e${number}-t${index + 1}`,
      value: values[index]!,
      tags: [tags[tagResult.value]!],
    });
  }
  return {
    rng,
    brief: {
      id: `encounter-${number}`,
      number,
      target: targetForEncounter(number),
      selectionLimit: 5,
      tiles,
    },
  };
}

function reject(
  state: Readonly<RunState>,
  command: RunCommand,
  reason: string,
): TransitionResult {
  return {
    state,
    events: [
      {
        type: "command-rejected",
        command: command.type,
        phase: state.phase,
        reason,
      },
    ],
  };
}

export function handle(
  state: Readonly<RunState>,
  command: RunCommand,
): TransitionResult {
  switch (command.type) {
    case "start-run": {
      if (!Number.isSafeInteger(command.seed))
        return reject(state, command, "Seed must be a safe integer");
      const seed = command.seed >>> 0;
      const generated = prepareEncounter(createRandom(seed), 1);
      const next: RunState = {
        phase: "encounter-ready",
        seed,
        rng: generated.rng,
        encounterNumber: 1,
        currentEncounter: generated.brief,
        currency: 0,
        lastReport: null,
      };
      return {
        state: next,
        events: [
          { type: "run-started", seed },
          { type: "encounter-prepared", brief: generated.brief },
        ],
      };
    }
    case "start-encounter": {
      if (state.phase !== "encounter-ready" || state.currentEncounter === null)
        return reject(state, command, "No prepared encounter is available");
      return {
        state: { ...state, phase: "encounter-active", lastReport: null },
        events: [
          { type: "encounter-started", encounterId: state.currentEncounter.id },
        ],
      };
    }
    case "submit-encounter": {
      if (state.phase !== "encounter-active" || state.currentEncounter === null)
        return reject(state, command, "An active encounter is required");
      if (command.report.encounterId !== state.currentEncounter.id)
        return reject(
          state,
          command,
          "Report does not match the active encounter",
        );
      if (command.report.score < state.currentEncounter.target) {
        return {
          state: { ...state, phase: "run-failed", lastReport: command.report },
          events: [
            {
              type: "encounter-lost",
              encounterId: state.currentEncounter.id,
              score: command.report.score,
              target: state.currentEncounter.target,
            },
            { type: "run-failed", encounterNumber: state.encounterNumber },
          ],
        };
      }
      const reward = 10 + state.encounterNumber * 2;
      const total = state.currency + reward;
      const complete = state.encounterNumber === ENCOUNTER_COUNT;
      return {
        state: {
          ...state,
          phase: complete ? "run-complete" : "encounter-won",
          currency: total,
          lastReport: command.report,
        },
        events: [
          {
            type: "encounter-won",
            encounterId: state.currentEncounter.id,
            score: command.report.score,
            target: state.currentEncounter.target,
          },
          { type: "currency-awarded", amount: reward, total },
          ...(complete
            ? ([{ type: "run-completed", currency: total }] as const)
            : []),
        ],
      };
    }
    case "advance": {
      if (state.phase !== "encounter-won")
        return reject(state, command, "A won encounter is required");
      const number = state.encounterNumber + 1;
      const generated = prepareEncounter(state.rng, number);
      return {
        state: {
          ...state,
          phase: "encounter-ready",
          rng: generated.rng,
          encounterNumber: number,
          currentEncounter: generated.brief,
          lastReport: null,
        },
        events: [{ type: "encounter-prepared", brief: generated.brief }],
      };
    }
    default:
      return assertNever(command);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled command: ${JSON.stringify(value)}`);
}
