import { createRandom } from "@core-loop/core";
import { describe, expect, it } from "vitest";
import { gardenModule } from "../src/gameplay";
describe("garden module", () => {
  it("creates a deterministic, distinct harvest report", () => {
    const context = {
      encounterId: "1",
      encounterNumber: 1,
      target: 1,
      specialRuleId: null,
      rng: createRandom(9),
    };
    const a = gardenModule.createEncounter(context);
    expect(a).toEqual(gardenModule.createEncounter(context));
    let s = a.state;
    s = gardenModule.handleAction(
      s,
      { type: "plant", index: 0 },
      { encounterId: "1", encounterNumber: 1 },
    ).state;
    s = gardenModule.handleAction(
      s,
      { type: "plant", index: 1 },
      { encounterId: "1", encounterNumber: 1 },
    ).state;
    expect(
      gardenModule.createReport(s, { encounterId: "1", encounterNumber: 1 })
        .tags,
    ).toContain("harvest");
  });
});
