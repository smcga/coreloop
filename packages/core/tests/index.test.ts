import { describe, expect, it } from "vitest";
import { getFrameworkIdentity } from "../src/index";

describe("headless core boundary", () => {
  it("runs without browser or Phaser dependencies", () => {
    expect(getFrameworkIdentity()).toEqual({
      name: "Core Loop",
      version: "0.1.0",
    });
    expect(typeof document).toBe("undefined");
  });
});
