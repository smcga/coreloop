/* global console, process */
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "core-loop-consumer-"));
const artefacts = path.join(temporary, "artefacts");
const consumer = path.join(temporary, "consumer");
await mkdir(artefacts);

const run = (command, args, cwd = root, capture = false) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? result.stdout ?? "");
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout ?? "";
};

try {
  run(process.execPath, ["tools/build-packages.mjs"]);
  const tarballs = [];
  for (const name of ["core", "content", "simulation"]) {
    const output = run(
      "npm",
      ["pack", `./packages/${name}`, "--json", "--pack-destination", artefacts],
      root,
      true,
    );
    const metadata = JSON.parse(output)[0];
    const shipped = metadata.files.map((entry) => entry.path);
    if (
      shipped.some(
        (file) =>
          !file.startsWith("dist/") &&
          file !== "package.json" &&
          file !== "README.md",
      )
    ) {
      throw new Error(
        `Package ${name} ships unexpected files: ${shipped.join(", ")}`,
      );
    }
    if (
      !shipped.includes("dist/index.js") ||
      !shipped.includes("dist/index.d.ts")
    )
      throw new Error(
        `Package ${name} is missing its runtime or declaration entry`,
      );
    tarballs.push(path.join(artefacts, metadata.filename));
  }

  await cp(path.join(root, "examples", "consumer-game"), consumer, {
    recursive: true,
  });
  const manifestPath = path.join(consumer, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.dependencies = Object.fromEntries(
    ["core", "content", "simulation"].map((name, index) => [
      `@core-loop/${name}`,
      `file:${tarballs[index]}`,
    ]),
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run("npm", ["install", "--ignore-scripts"], consumer);
  run("npm", ["run", "typecheck"], consumer);
  run("npm", ["test"], consumer);
  run("npm", ["run", "build"], consumer);
  console.log(`Clean consumer validation passed in ${consumer}`);
} finally {
  if (process.env.KEEP_CONSUMER_FIXTURE !== "1")
    await rm(temporary, { recursive: true, force: true });
}
