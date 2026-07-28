import {
  thresholdLabContentPack,
  thresholdLabRunConfiguration,
} from "@core-loop/content";
import {
  cheapestAffordableEconomyStrategy,
  SimulationRegistry,
  bindModuleDefaultStrategy,
  type EconomyStrategy,
  type SimulationComposition,
} from "@core-loop/simulation";
import {
  gameplayModules,
  COMBINATION_GRID_ID,
  TIMING_METER_ID,
} from "../apps/threshold-lab/src/gameplay/modules";
import { starterContentPack } from "../apps/new-game-template/src/content";
import {
  starterModules,
  starterRunConfiguration,
} from "../apps/new-game-template/src/composition";
import { choiceModule } from "../apps/new-game-template/src/gameplay";
import { gardenContentPack } from "../apps/garden-loop/src/content";
import {
  gardenModules,
  gardenRunConfiguration,
} from "../apps/garden-loop/src/configuration";
import { gardenModule } from "../apps/garden-loop/src/gameplay";

const leaveShopEconomy: EconomyStrategy = {
  id: "core:leave-shop",
  nextCommand: ({ state }) =>
    state.phase === "reward" ? { type: "enter-shop" } : { type: "leave-shop" },
};

const composition = (
  base: Omit<SimulationComposition, "strategies" | "economyStrategies">,
): SimulationComposition => {
  const shell = {
    ...base,
    strategies: [],
    economyStrategies: [cheapestAffordableEconomyStrategy, leaveShopEconomy],
  } satisfies SimulationComposition;
  return {
    ...shell,
    strategies:
      base.id === "threshold-lab:main"
        ? [
            {
              id: "threshold-lab:balanced",
              compatibleModuleIds: shell.modules
                .list()
                .map((module) => module.id),
              nextAction: ({
                state,
                moduleId,
              }: {
                state: unknown;
                moduleId: string;
              }) =>
                shell.modules.get(moduleId).createBotStrategy!().nextAction(
                  state as Readonly<unknown>,
                ),
            },
          ]
        : shell.modules
            .list()
            .map((module) => bindModuleDefaultStrategy(shell, module.id)),
  };
};

export const simulationRegistry = new SimulationRegistry()
  .register(
    composition({
      id: "threshold-lab:main",
      version: 1,
      provider: { id: "threshold-lab:runtime", version: 1 },
      content: {
        id: thresholdLabContentPack.id,
        version: thresholdLabContentPack.version,
      },
      configuration: thresholdLabRunConfiguration,
      modules: gameplayModules,
      policySets: [{ id: "core:default", version: 1 }],
      defaults: {
        gameplayModuleId: COMBINATION_GRID_ID,
        policySetId: "core:default",
        strategyId: "threshold-lab:balanced",
        economyStrategyId: "core:cheapest-affordable",
        loadoutId: "threshold-lab:starter-balanced",
      },
    }),
  )
  .register(
    composition({
      id: "starter:main",
      version: 1,
      provider: { id: "starter:runtime", version: 1 },
      content: {
        id: starterContentPack.id,
        version: starterContentPack.version,
      },
      configuration: starterRunConfiguration,
      modules: starterModules,
      policySets: [{ id: "starter:default", version: 1 }],
      defaults: {
        gameplayModuleId: choiceModule.id,
        policySetId: "starter:default",
        strategyId: `${choiceModule.id}:default-bot`,
        economyStrategyId: "core:leave-shop",
        loadoutId: "starter:balanced",
      },
    }),
  )
  .register(
    composition({
      id: "garden-loop:main",
      version: 1,
      provider: { id: "garden-loop:runtime", version: 1 },
      content: { id: gardenContentPack.id, version: gardenContentPack.version },
      configuration: gardenRunConfiguration,
      modules: gardenModules,
      policySets: [{ id: "garden-loop:default", version: 1 }],
      defaults: {
        gameplayModuleId: gardenModule.id,
        policySetId: "garden-loop:default",
        strategyId: `${gardenModule.id}:default-bot`,
        economyStrategyId: "core:leave-shop",
        loadoutId: "garden-loop:balanced-bed",
      },
    }),
  );

export const defaultCompositionId = "threshold-lab:main";
export { COMBINATION_GRID_ID, TIMING_METER_ID };
