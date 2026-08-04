import { defineConfig } from "vitest/config";
import { workspaceSourceAliases } from "./tools/vite-source-aliases";

export default defineConfig({
  resolve: { alias: workspaceSourceAliases },
  test: { include: ["{apps,packages}/**/*.test.ts"] },
});
