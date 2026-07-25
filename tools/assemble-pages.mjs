/* global process */
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function assemblePages({
  thresholdSource = "apps/threshold-lab/dist",
  gardenSource = "apps/garden-loop/dist",
  output = "pages-dist",
} = {}) {
  const outputDirectory = resolve(output);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(resolve(thresholdSource), outputDirectory, { recursive: true });
  await cp(resolve(gardenSource), resolve(outputDirectory, "garden"), {
    recursive: true,
  });
}

const isCommand =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCommand) {
  const [thresholdSource, gardenSource, output] = process.argv.slice(2);
  await assemblePages({ thresholdSource, gardenSource, output });
}
