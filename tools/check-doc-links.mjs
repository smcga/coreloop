/* global console, process */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "*.md"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const missing = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(
    /\[[^\]]*\]\((?!https?:|#|mailto:)([^)#]+)(?:#[^)]+)?\)/g,
  )) {
    const target = decodeURIComponent(match[1]);
    if (!existsSync(resolve(dirname(file), target)))
      missing.push(`${file}: ${target}`);
  }
}
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`Validated links in ${files.length} Markdown files.`);
