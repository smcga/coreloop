import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatHumanReport,
  runSimulation,
  serialiseReport,
  validateSimulationReport,
} from "../src";
import {
  COMBINATION_GRID_ID,
  TIMING_METER_ID,
  simulationRegistry,
} from "../../../tools/simulation-compositions";

describe("application-agnostic simulation", () => {
  const request = {
    compositionId: "threshold-lab:main",
    runCount: 8,
    seedStart: 20,
    maxOutliers: 2,
  } as const;
  it("produces byte-equivalent deterministic reports with bounded examples", () => {
    const first = runSimulation(simulationRegistry, request);
    expect(serialiseReport(runSimulation(simulationRegistry, request))).toBe(
      serialiseReport(first),
    );
    expect(first.outliers).toHaveLength(2);
    expect(first.diagnostics).toEqual([]);
    expect(first.encounters[0]).toMatchObject({ position: 1, attempts: 8 });
  });
  it("runs every shipped composition and variable schedules through default bots (CI smoke)", () => {
    for (const composition of simulationRegistry.list()) {
      const report = runSimulation(simulationRegistry, {
        compositionId: composition.id,
        runCount: 4,
        seedStart: 3,
      });
      expect(report.diagnostics).toEqual([]);
      expect(report.encounters.length).toBe(
        composition.id === "threshold-lab:main"
          ? 6
          : composition.id === "starter:main"
            ? 4
            : 5,
      );
      expect(report.outcomes.completed + report.outcomes.failed).toBe(4);
    }
  });
  it("supports both Threshold Lab modules", () => {
    for (const gameplayModuleId of [COMBINATION_GRID_ID, TIMING_METER_ID])
      expect(
        runSimulation(simulationRegistry, { ...request, gameplayModuleId })
          .diagnostics,
      ).toEqual([]);
  });
  it("rejects identities and compatibility before consuming seeds", () => {
    expect(() =>
      runSimulation(simulationRegistry, { compositionId: "missing:game" }),
    ).toThrow("Available:");
    expect(() =>
      runSimulation(simulationRegistry, {
        ...request,
        gameplayModuleId: "missing:module",
      }),
    ).toThrow("Unknown gameplay module");
    expect(() =>
      runSimulation(simulationRegistry, {
        ...request,
        policySetId: "missing:policy",
      }),
    ).toThrow("Available:");
    expect(() =>
      runSimulation(simulationRegistry, {
        ...request,
        compositionId: "starter:main",
        strategyId: "starter:three-choice:default-bot",
        gameplayModuleId: COMBINATION_GRID_ID,
      }),
    ).toThrow("Unknown gameplay module");
  });
  it("surfaces safety limits as structured diagnostics", () => {
    expect(
      runSimulation(simulationRegistry, {
        ...request,
        runCount: 1,
        maxCommands: 1,
      }).diagnostics,
    ).toEqual([
      {
        seed: 20,
        code: "command-limit",
        message: "Command safety limit 1 reached",
      },
    ]);
  });
  it("validates versioned reports", () => {
    const report = runSimulation(simulationRegistry, {
      ...request,
      runCount: 2,
    });
    expect(formatHumanReport(report)).toContain("Reachability warnings");
    expect(
      validateSimulationReport(JSON.parse(serialiseReport(report))),
    ).toEqual(report);
    expect(() => validateSimulationReport({ reportFormatVersion: 1 })).toThrow(
      "Unsupported",
    );
  });
  it("prevents application imports in the framework package", () => {
    for (const file of [
      "src/runner.ts",
      "src/types.ts",
      "src/reports.ts",
      "src/index.ts",
    ])
      expect(
        readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      ).not.toMatch(
        /(?:\.\.\/)+apps\/|@core-loop\/(?:threshold-lab|garden-loop|new-game-template)/,
      );
  });
});
