import Phaser from "phaser";
import { palette } from "../config";
import {
  initialSelection,
  resetSelection,
  SELECTION_LIMIT,
  selectionSum,
  submitSelection,
  TILE_VALUES,
  toggleTile,
  type SelectionState,
} from "../selection";

export class LabScene extends Phaser.Scene {
  private state: SelectionState = initialSelection();
  private feedback = "Tap up to five tiles";
  constructor() {
    super("lab");
  }
  create(): void {
    this.state = initialSelection();
    this.scale.on("resize", this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off("resize", this.render, this),
    );
    this.render();
  }
  private render(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const landscape = width > height;
    const columns = landscape ? 6 : 4;
    const gap = Math.max(6, Math.min(12, width / 40));
    const gridWidth = Math.min(width - 24, landscape ? width * 0.68 : 520);
    const tileSize = Math.min(
      (gridWidth - gap * (columns - 1)) / columns,
      landscape ? (height - 150) / 2 : (height - 260) / 3,
      92,
    );
    const actualWidth = columns * tileSize + (columns - 1) * gap;
    const startX = (width - actualWidth) / 2 + tileSize / 2;
    const startY = landscape ? 92 : 150;
    this.add
      .text(16, 15, "‹ Menu", {
        fontFamily: "system-ui",
        fontSize: "20px",
        color: palette.text,
        backgroundColor: "#1e293b",
        padding: { x: 12, y: 10 },
      })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("menu"));
    this.add
      .text(width / 2, 25, "THRESHOLD LAB", {
        fontFamily: "system-ui",
        fontSize: landscape ? "21px" : "24px",
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(
        width - 16,
        18,
        `${this.state.selected.size} / ${SELECTION_LIMIT}\nSum ${selectionSum(this.state)}`,
        {
          fontFamily: "system-ui",
          fontSize: "18px",
          fontStyle: "bold",
          color: palette.text,
          align: "right",
        },
      )
      .setOrigin(1, 0);
    TILE_VALUES.forEach((value, index) => {
      const x = startX + (index % columns) * (tileSize + gap);
      const y = startY + Math.floor(index / columns) * (tileSize + gap);
      const selected = this.state.selected.has(value);
      const tile = this.add
        .rectangle(
          x,
          y,
          tileSize,
          tileSize,
          selected ? palette.selected : palette.panel,
        )
        .setStrokeStyle(selected ? 5 : 2, selected ? 0xffffff : palette.accent)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x, y, selected ? `✓ ${value}` : String(value), {
          fontFamily: "system-ui",
          fontSize: `${Math.max(20, tileSize * 0.32)}px`,
          fontStyle: "bold",
          color: palette.text,
        })
        .setOrigin(0.5);
      tile.on("pointerdown", () => this.toggle(value));
    });
    const rows = Math.ceil(TILE_VALUES.length / columns);
    const controlsY = Math.min(
      height - 48,
      startY + rows * (tileSize + gap) + 22,
    );
    this.control(width / 2 - 82, controlsY, "Submit", () => {
      this.state = submitSelection(this.state);
      this.feedback = `Experiment score: ${this.state.result}`;
      this.render();
    });
    this.control(width / 2 + 82, controlsY, "Reset", () => {
      this.state = resetSelection();
      this.feedback = "Selection cleared";
      this.render();
    });
    this.add
      .text(
        width / 2,
        Math.min(height - 18, controlsY + 43),
        this.state.result === null
          ? this.feedback
          : `Experiment score: ${this.state.result}`,
        {
          fontFamily: "system-ui",
          fontSize: "18px",
          color: this.feedback.includes("Limit")
            ? palette.warning
            : palette.text,
        },
      )
      .setOrigin(0.5);
  }
  private toggle(value: number): void {
    const next = toggleTile(this.state, value);
    this.feedback =
      next === this.state
        ? "Limit reached — deselect a tile first"
        : "Tap up to five tiles";
    this.state = next;
    this.render();
  }
  private control(
    x: number,
    y: number,
    label: string,
    action: () => void,
  ): void {
    const bg = this.add
      .rectangle(
        x,
        y,
        146,
        52,
        label === "Submit" ? palette.accent : palette.panel,
      )
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: "system-ui",
        fontSize: "20px",
        fontStyle: "bold",
        color: label === "Submit" ? "#082f49" : palette.text,
      })
      .setOrigin(0.5);
    bg.on("pointerdown", action);
  }
}
