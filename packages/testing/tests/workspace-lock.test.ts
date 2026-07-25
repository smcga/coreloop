import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface LockFile {
  readonly packages: Readonly<Record<string, unknown>>;
}

const workspaceDirectories = ["apps", "packages"].flatMap((parent) =>
  readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      try {
        readFileSync(join(parent, entry.name, "package.json"));
        return true;
      } catch {
        return false;
      }
    })
    .map((entry) => `${parent}/${entry.name}`),
);

describe("workspace lockfile", () => {
  it("contains every workspace package used by clean CI installs", () => {
    const lock = JSON.parse(
      readFileSync("package-lock.json", "utf8"),
    ) as LockFile;

    expect(Object.keys(lock.packages)).toEqual(
      expect.arrayContaining(workspaceDirectories),
    );
  });
});
