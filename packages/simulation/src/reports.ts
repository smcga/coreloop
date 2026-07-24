import { canonicalJson } from "@core-loop/core";
import { SIMULATION_REPORT_VERSION, type SimulationReport } from "./types";

export const serialiseReport = (report: SimulationReport): string =>
  `${canonicalJson(report)}\n`;

export function validateSimulationReport(value: unknown): SimulationReport {
  if (!value || typeof value !== "object")
    throw new Error("Simulation report must be an object");
  const report = value as Partial<SimulationReport>;
  if (report.reportFormatVersion !== SIMULATION_REPORT_VERSION)
    throw new Error(
      `Unsupported simulation report version '${String(report.reportFormatVersion)}'; expected ${SIMULATION_REPORT_VERSION}`,
    );
  if (
    !report.content?.id ||
    !report.module?.id ||
    !report.request ||
    !report.outcomes
  )
    throw new Error(
      "Simulation report is missing identity or aggregate fields",
    );
  return value as SimulationReport;
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export function formatHumanReport(report: SimulationReport): string {
  const lines = [
    "Simulation summary",
    `  Content             ${report.content.id} v${report.content.version}`,
    `  Module              ${report.module.id} v${report.module.version}`,
    `  Seeds               ${report.request.seedStart}..${report.request.seedStart + report.request.runCount - 1}`,
    "",
    "Run outcomes",
    `  Completed           ${report.outcomes.completed}/${report.outcomes.total} (${percent(report.outcomes.completionRate)})`,
    `  Failed / aborted    ${report.outcomes.failed} / ${report.outcomes.aborted}`,
    `  Encounter reached   ${report.outcomes.averageEncounterReached.toFixed(2)}`,
    `  Commands per run    ${report.outcomes.averageCommands.toFixed(2)}`,
    "",
    "Encounter performance",
    "  #  attempts  win rate  avg score  avg target  ratio",
    ...report.encounters.map(
      (row) =>
        `  ${String(row.encounter).padStart(1)}  ${String(row.attempts).padStart(8)}  ${percent(row.winRate).padStart(8)}  ${row.averageScore.toFixed(1).padStart(9)}  ${row.averageTarget.toFixed(1).padStart(10)}  ${row.scoreToTargetRatio.toFixed(2).padStart(5)}`,
    ),
    "",
    "Economy",
    `  Earned / spent      ${report.economy.currencyEarned} / ${report.economy.currencySpent}`,
    `  Purchases/rerolls   ${report.economy.purchases} / ${report.economy.rerolls}`,
    `  Unused at run end   ${report.outcomes.unusedCurrencyAverage.toFixed(2)} average`,
    "",
    "Content offers and purchases",
    ...report.contentMetrics.map(
      (item) =>
        `  ${item.definitionId.padEnd(24)} offered ${String(item.offered).padStart(5)}  bought ${String(item.purchased).padStart(5)}  triggers ${String(item.triggered).padStart(5)}`,
    ),
    "",
    "Reachability warnings",
    ...(report.reachability.length
      ? report.reachability.map((item) => `  ${item.type}: ${item.id}`)
      : ["  none"]),
    "",
    "Potential outliers (descriptive, not causal)",
    ...report.outliers.map(
      (item) =>
        `  seed ${item.seed}: score ${item.score}, currency ${item.currency}`,
    ),
    "",
    "Diagnostics",
    ...(report.diagnostics.length
      ? report.diagnostics.map((item) => `  seed ${item.seed}: ${item.message}`)
      : ["  none"]),
  ];
  return `${lines.join("\n")}\n`;
}
