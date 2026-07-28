import { writeFile } from "node:fs/promises";
import {
  formatHumanReport,
  runSimulation,
  serialiseReport,
  type SimulationRequest,
} from "@core-loop/simulation";
import {
  defaultCompositionId,
  simulationRegistry,
} from "./simulation-compositions";

const usage = `Usage: npm run simulate -- [options]
  --list             list registered games and compatible choices
  --game ID          composition identity (default: ${defaultCompositionId})
  --content ID       content pack identity
  --module ID        gameplay module identity
  --loadout ID       starting loadout identity
  --policy ID        policy set identity
  --strategy ID      encounter strategy identity
  --economy ID       economy/reward strategy identity
  --runs N           number of independent runs (default: 100)
  --seed-start N     first seed (default: 1)
  --seed-end N       inclusive final seed
  --max-commands N   safety limit per run (default: 300)
  --format human|json
  --output PATH      write report instead of stdout
  --max-outliers N   bounded retained examples
  --verbose          progress on stderr
`;
const args = process.argv.slice(2);
const values: Record<string, string> = {};
let verbose = false,
  list = false;
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
  if (argument === "--list") {
    list = true;
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
if (list) {
  for (const game of simulationRegistry.list()) {
    process.stdout.write(
      `${game.id}\n  content: ${game.content.id}\n  modules: ${game.modules
        .list()
        .map((x) => x.id)
        .sort()
        .join(", ")}\n  policies: ${game.policySets
        .map((x) => x.id)
        .sort()
        .join(", ")}\n  strategies: ${game.strategies
        .map((x) => x.id)
        .sort()
        .join(", ")}\n  economy: ${game.economyStrategies
        .map((x) => x.id)
        .sort()
        .join(", ")}\n`,
    );
  }
  process.exit(0);
}
const number = (key: string, fallback: number) =>
  values[key] === undefined ? fallback : Number(values[key]);
const seedStart = number("seed-start", 1);
const runCount =
  values["seed-end"] === undefined
    ? number("runs", 100)
    : Number(values["seed-end"]) - seedStart + 1;
const compositionId = values.game ?? defaultCompositionId;
const request: Partial<SimulationRequest> & { compositionId: string } = {
  compositionId,
  runCount,
  seedStart,
  maxOutliers: number("max-outliers", 5),
  maxCommands: number("max-commands", 300),
  ...(values.content ? { contentPackId: values.content } : {}),
  ...(values.module ? { gameplayModuleId: values.module } : {}),
  ...(values.loadout ? { loadoutId: values.loadout } : {}),
  ...(values.policy ? { policySetId: values.policy } : {}),
  ...(values.strategy ? { strategyId: values.strategy } : {}),
  ...(values.economy ? { economyStrategyId: values.economy } : {}),
};
try {
  if (verbose)
    process.stderr.write(
      `Simulating ${runCount} runs for ${compositionId}...\n`,
    );
  if (values.format && !["human", "json"].includes(values.format))
    throw new Error("Format must be 'human' or 'json'");
  const report = runSimulation(simulationRegistry, request);
  const output =
    values.format === "json"
      ? serialiseReport(report)
      : formatHumanReport(report);
  if (values.output) await writeFile(values.output, output, "utf8");
  else process.stdout.write(output);
} catch (error) {
  process.stderr.write(
    `Simulation failed: ${(error as Error).message}\n\n${usage}`,
  );
  process.exitCode = 1;
}
