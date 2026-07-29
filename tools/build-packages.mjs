/* global process */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["core", "content", "simulation"]) {
  const result = spawnSync(
    process.execPath,
    ["tools/build-one-package.mjs", name],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
