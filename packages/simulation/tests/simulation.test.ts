import { describe, expect, it } from "vitest";
import {
  COMBINATION_GRID_ID,
  TIMING_METER_ID,
} from "../../../apps/threshold-lab/src/gameplay/modules";
import {
  formatHumanReport,
  runSimulation,
  serialiseReport,
  validateSimulationReport,
} from "../src";

describe("headless simulation", () => {
  const request = { runCount: 8, seedStart: 20, maxOutliers: 2 } as const;
  it("produces deterministic bounded aggregate reports", () => {
    const first = runSimulation(request);
    expect(serialiseReport(runSimulation(request))).toBe(
      serialiseReport(first),
    );
    expect(first.outliers).toHaveLength(2);
    expect(first.diagnostics).toEqual([]);
    expect(first.encounters[0]).toMatchObject({ encounter: 1, attempts: 8 });
    expect(
      first.contentMetrics.some(
        (item) => item.offered > 0 && item.purchased > 0,
      ),
    ).toBe(true);
  });
  it("changes aggregate output for another seed range", () => {
    expect(serialiseReport(runSimulation(request))).not.toBe(
      serialiseReport(runSimulation({ ...request, seedStart: 200 })),
    );
  });
  it("simulates both modules through real shops", () => {
    for (const gameplayModuleId of [COMBINATION_GRID_ID, TIMING_METER_ID]) {
      const report = runSimulation({ ...request, gameplayModuleId });
      expect(report.outcomes.completed + report.outcomes.failed).toBe(8);
      expect(report.economy.purchases).toBeGreaterThan(0);
      expect(report.encounters.some((row) => row.specialFrequency > 0)).toBe(
        true,
      );
    }
  });
  it("fails clearly for incompatible identities", () => {
    expect(() => runSimulation({ gameplayModuleId: "missing:module" })).toThrow(
      "Unknown gameplay module",
    );
    expect(() => runSimulation({ strategyId: "perfect" })).toThrow(
      "incompatible",
    );
    expect(() => runSimulation({ policySetId: "missing:policy" })).toThrow(
      "Unknown policy set",
    );
  });
  it("formats and validates stable report formats", () => {
    const report = runSimulation({ ...request, runCount: 2 });
    expect(formatHumanReport(report)).toContain("Reachability warnings");
    expect(
      validateSimulationReport(JSON.parse(serialiseReport(report))),
    ).toEqual(report);
    expect(() => validateSimulationReport({ reportFormatVersion: 99 })).toThrow(
      "Unsupported",
    );
  });
  it("CI smoke: fixed ranges for both modules have no diagnostics", () => {
    for (const gameplayModuleId of [COMBINATION_GRID_ID, TIMING_METER_ID])
      expect(
        runSimulation({ runCount: 20, seedStart: 1, gameplayModuleId })
          .diagnostics,
      ).toEqual([]);
  });
});
