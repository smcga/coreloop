import { describe, expect, it } from "vitest";
import { advanceTimingMarker } from "../src/game/timingPresentation";

describe("Timing Meter presentation", () => {
  it("advances repeated frames without requiring the scene to be rebuilt", () => {
    let motion = { position: 0, direction: 1 };

    for (let frame = 0; frame < 4; frame++) {
      motion = advanceTimingMarker(motion.position, motion.direction, 8, 1);
    }

    expect(motion).toEqual({ position: 32, direction: 1 });
  });

  it("reflects the marker at either end of the meter", () => {
    expect(advanceTimingMarker(992, 1, 8, 2)).toEqual({
      position: 992,
      direction: -1,
    });
    expect(advanceTimingMarker(8, -1, 8, 2)).toEqual({
      position: 8,
      direction: 1,
    });
  });
});
