import { randomInteger, type GameplayModule } from "@core-loop/core";
export interface ChoiceState {
  readonly options: readonly number[];
  readonly choices: readonly number[];
}
export type ChoiceAction = { readonly type: "choose"; readonly index: number };
export const choiceModule: GameplayModule<ChoiceState, ChoiceAction> = {
  id: "starter:three-choice",
  version: 1,
  displayName: "Three Choice",
  description: "Choose three generated values.",
  capabilities: ["starter:choice"],
  createEncounter(context) {
    let rng = context.rng;
    const options: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = randomInteger(rng, 1, 10);
      rng = result.state;
      options.push(result.value);
    }
    return { state: { options, choices: [] }, rng };
  },
  handleAction(state, action) {
    if (
      action.type !== "choose" ||
      !Number.isInteger(action.index) ||
      !state.options[action.index] ||
      state.choices.length >= 3
    )
      return { state, accepted: false, signals: [], reason: "Invalid choice" };
    const value = state.options[action.index]!;
    return {
      state: { ...state, choices: [...state.choices, value] },
      accepted: true,
      signals: [
        {
          type: "starter:value-chosen",
          tags: [value >= 7 ? "risk" : "safe"],
          values: { value },
        },
      ],
    };
  },
  createReport(state, context) {
    const score = state.choices.reduce((a, b) => a + b, 0);
    return {
      encounterId: context.encounterId,
      score,
      signals: [],
      tags: ["choice"],
      metrics: { choices: state.choices.length },
    };
  },
  getProgress(state) {
    return {
      completedActions: state.choices.length,
      totalActions: 3,
      score: state.choices.reduce((a, b) => a + b, 0),
      status: state.choices.length === 3 ? "complete" : "choosing",
      metrics: {},
    };
  },
  isComplete: (s) => s.choices.length === 3,
  validateState(value) {
    if (!value || typeof value !== "object")
      throw new Error("Invalid choice state");
    return value as ChoiceState;
  },
};
