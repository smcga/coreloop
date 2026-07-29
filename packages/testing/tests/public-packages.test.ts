import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public SDK package manifests", () => {
  for (const name of ["core", "content", "simulation"]) {
    it(`${name} exports built ESM and declarations without source files`, () => {
      const manifest = JSON.parse(
        readFileSync(
          new URL(`../../${name}/package.json`, import.meta.url),
          "utf8",
        ),
      ) as {
        files?: string[];
        exports?: { "."?: { import?: string; types?: string } };
        engines?: { node?: string };
      };
      expect(manifest.files).toEqual(["dist"]);
      expect(manifest.exports?.["."]).toEqual({
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      });
      expect(manifest.engines?.node).toBe(">=22 <23");
    });
  }
});
