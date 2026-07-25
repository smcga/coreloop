import { randomInteger, type GameplayModule } from "@core-loop/core";
export interface GardenState {
  readonly plants: readonly {
    growth: number;
    water: number;
    resilience: number;
  }[];
  readonly planted: readonly number[];
}
export type GardenAction = { readonly type: "plant"; readonly index: number };
export const gardenModule: GameplayModule<GardenState, GardenAction> = {
  id: "garden-loop:planting",
  version: 1,
  displayName: "Planting Plan",
  description: "Plant a resilient two-crop arrangement.",
  capabilities: ["garden-loop:plants"],
  createEncounter(context) {
    let rng = context.rng;
    const plants = [];
    for (let i = 0; i < 3; i++) {
      const g = randomInteger(rng, 2, 9);
      rng = g.state;
      const w = randomInteger(rng, 1, 5);
      rng = w.state;
      const r = randomInteger(rng, 1, 5);
      rng = r.state;
      plants.push({ growth: g.value, water: w.value, resilience: r.value });
    }
    return { state: { plants, planted: [] }, rng };
  },
  handleAction(state, action) {
    if (
      action.type !== "plant" ||
      !state.plants[action.index] ||
      state.planted.includes(action.index) ||
      state.planted.length >= 2
    )
      return {
        state,
        accepted: false,
        signals: [],
        reason: "Choose another plant",
      };
    const p = state.plants[action.index]!;
    return {
      state: { ...state, planted: [...state.planted, action.index] },
      accepted: true,
      signals: [
        {
          type: "garden-loop:planted",
          tags: [p.resilience >= 3 ? "resilient" : "tender"],
          values: { growth: p.growth, water: p.water },
        },
      ],
    };
  },
  createReport(state, context) {
    const chosen = state.planted.map((i) => state.plants[i]!);
    const growth = chosen.reduce((n, p) => n + p.growth, 0);
    const diversity =
      chosen.length === 2 && chosen[0]!.water !== chosen[1]!.water ? 4 : 0;
    return {
      encounterId: context.encounterId,
      score: growth + diversity,
      signals: [],
      tags: ["harvest", ...(diversity ? ["diverse"] : [])],
      metrics: { plants: chosen.length, diversity },
    };
  },
  getProgress(state) {
    const report = this.createReport(state, {
      encounterId: "",
      encounterNumber: 0,
    });
    return {
      completedActions: state.planted.length,
      totalActions: 2,
      score: report.score,
      status: state.planted.length === 2 ? "complete" : "planting",
      metrics: report.metrics,
    };
  },
  isComplete: (s) => s.planted.length === 2,
  validateState(v) {
    if (!v || typeof v !== "object") throw new Error("Invalid garden state");
    return v as GardenState;
  },
};
