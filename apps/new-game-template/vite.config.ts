import { defineConfig } from "vite";
import { workspaceSourceAliases } from "../../tools/vite-source-aliases";
export default defineConfig({
  base: "/coreloop/template/",
  resolve: { alias: workspaceSourceAliases },
  build: { sourcemap: false },
});
