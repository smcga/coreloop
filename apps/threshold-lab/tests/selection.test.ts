import { describe, expect, it } from "vitest";
import {
  initialSelection,
  resetSelection,
  selectionSum,
  submitSelection,
  toggleTile,
} from "../src/game/selection";

describe("tile selection", () => {
  it("selects, deselects, and totals tiles deterministically", () => {
    let state = toggleTile(initialSelection(), 4);
    state = toggleTile(state, 9);
    expect(selectionSum(state)).toBe(13);
    expect(toggleTile(state, 4).selected).toEqual(new Set([9]));
    expect(submitSelection(state).result).toBe(13);
  });

  it("caps selection at five and reset clears all feedback", () => {
    let state = initialSelection();
    for (const value of [1, 2, 3, 4, 5]) state = toggleTile(state, value);
    const capped = toggleTile(state, 6);
    expect(capped).toBe(state);
    expect(capped.selected.size).toBe(5);
    expect(resetSelection()).toEqual({ selected: new Set(), result: null });
  });
});
