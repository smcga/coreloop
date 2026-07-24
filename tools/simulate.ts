import { writeFile } from "node:fs/promises";
import {
  formatHumanReport,
  runSimulation,
  serialiseReport,
  type SimulationRequest,
} from "@core-loop/simulation";

const usage = `Usage: npm run simulate -- [options]
  --content ID       content pack (threshold-lab)
  --module ID        gameplay module
  --loadout ID       starting loadout identity
  --policy ID        policy set (core:default)
  --strategy ID      deterministic strategy (balanced)
  --runs N           number of independent runs
  --seed-start N     first seed
  --seed-end N       inclusive final seed (requires a valid range)
  --format human|json
  --output PATH      write report instead of stdout
  --max-outliers N   bounded retained examples
  --verbose          progress on stderr
`;
const args = process.argv.slice(2);
const values: Record<string, string> = {};
let verbose = false;
for (let index = 0; index < args.length; index++) {
  const argument = args[index]!;
  if (argument === "--help") {
    process.stdout.write(usage);
    process.exit(0);
  }
  if (argument === "--verbose") {
    verbose = true;
    continue;
  }
  if (
    !argument.startsWith("--") ||
    !args[index + 1] ||
    args[index + 1]!.startsWith("--")
  )
    throw new Error(`Invalid argument '${argument}'.\n${usage}`);
  values[argument.slice(2)] = args[++index]!;
}
const number = (key: string, fallback: number) =>
  values[key] === undefined ? fallback : Number(values[key]);
const seedStart = number("seed-start", 1);
const runCount =
  values["seed-end"] === undefined
    ? number("runs", 100)
    : Number(values["seed-end"]) - seedStart + 1;
const request: Partial<SimulationRequest> = {
  runCount,
  seedStart,
  maxOutliers: number("max-outliers", 5),
  ...(values.content ? { contentPackId: values.content } : {}),
  ...(values.module ? { gameplayModuleId: values.module } : {}),
  ...(values.loadout ? { loadoutId: values.loadout } : {}),
  ...(values.policy ? { policySetId: values.policy } : {}),
  ...(values.strategy ? { strategyId: values.strategy } : {}),
};
try {
  if (verbose) process.stderr.write(`Simulating ${runCount} runs...\n`);
  const report = runSimulation(request);
  const output =
    values.format === "json"
      ? serialiseReport(report)
      : formatHumanReport(report);
  if (values.format && values.format !== "human" && values.format !== "json")
    throw new Error("Format must be 'human' or 'json'");
  if (values.output) await writeFile(values.output, output, "utf8");
  else process.stdout.write(output);
} catch (error) {
  process.stderr.write(
    `Simulation failed: ${(error as Error).message}\n\n${usage}`,
  );
  process.exitCode = 1;
}
