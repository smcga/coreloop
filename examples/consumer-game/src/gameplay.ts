import {
  createRandom,
  randomInteger,
  type GameplayModule,
} from "@core-loop/core";
export interface DiceState {
  readonly options: readonly number[];
  readonly dices: readonly number[];
}
export type DiceAction = { readonly type: "choose"; readonly index: number };
export const diceModule: GameplayModule<DiceState, DiceAction> = {
  id: "dice:three-dice",
  version: 1,
  capabilities: ["dice:dice"],
  createEncounter(context) {
    let rng = createRandom(context.seed);
    const options: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = randomInteger(rng, 1, 10);
      rng = result.state;
      options.push(result.value);
    }
    return { state: { options, dices: [] } };
  },
  handleAction(state, action) {
    if (
      action.type !== "choose" ||
      !Number.isInteger(action.index) ||
      !state.options[action.index] ||
      state.dices.length >= 3
    )
      return { state, accepted: false, signals: [], reason: "Invalid dice" };
    const value = state.options[action.index]!;
    return {
      state: { ...state, dices: [...state.dices, value] },
      accepted: true,
      signals: [
        {
          type: "dice:value-chosen",
          tags: [value >= 7 ? "risk" : "safe"],
          values: { value },
        },
      ],
    };
  },
  createReport(state, context) {
    const score = state.dices.reduce((a, b) => a + b, 0);
    return {
      encounterId: context.encounterId,
      score,
      signals: [],
      tags: ["dice"],
      metrics: { dices: state.dices.length },
    };
  },
  getProgress(state) {
    return {
      completedActions: state.dices.length,
      totalActions: 3,
      score: state.dices.reduce((a, b) => a + b, 0),
      status: state.dices.length === 3 ? "complete" : "choosing",
      metrics: {},
    };
  },
  isComplete: (s) => s.dices.length === 3,
  createBotStrategy: () => ({
    nextAction: (state) => ({
      type: "choose",
      index: state.options.indexOf(Math.max(...state.options)),
    }),
  }),
  validateState(value) {
    if (!value || typeof value !== "object")
      throw new Error("Invalid dice state");
    return value as DiceState;
  },
  validateAction(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !("type" in value) ||
      value.type !== "choose" ||
      !("index" in value) ||
      !Number.isInteger(value.index)
    )
      throw new Error("Invalid dice action");
    return value as DiceAction;
  },
};
