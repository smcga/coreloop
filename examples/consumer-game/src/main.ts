import { runSimulation } from "@core-loop/simulation";
import { diceSimulationRegistry } from "./simulation.js";

const report = runSimulation(diceSimulationRegistry, {
  compositionId: "dice:consumer",
  runCount: 1,
  seedStart: 71,
});
document.querySelector("#app")!.textContent =
  `Dice Allocation: ${report.outcomes.completed} completed run`;
