import {
  createGameplayModuleRegistry,
  randomInteger,
  type EncounterReport,
  type GameplayModule,
} from "@core-loop/core";

export const COMBINATION_GRID_ID = "threshold-lab:combination-grid";
export const TIMING_METER_ID = "threshold-lab:timing-meter";

export function gameplayInstruction(moduleId: string): string {
  return moduleId === TIMING_METER_ID
    ? "Tap STOP when the marker reaches the bright centre"
    : "Select up to five objects, then submit";
}

export interface GridObject {
  readonly id: string;
  readonly value: number;
  readonly tags: readonly string[];
}
export interface CombinationGridState {
  readonly objects: readonly GridObject[];
  readonly selectedIds: readonly string[];
  readonly selectionLimit: number;
  readonly complete: boolean;
}
export type CombinationGridAction =
  | { readonly type: "toggle"; readonly objectId: string }
  | { readonly type: "submit" };

const gridReport = (
  state: CombinationGridState,
  encounterId: string,
): EncounterReport => {
  const selected = state.objects.filter((object) =>
    state.selectedIds.includes(object.id),
  );
  const base = selected.reduce((total, object) => total + object.value, 0);
  const values = selected.map((object) => object.value).sort((a, b) => a - b);
  const pair = new Set(values).size < values.length;
  const sequence = values.some(
    (value, index) =>
      values.includes(value + 1) && values.includes(value + 2) && index >= 0,
  );
  const tagCounts = selected.reduce<Record<string, number>>(
    (counts, object) => {
      for (const tag of object.tags) counts[tag] = (counts[tag] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const matching = Math.max(0, ...Object.values(tagCounts)) >= 3;
  const score =
    base + (pair ? 10 : 0) + (sequence ? 15 : 0) + (matching ? 12 : 0);
  const tags = [
    "action-completed",
    ...(pair ? ["pair"] : []),
    ...(sequence ? ["sequence"] : []),
    ...(matching ? ["matching-tag"] : []),
  ];
  return {
    encounterId,
    score,
    tags,
    metrics: {
      base,
      selectedCount: selected.length,
      firstValue: selected[0]?.value ?? 0,
      cyan: tagCounts.cyan ?? 0,
      pairCount: pair ? 1 : 0,
      sequenceCount: sequence ? 1 : 0,
    },
    signals: [{ type: "score", tags, values: { score } }],
  };
};

export const combinationGridModule: GameplayModule<
  CombinationGridState,
  CombinationGridAction
> = {
  id: COMBINATION_GRID_ID,
  version: 1,
  displayName: "Combination Grid",
  description: "Select numbered objects to build pairs, runs and tag matches.",
  capabilities: [
    "score",
    "action",
    "tagged-object",
    "selection",
    "pair-pattern",
    "sequence-pattern",
    "attachments",
  ],
  createEncounter(context) {
    let rng = context.rng;
    const tags = ["cyan", "amber", "violet"] as const;
    const objects: GridObject[] = [];
    for (let index = 0; index < 12; index++) {
      const value = randomInteger(rng, 7, 12);
      rng = value.state;
      const tag = randomInteger(rng, 0, tags.length - 1);
      rng = tag.state;
      objects.push({
        id: `${context.encounterId}-object-${index + 1}`,
        value: value.value,
        tags: [tags[tag.value]!],
      });
    }
    return {
      rng,
      state: {
        objects,
        selectedIds: [],
        selectionLimit: context.specialRuleId === "grid:reduced-limit" ? 4 : 5,
        complete: false,
      },
    };
  },
  handleAction(state, action) {
    if (state.complete)
      return {
        state,
        accepted: false,
        signals: [],
        reason: "Encounter is complete",
      };
    if (action.type === "submit") {
      if (!state.selectedIds.length)
        return {
          state,
          accepted: false,
          signals: [],
          reason: "Select an object first",
        };
      return {
        state: { ...state, complete: true },
        accepted: true,
        signals: [
          { type: "action-completed", tags: ["selection"], values: {} },
        ],
      };
    }
    if (!state.objects.some((object) => object.id === action.objectId))
      return { state, accepted: false, signals: [], reason: "Unknown object" };
    const selected = state.selectedIds.includes(action.objectId);
    if (!selected && state.selectedIds.length >= state.selectionLimit)
      return {
        state,
        accepted: false,
        signals: [],
        reason: "Selection limit reached",
      };
    return {
      state: {
        ...state,
        selectedIds: selected
          ? state.selectedIds.filter((id) => id !== action.objectId)
          : [...state.selectedIds, action.objectId],
      },
      accepted: true,
      signals: [],
    };
  },
  createReport: (state, context) => gridReport(state, context.encounterId),
  getProgress: (state) => ({
    completedActions: state.complete ? 1 : 0,
    totalActions: 1,
    score: gridReport(state, "preview").score,
    status: state.complete
      ? "complete"
      : `${state.selectedIds.length}/${state.selectionLimit} selected`,
    metrics: { selectedCount: state.selectedIds.length },
  }),
  isComplete: (state) => state.complete,
  validateState(value) {
    if (
      !isRecord(value) ||
      !Array.isArray(value.objects) ||
      !Array.isArray(value.selectedIds)
    )
      throw new Error("Invalid Combination Grid state");
    return value as unknown as CombinationGridState;
  },
  createBotStrategy: () => ({
    nextAction: (state) =>
      state.selectedIds.length < state.selectionLimit
        ? {
            type: "toggle",
            objectId: state.objects[state.selectedIds.length]!.id,
          }
        : { type: "submit" },
  }),
};

export type TimingGrade = "perfect" | "good" | "fair" | "miss";
export interface TimingAttempt {
  readonly position: number;
  readonly grade: TimingGrade;
  readonly side: "early" | "late" | "centred" | "missed";
  readonly score: number;
}
export interface TimingMeterState {
  readonly attempts: readonly TimingAttempt[];
  readonly attemptCount: number;
  readonly speedTicks: number;
  readonly initialDirection: -1 | 1;
  readonly perfectWidth: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly complete: boolean;
}
export type TimingMeterAction = {
  readonly type: "stop";
  readonly position: number;
};

export function classifyTimingPosition(
  position: number,
  perfectWidth = 100,
): Pick<TimingAttempt, "grade" | "side" | "score"> {
  if (!Number.isInteger(position) || position < 0 || position > 1000)
    throw new Error("Timing position must be an integer from 0 to 1000");
  const distance = Math.abs(position - 500);
  const grade: TimingGrade =
    distance <= perfectWidth / 2
      ? "perfect"
      : distance <= 160
        ? "good"
        : distance <= 300
          ? "fair"
          : "miss";
  return {
    grade,
    side:
      grade === "miss"
        ? "missed"
        : grade === "perfect"
          ? "centred"
          : position < 500
            ? "early"
            : "late",
    score: { perfect: 30, good: 20, fair: 12, miss: 0 }[grade],
  };
}

export const timingMeterModule: GameplayModule<
  TimingMeterState,
  TimingMeterAction
> = {
  id: TIMING_METER_ID,
  version: 1,
  displayName: "Timing Meter",
  description:
    "Stop a moving marker near the centre over four timing attempts.",
  capabilities: [
    "score",
    "action",
    "accuracy",
    "streak",
    "perfect-result",
    "early-late",
  ],
  createEncounter(context) {
    let rng = context.rng;
    const speed = randomInteger(rng, 7, 11);
    rng = speed.state;
    const direction = randomInteger(rng, 0, 1);
    rng = direction.state;
    const narrow = context.specialRuleId === "timing:narrow-zones";
    const fewer = context.specialRuleId === "timing:fewer-attempts";
    return {
      rng,
      state: {
        attempts: [],
        attemptCount: fewer ? 3 : 4,
        speedTicks:
          speed.value +
          (context.specialRuleId === "timing:faster-marker" ? 4 : 0),
        initialDirection: direction.value ? 1 : -1,
        perfectWidth: narrow ? 60 : 100,
        currentStreak: 0,
        bestStreak: 0,
        complete: false,
      },
    };
  },
  handleAction(state, action) {
    if (state.complete)
      return {
        state,
        accepted: false,
        signals: [],
        reason: "Encounter is complete",
      };
    let result: ReturnType<typeof classifyTimingPosition>;
    try {
      result = classifyTimingPosition(action.position, state.perfectWidth);
    } catch (error) {
      return {
        state,
        accepted: false,
        signals: [],
        reason: (error as Error).message,
      };
    }
    const attempt = { position: action.position, ...result };
    const streak = result.grade === "miss" ? 0 : state.currentStreak + 1;
    const attempts = [...state.attempts, attempt];
    const complete = attempts.length === state.attemptCount;
    const tags = [
      "action-completed",
      result.grade,
      result.side,
      ...(streak > 1 ? ["streak"] : []),
      ...(attempts.length === 1 ? ["attempt-first"] : []),
      ...(complete ? ["attempt-last"] : []),
    ];
    return {
      state: {
        ...state,
        attempts,
        currentStreak: streak,
        bestStreak: Math.max(state.bestStreak, streak),
        complete,
      },
      accepted: true,
      signals: [
        {
          type: "score-contribution",
          tags,
          values: { score: result.score, position: action.position, streak },
        },
      ],
    };
  },
  createReport(state, context) {
    if (!state.complete)
      throw new Error("Timing Meter encounter is not complete");
    const count = (grade: TimingGrade) =>
      state.attempts.filter((a) => a.grade === grade).length;
    const score =
      state.attempts.reduce((sum, attempt) => sum + attempt.score, 0) +
      state.bestStreak * 2;
    const tags = [
      ...new Set([
        "action-completed",
        ...state.attempts.map((a) => a.grade),
        ...(count("miss") ? ["miss"] : ["no-miss"]),
        ...(count("perfect") ? ["perfect"] : []),
      ]),
    ];
    return {
      encounterId: context.encounterId,
      score,
      tags,
      metrics: {
        perfectCount: count("perfect"),
        goodCount: count("good"),
        fairCount: count("fair"),
        missCount: count("miss"),
        earlyCount: state.attempts.filter((a) => a.side === "early").length,
        lateCount: state.attempts.filter((a) => a.side === "late").length,
        bestStreak: state.bestStreak,
        attemptCount: state.attempts.length,
        accuracyTotal: state.attempts.reduce(
          (sum, a) => sum + (500 - Math.abs(a.position - 500)),
          0,
        ),
        firstValue: state.attempts[0]?.score ?? 0,
      },
      signals: state.attempts.map((attempt, index) => ({
        type: "action-completed",
        sourceId: `attempt-${index + 1}`,
        tags: [attempt.grade, attempt.side],
        values: { score: attempt.score },
      })),
    };
  },
  getProgress: (state) => ({
    completedActions: state.attempts.length,
    totalActions: state.attemptCount,
    score: state.attempts.reduce((sum, attempt) => sum + attempt.score, 0),
    status: state.attempts.at(-1)?.grade ?? "Tap Stop near the centre",
    metrics: { streak: state.currentStreak, bestStreak: state.bestStreak },
  }),
  isComplete: (state) => state.complete,
  validateState(value) {
    if (
      !isRecord(value) ||
      !Array.isArray(value.attempts) ||
      !Number.isSafeInteger(value.attemptCount) ||
      typeof value.complete !== "boolean"
    )
      throw new Error("Invalid Timing Meter state");
    return value as unknown as TimingMeterState;
  },
  createBotStrategy: () => ({
    nextAction: () => ({ type: "stop", position: 500 }),
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const gameplayModules = createGameplayModuleRegistry([
  combinationGridModule as GameplayModule<unknown, unknown>,
  timingMeterModule as GameplayModule<unknown, unknown>,
]);
