import { runSimulation } from "@core-loop/simulation";
import { describe, expect, it } from "vitest";
import { diceSimulationRegistry } from "../src/simulation.js";
import { diceModule } from "../src/gameplay.js";

describe("clean SDK consumer", () => {
  it("reproduces module state and seeds for a fixed encounter seed", () => {
    const context = {
      encounterId: "challenge-1",
      encounterNumber: 1,
      target: 13,
      rules: [],
      seed: 71001,
      allowances: {},
      projection: {},
      encounterTags: [],
      runTags: [],
    };
    expect(diceModule.createEncounter(context)).toEqual(
      diceModule.createEncounter(context),
    );
  });

  it("runs the public composition through the application-neutral simulator", () => {
    const report = runSimulation(diceSimulationRegistry, {
      compositionId: "dice:consumer",
      runCount: 1,
      seedStart: 71,
    });
    expect(report.outcomes.total).toBe(1);
    expect(report.encounters.map((entry) => entry.kind)).toContain("special");
    expect(report.composition.id).toBe("dice:consumer");
  });
});
