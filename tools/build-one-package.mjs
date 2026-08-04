/* global process */
import { access, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];
if (!new Set(["core", "content", "simulation"]).has(name)) {
  throw new Error(`Unknown public package '${name ?? ""}'`);
}
const directory = path.join(root, "packages", name);

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const ensureBuilt = async (dependency) => {
  try {
    await access(path.join(root, "packages", dependency, "dist", "index.d.ts"));
  } catch {
    run(process.execPath, ["tools/build-one-package.mjs", dependency]);
  }
};
if (name === "content" || name === "simulation") await ensureBuilt("core");
if (name === "simulation") await ensureBuilt("content");

await rm(path.join(directory, "dist"), { recursive: true, force: true });

run(path.join(root, "node_modules", ".bin", "esbuild"), [
  path.join(directory, "src", "index.ts"),
  "--bundle",
  "--format=esm",
  "--platform=node",
  "--packages=external",
  "--sourcemap",
  `--outfile=${path.join(directory, "dist", "index.js")}`,
]);
run(process.execPath, [
  path.join(root, "node_modules", "typescript", "bin", "tsc"),
  "-p",
  path.join(directory, "tsconfig.build.json"),
]);

// TypeScript's Bundler resolution permits extensionless source imports, while
// NodeNext consumers correctly require the emitted ESM declaration graph to
// use explicit extensions.
const declarations = async (folder) => {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) await declarations(target);
    else if (entry.name.endsWith(".d.ts")) {
      const source = await readFile(target, "utf8");
      await writeFile(
        target,
        source.replace(
          /(["'])(\.{1,2}\/[^"']+)(["'])/g,
          (all, open, specifier, close) =>
            /\.(?:js|json|d\.ts)$/.test(specifier)
              ? all
              : `${open}${specifier}.js${close}`,
        ),
      );
    }
  }
};
await declarations(path.join(directory, "dist"));
