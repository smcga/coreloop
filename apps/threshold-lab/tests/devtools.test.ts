import { describe, expect, it } from "vitest";
import { createInitialRunState, handle } from "@core-loop/core";
import { thresholdLabContentPack } from "@core-loop/content";
import {
  contentBrowserRows,
  definitionDetail,
  developmentToolsEnabled,
  inspectorViewModel,
} from "../src/devtools";

describe("development inspection view models", () => {
  it("lists every definition and filters without presentation dependencies", () => {
    expect(contentBrowserRows()).toHaveLength(
      thresholdLabContentPack.definitions.length,
    );
    expect(
      contentBrowserRows({ category: "shop-pool" }).every(
        (row) => row.category === "shop-pool",
      ),
    ).toBe(true);
    expect(
      contentBrowserRows({ text: "steady" }).some((row) =>
        row.name.includes("Steady"),
      ),
    ).toBe(true);
    expect(
      contentBrowserRows({ tag: "shop" }).every((row) =>
        row.tags.includes("shop"),
      ),
    ).toBe(true);
    expect(
      contentBrowserRows({ moduleId: "threshold-lab:timing-meter" }).length,
    ).toBeGreaterThan(0);
    expect(
      contentBrowserRows({ rarity: "threshold-lab:rare" }).every((row) =>
        row.rarity.endsWith(":rare"),
      ),
    ).toBe(true);
  });
  it("resolves structured definition references", () => {
    const row = contentBrowserRows().find(
      (item) => item.category === "passive-modifier",
    )!;
    const detail = definitionDetail(row.id);
    expect(detail.definition.id).toBe(row.id);
    expect(detail.formattedJson).toContain(row.id);
    expect(detail.validationWarnings).toEqual([]);
  });
  it("formats live deterministic state and gates production", () => {
    const run = handle(createInitialRunState(), {
      type: "start-run",
      seed: 42,
    }).state;
    const view = inspectorViewModel(run);
    expect(view.identity).toMatchObject({
      seed: 42,
      phase: "encounter-ready",
      saveFormat: 4,
    });
    expect(view.canonicalState).not.toContain("savedAt");
    expect(developmentToolsEnabled(true, "?dev=1")).toBe(true);
    expect(developmentToolsEnabled(false, "?dev=1")).toBe(false);
  });
});
