/* global console, process */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
const slug = process.argv[2];
if (!slug || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("Usage: npm run create-game -- <lowercase-app-slug>");
  process.exit(1);
}
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(repositoryRoot, "apps/new-game-template"),
  target = resolve("apps", slug);
if (existsSync(target)) {
  console.error(`Refusing to overwrite ${target}`);
  process.exit(1);
}
cpSync(source, target, {
  recursive: true,
  filter: (path) => !/(?:^|\/)(dist|node_modules)(?:\/|$)/.test(path),
});
const title = slug
  .split("-")
  .map((x) => x[0].toUpperCase() + x.slice(1))
  .join(" ");
for (const file of ["package.json", "vite.config.ts", "index.html"]) {
  const path = resolve(target, file);
  const text = readFileSync(path, "utf8")
    .replaceAll("new-game-template", slug)
    .replaceAll("New Game Template", title)
    .replaceAll("/coreloop/template/", `/${slug}/`);
  writeFileSync(path, text);
}
const contentPath = resolve(target, "src/content.ts");
writeFileSync(
  contentPath,
  readFileSync(contentPath, "utf8").replace(
    'applicationTitle: "Four Choice"',
    `applicationTitle: ${JSON.stringify(title)}`,
  ),
);
console.log(
  `Created apps/${slug}.\n` +
    `TODO: rename the starter:* module, content, policy, terminology and custom-handler IDs.\n` +
    `Install: npm install\n` +
    `Develop: npm run dev --workspace @core-loop/${slug}\n` +
    `Typecheck: npm run typecheck\n` +
    `Test: npm test --workspace @core-loop/${slug}\n` +
    `Build: npm run build --workspace @core-loop/${slug}`,
);
