import { createRandom } from "@core-loop/core";
import { describe, expect, it } from "vitest";
import { choiceModule } from "../src/gameplay";
describe("starter module", () => {
  it("is deterministic and reports a completed encounter", () => {
    const context = {
      encounterId: "1",
      encounterNumber: 1,
      target: 1,
      specialRuleId: null,
      rng: createRandom(42),
    };
    const a = choiceModule.createEncounter(context),
      b = choiceModule.createEncounter(context);
    expect(a).toEqual(b);
    let state = a.state;
    for (const index of [0, 1, 2])
      state = choiceModule.handleAction(
        state,
        { type: "choose", index },
        { encounterId: "1", encounterNumber: 1 },
      ).state;
    expect(
      choiceModule.createReport(state, { encounterId: "1", encounterNumber: 1 })
        .metrics.choices,
    ).toBe(3);
  });
});
