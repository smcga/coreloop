import { defineConfig } from "vite";
import { workspaceSourceAliases } from "../../tools/vite-source-aliases";
export default defineConfig({
  base: "/coreloop/garden/",
  resolve: { alias: workspaceSourceAliases },
  build: { sourcemap: false },
});
