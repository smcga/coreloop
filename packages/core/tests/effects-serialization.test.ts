import { describe, expect, it } from "vitest";
import { canonicalJson, createRandom, resolveEffects } from "../src";

describe("effect event serialisation", () => {
  it("omits absent optional signal sources so replay hashing remains canonical", () => {
    const result = resolveEffects(
      {
        score: 0,
        target: 1,
        currency: 0,
        priceModifier: 0,
        rng: createRandom(1),
        instances: [],
        encounterTags: [],
        allowances: {},
        nextInstanceId: 1,
      },
      {
        id: "score-1",
        sequence: 1,
        type: "score",
        tags: [],
        values: {},
        context: { encounterId: "one", encounterNumber: 1, special: false },
      },
      [],
    );
    expect(() => canonicalJson(result.events)).not.toThrow();
    expect(result.events[0]).not.toHaveProperty("source");
    expect(canonicalJson({ optional: undefined, value: 1 })).toBe(
      '{"value":1}',
    );
  });
});
