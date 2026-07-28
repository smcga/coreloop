import { readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

const sourceFiles = (directory: string): readonly string[] => {
  const absoluteDirectory = resolve(repositoryRoot, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(
    (entry) => {
      const path = resolve(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(relative(repositoryRoot, path));
      }
      return extname(path) === ".ts" ? [path] : [];
    },
  );
};

const moduleSpecifiers = (file: string): readonly string[] => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  );
};

describe("package architecture boundaries", () => {
  it("keeps the headless core independent of presentation and applications", () => {
    const forbidden = [
      "phaser",
      "@core-loop/phaser",
      "@core-loop/content",
      "@core-loop/simulation",
    ];

    for (const file of sourceFiles("packages/core/src")) {
      const imports = moduleSpecifiers(file);
      expect(imports, relative(repositoryRoot, file)).not.toEqual(
        expect.arrayContaining(forbidden),
      );
      expect(
        imports.some(
          (specifier) =>
            specifier.startsWith("../../../apps/") ||
            specifier.startsWith("../../apps/"),
        ),
        relative(repositoryRoot, file),
      ).toBe(false);
    }
  });

  it("keeps the reusable simulation package independent of application sources", () => {
    for (const file of sourceFiles("packages/simulation/src")) {
      expect(
        moduleSpecifiers(file).some(
          (specifier) => specifier.includes("/apps/") || specifier === "apps",
        ),
        relative(repositoryRoot, file),
      ).toBe(false);
    }
  });
});
