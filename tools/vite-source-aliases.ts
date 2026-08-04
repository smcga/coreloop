import { fileURLToPath } from "node:url";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Repository-only aliases. Packaged consumers intentionally do not use these. */
export const workspaceSourceAliases = {
  "@core-loop/core": source("../packages/core/src/index.ts"),
  "@core-loop/content": source("../packages/content/src/index.ts"),
  "@core-loop/phaser": source("../packages/phaser/src/index.ts"),
  "@core-loop/simulation": source("../packages/simulation/src/index.ts"),
  "@core-loop/testing": source("../packages/testing/src/index.ts"),
};
