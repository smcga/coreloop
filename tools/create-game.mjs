/* global console, process */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const slug = process.argv[2];
if (!slug || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("Usage: npm run create-game -- <lowercase-app-slug>");
  process.exit(1);
}
const source = resolve("apps/new-game-template"),
  target = resolve("apps", slug);
if (existsSync(target)) {
  console.error(`Refusing to overwrite ${target}`);
  process.exit(1);
}
cpSync(source, target, {
  recursive: true,
  filter: (path) => !/(?:^|\/)(dist|node_modules)(?:\/|$)/.test(path),
});
for (const file of ["package.json", "vite.config.ts", "index.html"]) {
  const path = resolve(target, file);
  const text = readFileSync(path, "utf8")
    .replaceAll("new-game-template", slug)
    .replaceAll(
      "New Game Template",
      slug
        .split("-")
        .map((x) => x[0].toUpperCase() + x.slice(1))
        .join(" "),
    )
    .replaceAll("/coreloop/template/", `/${slug}/`);
  writeFileSync(path, text);
}
console.log(
  `Created apps/${slug}. Rename starter IDs, then run npm install and npm run dev --workspace @core-loop/${slug}.`,
);
