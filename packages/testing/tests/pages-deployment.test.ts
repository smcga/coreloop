import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("Pages artifact assembly", () => {
  it("puts Threshold Lab at the root and Garden Loop below garden", async () => {
    const directory = await mkdtemp(join(tmpdir(), "core-loop-pages-"));
    const thresholdSource = join(directory, "threshold");
    const gardenSource = join(directory, "garden-source");
    const output = join(directory, "pages");

    await Promise.all([
      mkdir(thresholdSource, { recursive: true }),
      mkdir(gardenSource, { recursive: true }),
      mkdir(output, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(thresholdSource, "index.html"), "threshold"),
      writeFile(join(gardenSource, "index.html"), "garden"),
      writeFile(join(output, "stale.html"), "stale"),
    ]);

    await execFileAsync(process.execPath, [
      "tools/assemble-pages.mjs",
      thresholdSource,
      gardenSource,
      output,
    ]);

    await expect(readFile(join(output, "index.html"), "utf8")).resolves.toBe(
      "threshold",
    );
    await expect(
      readFile(join(output, "garden", "index.html"), "utf8"),
    ).resolves.toBe("garden");
    await expect(
      readFile(join(output, "stale.html"), "utf8"),
    ).rejects.toThrow();
  });
});
