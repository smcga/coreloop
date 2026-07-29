import {
  bindModuleDefaultStrategy,
  cheapestAffordableEconomyStrategy,
  SimulationRegistry,
  type EconomyStrategy,
  type SimulationComposition,
} from "@core-loop/simulation";
import { diceContentPack } from "./content.js";
import { diceModule } from "./gameplay.js";
import { diceModules, diceRunConfiguration } from "./composition.js";

const leaveShop: EconomyStrategy = {
  id: "dice:leave-shop",
  nextCommand: ({ state }) =>
    state.phase === "reward" ? { type: "enter-shop" } : { type: "leave-shop" },
};

const shell = {
  id: "dice:consumer",
  version: 1,
  provider: { id: "dice:runtime", version: 1 },
  content: { id: diceContentPack.id, version: diceContentPack.version },
  configuration: diceRunConfiguration,
  modules: diceModules,
  policySets: [{ id: "dice:default", version: 1 }],
  strategies: [],
  economyStrategies: [cheapestAffordableEconomyStrategy, leaveShop],
  defaults: {
    gameplayModuleId: diceModule.id,
    policySetId: "dice:default",
    strategyId: `${diceModule.id}:default-bot`,
    economyStrategyId: "dice:leave-shop",
    loadoutId: "dice:balanced",
  },
} satisfies SimulationComposition;

export const diceSimulationRegistry = new SimulationRegistry().register({
  ...shell,
  strategies: [bindModuleDefaultStrategy(shell, diceModule.id)],
});
