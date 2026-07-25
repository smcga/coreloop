import { describe, expect, it, vi } from "vitest";
import { createSeedLink, parseSeedLink } from "../src/seed-url";
import { registerProductionServiceWorker } from "../src/service-worker";

describe("web host helpers", () => {
  const modules = new Set(["example:choice"]);
  const loadouts = new Set(["example:balanced"]);
  it("round trips deterministic seed links independently of query order", () => {
    const link = createSeedLink("https://host/coreloop/?old=1", {
      seed: 123,
      moduleId: "example:choice",
      loadoutId: "example:balanced",
    });
    expect(parseSeedLink(link, modules, loadouts)).toEqual({
      ok: true,
      selection: {
        seed: 123,
        moduleId: "example:choice",
        loadoutId: "example:balanced",
        policyId: undefined,
      },
    });
    expect(
      parseSeedLink(
        "/coreloop/?module=example%3Achoice&seed=123",
        modules,
        loadouts,
      ),
    ).toEqual({
      ok: true,
      selection: {
        seed: 123,
        moduleId: "example:choice",
        loadoutId: undefined,
        policyId: undefined,
      },
    });
  });
  it.each(["-1", "1.2", "4294967296", "nope"])(
    "rejects invalid seed %s",
    (seed) =>
      expect(
        parseSeedLink(
          `/?seed=${seed}&module=example%3Achoice`,
          modules,
          loadouts,
        ),
      ).toMatchObject({ ok: false }),
  );
  it("does not register in development", async () => {
    const register = vi.fn();
    const states: string[] = [];
    await registerProductionServiceWorker(false, register, (value) =>
      states.push(value.state),
    );
    expect(register).not.toHaveBeenCalled();
    expect(states).toEqual(["unsupported"]);
  });
});
