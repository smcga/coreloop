import { describe, expect, it } from "vitest";
import {
  computeEncounterLayout,
  computeMenuLayout,
  computeShopLayout,
  layoutMode,
} from "../src/game/ui/Layout";

describe("responsive layout", () => {
  it("selects modes for narrow, short, and wide viewports", () => {
    expect(layoutMode(390, 844)).toBe("compact");
    expect(layoutMode(844, 390)).toBe("compact");
    expect(layoutMode(1200, 800)).toBe("wide");
  });

  it("keeps a variable menu stack inside the viewport", () => {
    for (const count of [2, 4]) {
      const layout = computeMenuLayout(320, 568, count);
      expect(layout.buttons).toHaveLength(count);
      expect(
        layout.buttons.at(-1)!.y + layout.buttons.at(-1)!.height,
      ).toBeLessThanOrEqual(556);
      expect(layout.buttons[1]?.y ?? Infinity).toBeGreaterThan(
        layout.buttons[0]!.y + layout.buttons[0]!.height,
      );
    }
  });

  it("reserves non-overlapping encounter regions", () => {
    for (const viewport of [
      [390, 844],
      [844, 390],
      [1280, 800],
    ] as const) {
      const [width, height] = viewport;
      const layout = computeEncounterLayout(width, height, {
        tileCount: 12,
        debugOpen: true,
        resolved: true,
      });
      expect(layout.board.y).toBeGreaterThanOrEqual(
        layout.hud.y + layout.hud.height,
      );
      expect(layout.actions.y).toBeGreaterThanOrEqual(
        layout.board.y + layout.board.height,
      );
      expect(layout.feedback.y).toBeGreaterThanOrEqual(
        layout.actions.y + layout.actions.height,
      );
      expect(layout.tileSize).toBeGreaterThanOrEqual(38);
    }
  });

  it("keeps shop cards, inventory, feedback, and actions separate", () => {
    for (const viewport of [
      [390, 844],
      [844, 390],
      [1280, 800],
    ] as const) {
      const [width, height] = viewport;
      const layout = computeShopLayout(width, height, {
        offerCount: 3,
        inventoryCount: 4,
      });
      expect(
        layout.offers.at(-1)!.y + layout.offers.at(-1)!.height,
      ).toBeLessThanOrEqual(layout.inventory.y);
      expect(layout.inventory.y + layout.inventory.height).toBeLessThanOrEqual(
        layout.feedback.y,
      );
      expect(layout.feedback.y + layout.feedback.height).toBeLessThanOrEqual(
        layout.actions.y,
      );
    }
  });
});
