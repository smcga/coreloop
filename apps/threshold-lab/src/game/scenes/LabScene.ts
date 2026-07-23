import Phaser from "phaser";
import {
  createInitialRunState,
  handle,
  type RunCommand,
  type RunEvent,
  type RunState,
} from "@core-loop/core";
import { palette } from "../config";
import {
  calculateScore,
  createEncounterReport,
  initialSelection,
  selectedTiles,
  toggleTile,
  type SelectionState,
} from "../selection";

export class LabScene extends Phaser.Scene {
  private run: RunState = createInitialRunState();
  private selection: SelectionState = initialSelection();
  private feedback = "Select up to five tiles, then submit";
  private debug = false;
  private log: string[] = [];
  private inputLocked = false;

  constructor() {
    super("lab");
  }

  create(): void {
    this.startNewRun();
    this.scale.on("resize", this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off("resize", this.render, this),
    );
  }

  private dispatch(command: RunCommand): readonly RunEvent[] {
    const before = this.run.phase;
    const result = handle(this.run, command);
    this.run = result.state;
    this.log.push(
      `> ${command.type}`,
      ...result.events.map((event) => `< ${event.type}`),
      `${before} → ${this.run.phase}`,
    );
    this.log = this.log.slice(-12);
    return result.events;
  }

  private startNewRun(): void {
    const seed = Date.now() >>> 0;
    this.run = createInitialRunState();
    this.log = [];
    this.dispatch({ type: "start-run", seed });
    this.dispatch({ type: "start-encounter" });
    this.selection = initialSelection();
    this.feedback = "Select up to five tiles, then submit";
    this.inputLocked = false;
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    const brief = this.run.currentEncounter;
    if (brief === null) return;
    const { width, height } = this.scale;
    const landscape = width > height;
    const columns = landscape ? 6 : 4;
    const gap = Math.max(5, Math.min(10, width / 50));
    const gridWidth = Math.min(width - 20, landscape ? width * 0.64 : 500);
    const tileSize = Math.max(
      42,
      Math.min(
        (gridWidth - gap * (columns - 1)) / columns,
        landscape ? (height - 180) / 2 : (height - 300) / 3,
        82,
      ),
    );
    const actualWidth = columns * tileSize + (columns - 1) * gap;
    const startX = (width - actualWidth) / 2 + tileSize / 2;
    const startY = landscape ? 105 : 170;
    const chosen = selectedTiles(brief, this.selection);
    const score = calculateScore(chosen);

    this.textButton(
      12,
      12,
      "‹ Menu",
      () => this.scene.start("menu"),
      false,
      110,
    );
    this.add
      .text(width / 2, 15, "THRESHOLD LAB", {
        fontFamily: "system-ui",
        fontSize: landscape ? "19px" : "22px",
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5, 0);
    this.textButton(
      width - 86,
      12,
      this.debug ? "Hide log" : "Debug",
      () => {
        this.debug = !this.debug;
        this.render();
      },
      false,
      74,
    );
    this.add
      .text(
        width / 2,
        48,
        `RUN ${brief.number} / 6   •   TARGET ${brief.target}   •   ¤ ${this.run.currency}`,
        {
          fontFamily: "system-ui",
          fontSize: landscape ? "16px" : "18px",
          fontStyle: "bold",
          color: "#38bdf8",
        },
      )
      .setOrigin(0.5, 0);
    this.add
      .text(
        width / 2,
        74,
        `Seed ${this.run.seed}   •   Score ${score.total}   •   ${this.selection.selected.size} / ${brief.selectionLimit}`,
        { fontFamily: "system-ui", fontSize: "15px", color: palette.text },
      )
      .setOrigin(0.5, 0);
    this.add
      .text(
        width / 2,
        96,
        `Base ${score.base}  Pair +${score.pairBonus}  Sequence +${score.sequenceBonus}  Tags +${score.matchingTagBonus}`,
        {
          fontFamily: "system-ui",
          fontSize: landscape ? "13px" : "14px",
          color: palette.muted,
        },
      )
      .setOrigin(0.5, 0);

    brief.tiles.forEach((tile, index) => {
      const x = startX + (index % columns) * (tileSize + gap);
      const y = startY + Math.floor(index / columns) * (tileSize + gap);
      const selected = this.selection.selected.has(tile.id);
      const tagColour =
        tile.tags[0] === "cyan"
          ? 0x22d3ee
          : tile.tags[0] === "amber"
            ? 0xfbbf24
            : 0xc084fc;
      const shape = this.add
        .rectangle(
          x,
          y,
          tileSize,
          tileSize,
          selected ? palette.selected : palette.panel,
        )
        .setStrokeStyle(selected ? 5 : 3, selected ? 0xffffff : tagColour);
      if (this.run.phase === "encounter-active" && !this.inputLocked)
        shape
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.toggle(tile.id));
      this.add
        .text(x, y - 5, selected ? `✓ ${tile.value}` : String(tile.value), {
          fontFamily: "system-ui",
          fontSize: `${Math.max(20, tileSize * 0.32)}px`,
          fontStyle: "bold",
          color: palette.text,
        })
        .setOrigin(0.5);
      this.add
        .text(x, y + tileSize * 0.3, tile.tags[0] ?? "", {
          fontFamily: "system-ui",
          fontSize: "10px",
          color: palette.muted,
        })
        .setOrigin(0.5);
    });

    const rows = Math.ceil(brief.tiles.length / columns);
    const controlsY = Math.min(
      height - 48,
      startY + rows * (tileSize + gap) + 18,
    );
    if (this.run.phase === "encounter-active") {
      this.control(width / 2 - 82, controlsY, "Submit", () => this.submit());
      this.control(
        width / 2 + 82,
        controlsY,
        "Clear",
        () => {
          this.selection = initialSelection();
          this.feedback = "Selection cleared";
          this.render();
        },
        false,
      );
    } else if (this.run.phase === "encounter-won") {
      this.control(width / 2, controlsY, "Next encounter", () =>
        this.advance(),
      );
    } else {
      this.control(width / 2, controlsY, "Start new run", () =>
        this.startNewRun(),
      );
    }
    this.add
      .text(width / 2, Math.min(height - 18, controlsY + 38), this.feedback, {
        fontFamily: "system-ui",
        fontSize: "16px",
        fontStyle: "bold",
        color: this.run.phase === "run-failed" ? palette.warning : palette.text,
        align: "center",
      })
      .setOrigin(0.5);
    if (this.debug)
      this.add
        .text(12, 126, this.log.join("\n"), {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#d1fae5",
          backgroundColor: "#0f172eee",
          padding: { x: 8, y: 6 },
        })
        .setDepth(10);
  }

  private toggle(id: string): void {
    const next = toggleTile(
      this.selection,
      id,
      this.run.currentEncounter!.selectionLimit,
    );
    this.feedback =
      next === this.selection
        ? "Limit reached — deselect a tile first"
        : "Build patterns for visible bonuses";
    this.selection = next;
    this.render();
  }

  private submit(): void {
    if (this.inputLocked || this.run.currentEncounter === null) return;
    this.inputLocked = true;
    const report = createEncounterReport(
      this.run.currentEncounter,
      this.selection,
    );
    this.log.push(`report score=${report.score}`);
    this.dispatch({ type: "submit-encounter", report });
    this.feedback =
      this.run.phase === "run-failed"
        ? `Run lost — ${report.score} fell short of ${this.run.currentEncounter.target}`
        : this.run.phase === "run-complete"
          ? `Run won! Final score ${report.score} • Currency ${this.run.currency}`
          : `Encounter won! ${report.score} ≥ ${this.run.currentEncounter.target}`;
    this.render();
  }

  private advance(): void {
    if (this.inputLocked === false) return;
    this.dispatch({ type: "advance" });
    this.dispatch({ type: "start-encounter" });
    this.selection = initialSelection();
    this.inputLocked = false;
    this.feedback = "New encounter ready — make your selection";
    this.render();
  }

  private control(
    x: number,
    y: number,
    label: string,
    action: () => void,
    primary = true,
  ): void {
    const bg = this.add
      .rectangle(
        x,
        y,
        label.length > 8 ? 210 : 146,
        50,
        primary ? palette.accent : palette.panel,
      )
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: "system-ui",
        fontSize: "18px",
        fontStyle: "bold",
        color: primary ? "#082f49" : palette.text,
      })
      .setOrigin(0.5);
    bg.once("pointerdown", action);
  }

  private textButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    primary: boolean,
    width: number,
  ): void {
    const bg = this.add
      .rectangle(x, y, width, 42, primary ? palette.accent : palette.panel)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x + width / 2, y + 21, label, {
        fontFamily: "system-ui",
        fontSize: "15px",
        color: palette.text,
      })
      .setOrigin(0.5);
    bg.on("pointerdown", action);
  }
}
