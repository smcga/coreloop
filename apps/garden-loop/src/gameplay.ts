import {
  createRandom,
  randomInteger,
  type GameplayModule,
} from "@core-loop/core";
export interface GardenState {
  readonly plants: readonly {
    instanceId: string;
    definitionId: string;
    growth: number;
    water: number;
    resilience: number;
  }[];
  readonly planted: readonly number[];
  readonly waterAllowance: number;
  readonly minimumResilience: number;
}
export type GardenAction = { readonly type: "plant"; readonly index: number };
export const gardenModule: GameplayModule<GardenState, GardenAction> = {
  id: "garden-loop:planting",
  version: 1,
  capabilities: ["garden-loop:plants", "allowance:action"],
  allowanceDefaults: { action: 8 },
  createEncounter(context) {
    let rng = createRandom(context.seed);
    const projected = validateGardenProjection(context.projection);
    const plants = projected.plants.map((plant) => {
      // Variation belongs to the module RNG; it augments rather than replaces
      // the stable, run-owned pool.
      const g = randomInteger(rng, -1, 1);
      rng = g.state;
      const w = randomInteger(rng, -1, 1);
      rng = w.state;
      const r = randomInteger(rng, -1, 1);
      rng = r.state;
      return {
        ...plant,
        growth: Math.max(0, plant.growth + g.value),
        water: Math.max(0, plant.water + w.value),
        resilience: Math.max(0, plant.resilience + r.value),
      };
    });
    let minimumResilience = 0;
    for (const rule of context.rules) {
      const payload = rule.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        continue;
      if (
        "minimumResilience" in payload &&
        typeof payload.minimumResilience === "number"
      )
        minimumResilience = payload.minimumResilience;
    }
    return {
      state: {
        plants,
        planted: [],
        waterAllowance: context.allowances.action ?? 0,
        minimumResilience,
      },
    };
  },
  handleAction(state, action) {
    if (
      action.type !== "plant" ||
      !state.plants[action.index] ||
      state.planted.includes(action.index) ||
      state.planted.length >= Math.min(2, state.plants.length)
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
    const waterUsed = chosen.reduce((sum, plant) => sum + plant.water, 0);
    const resilience = chosen.reduce((sum, plant) => sum + plant.resilience, 0);
    const weatherPenalty =
      waterUsed > state.waterAllowance || resilience < state.minimumResilience
        ? 4
        : 0;
    return {
      encounterId: context.encounterId,
      score: Math.max(0, growth + diversity - weatherPenalty),
      signals: [],
      tags: ["harvest", ...(diversity ? ["diverse"] : [])],
      metrics: {
        plants: chosen.length,
        diversity,
        waterUsed,
        resilience,
        weatherPenalty,
      },
    };
  },
  getProgress(state) {
    const report = this.createReport(state, {
      encounterId: "",
      encounterNumber: 0,
    });
    return {
      completedActions: state.planted.length,
      totalActions: Math.min(2, state.plants.length),
      score: report.score,
      status: state.planted.length === 2 ? "complete" : "planting",
      metrics: report.metrics,
    };
  },
  isComplete: (s) => s.planted.length === Math.min(2, s.plants.length),
  validateState(v) {
    if (
      !v ||
      typeof v !== "object" ||
      !("plants" in v) ||
      !Array.isArray(v.plants) ||
      !("planted" in v) ||
      !Array.isArray(v.planted) ||
      !("waterAllowance" in v) ||
      !Number.isFinite(v.waterAllowance) ||
      !("minimumResilience" in v) ||
      !Number.isFinite(v.minimumResilience)
    )
      throw new Error("Invalid garden state");
    return v as GardenState;
  },
  validateAction(v) {
    if (
      !v ||
      typeof v !== "object" ||
      !("type" in v) ||
      v.type !== "plant" ||
      !("index" in v) ||
      !Number.isInteger(v.index)
    )
      throw new Error("Invalid garden action");
    return v as GardenAction;
  },
  createBotStrategy: () => ({
    nextAction(state) {
      const candidates = state.plants
        .map((plant, index) => ({ plant, index }))
        .filter(({ index }) => !state.planted.includes(index))
        .sort(
          (a, b) =>
            b.plant.growth +
            b.plant.resilience -
            b.plant.water -
            (a.plant.growth + a.plant.resilience - a.plant.water),
        );
      return { type: "plant", index: candidates[0]!.index };
    },
  }),
};

interface GardenProjection {
  readonly plants: readonly GardenState["plants"][number][];
}

function validateGardenProjection(value: unknown): GardenProjection {
  if (
    !value ||
    typeof value !== "object" ||
    !("plants" in value) ||
    !Array.isArray(value.plants) ||
    value.plants.some(
      (plant) =>
        !plant ||
        typeof plant !== "object" ||
        !("instanceId" in plant) ||
        typeof plant.instanceId !== "string" ||
        !("definitionId" in plant) ||
        typeof plant.definitionId !== "string" ||
        !("growth" in plant) ||
        !Number.isFinite(plant.growth) ||
        !("water" in plant) ||
        !Number.isFinite(plant.water) ||
        !("resilience" in plant) ||
        !Number.isFinite(plant.resilience),
    )
  )
    throw new Error("Invalid Garden inventory projection");
  return value as GardenProjection;
}
