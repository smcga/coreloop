import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("create-game generator", () => {
  it("creates an internally named, source-only app and refuses overwrite", () => {
    const cwd = mkdtempSync(join(tmpdir(), "core-loop-generator-"));
    try {
      execFileSync(
        "node",
        [resolve("tools/create-game.mjs"), "pocket-orchard"],
        { cwd, env: process.env },
      );
      const app = join(cwd, "apps/pocket-orchard");
      expect(readFileSync(join(app, "package.json"), "utf8")).toContain(
        "@core-loop/pocket-orchard",
      );
      expect(readFileSync(join(app, "index.html"), "utf8")).toContain(
        "Pocket Orchard",
      );
      expect(readFileSync(join(app, "src/content.ts"), "utf8")).toContain(
        'applicationTitle: "Pocket Orchard"',
      );
      expect(readFileSync(join(app, "vite.config.ts"), "utf8")).toContain(
        "/pocket-orchard/",
      );
      expect(() =>
        execFileSync(
          "node",
          [resolve("tools/create-game.mjs"), "pocket-orchard"],
          { cwd },
        ),
      ).toThrow();
      const source = [
        "content.ts",
        "composition.ts",
        "gameplay.ts",
        "main.ts",
        "runtime.ts",
      ]
        .map((file) => readFileSync(join(app, "src", file), "utf8"))
        .join("\n");
      expect(source).not.toMatch(
        /apps\/(?:threshold-lab|garden-loop)|from ["'][^"']*(?:threshold-lab|garden-loop)/,
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
