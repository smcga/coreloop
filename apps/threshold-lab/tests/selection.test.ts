import { describe, expect, it } from "vitest";
import type { EncounterBrief, PlayableTile } from "@core-loop/core";
import {
  calculateScore,
  createEncounterReport,
  initialSelection,
  toggleTile,
} from "../src/game/selection";

const tiles: readonly PlayableTile[] = [
  { id: "a", value: 2, tags: ["cyan"] },
  { id: "b", value: 2, tags: ["cyan"] },
  { id: "c", value: 3, tags: ["cyan"] },
  { id: "d", value: 4, tags: ["amber"] },
];

describe("Threshold Lab scoring", () => {
  it("adds base score and each visible pattern bonus", () => {
    expect(calculateScore(tiles)).toEqual({
      base: 11,
      pairBonus: 8,
      sequenceBonus: 12,
      matchingTagBonus: 10,
      total: 41,
    });
  });
  it("calculates each bonus only when its pattern is present", () => {
    expect(calculateScore(tiles.slice(0, 2)).pairBonus).toBe(8);
    expect(calculateScore(tiles.slice(1, 4)).sequenceBonus).toBe(12);
    expect(calculateScore(tiles.slice(0, 3)).matchingTagBonus).toBe(10);
  });
  it("creates the same report from the same encounter and selections", () => {
    const brief: EncounterBrief = {
      id: "encounter-1",
      number: 1,
      target: 30,
      selectionLimit: 5,
      tiles,
    };
    let selection = initialSelection();
    for (const tile of tiles) selection = toggleTile(selection, tile.id, 5);
    expect(createEncounterReport(brief, selection)).toEqual(
      createEncounterReport(brief, selection),
    );
    expect(createEncounterReport(brief, selection).score).toBe(41);
  });
});
