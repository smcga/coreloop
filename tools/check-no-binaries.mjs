/* global console, process */
import { execFileSync } from "node:child_process";
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbidden =
  /\.(png|jpe?g|gif|webp|ico|mp[34]|wav|ogg|flac|woff2?|ttf|otf|zip|tar|gz|7z|wasm|pdf)$/i;
const binary = new Set(tracked.filter((file) => forbidden.test(file)));
const output = execFileSync(
  "git",
  ["diff", "--numstat", "--no-renames", "HEAD"],
  { encoding: "utf8" },
);
for (const line of output.split("\n")) {
  const [added, removed, file] = line.split("\t");
  if (added === "-" && removed === "-" && file) binary.add(file);
}
if (binary.size) {
  console.error(
    `Binary files are not allowed:\n${[...binary].sort().join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `Checked ${tracked.length} tracked files; no forbidden binary files found.`,
);
