import { describe, expect, it } from "vitest";
import { EffectHandlerRegistry, PolicyRegistry } from "@core-loop/core";
import {
  reverseMeterDirectionEffect,
  steepTargetPolicy,
} from "../src/extensions/sample";

describe("application-owned extensions", () => {
  it("registers an alternate target policy outside core", () => {
    const policy = new PolicyRegistry([steepTargetPolicy]).get<
      typeof steepTargetPolicy
    >({ id: steepTargetPolicy.id, version: 1 });
    expect(
      policy.targetForEncounter({
        encounterNumber: 4,
        rng: { algorithm: "mulberry32", value: 9 },
      }),
    ).toBe(48);
  });
  it("registers a namespaced custom effect outside core", () => {
    const handlers = new EffectHandlerRegistry();
    handlers.register(
      "threshold-lab:reverse-meter-direction",
      reverseMeterDirectionEffect,
    );
    expect(handlers.references()).toEqual([
      { id: "threshold-lab:reverse-meter-direction", version: 1 },
    ]);
  });
});
