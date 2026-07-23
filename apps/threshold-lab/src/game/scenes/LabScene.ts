import Phaser from "phaser";
import {
  createInitialRunState,
  definitionFor,
  handle,
  type RunCommand,
  type RunEvent,
  type RunState,
} from "@core-loop/core";
import { palette } from "../config";
import { RunSaveStore } from "../../persistence";
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
  private readonly saves = new RunSaveStore(localStorage);

  constructor() {
    super("lab");
  }

  create(data: { run?: RunState }): void {
    if (data.run) {
      this.run = data.run;
      this.feedback = "Saved run resumed";
      this.inputLocked = this.run.phase !== "encounter-active";
    } else this.startNewRun();
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
    if (!result.events.some((event) => event.type === "command-rejected")) {
      if (command.type === "abandon-run") this.saves.clear();
      else this.saves.save(this.run);
    }
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
    this.saves.save(this.run);
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    if (this.run.phase === "shop") {
      this.renderShop();
      return;
    }
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
    if (brief.specialRule)
      this.add
        .text(
          width / 2,
          120,
          brief.specialRule === "reduced-limit"
            ? "⚠ BOSS: one fewer selection"
            : "⚠ BOSS: cyan tiles lose 5",
          {
            fontFamily: "system-ui",
            fontSize: "15px",
            fontStyle: "bold",
            color: palette.warning,
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
    } else if (this.run.phase === "reward") {
      this.control(width / 2, controlsY, "Enter shop", () => {
        this.dispatch({ type: "enter-shop" });
        this.feedback = "Shop open";
        this.render();
      });
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
    if (this.run.scoreLedger.length)
      this.add
        .text(
          width - 12,
          126,
          [
            "SCORE LEDGER",
            ...this.run.scoreLedger.map((entry) => {
              const change =
                entry.operation === "multiply"
                  ? `×${entry.multiplier!.numerator / entry.multiplier!.denominator}`
                  : entry.operation === "final"
                    ? `= ${entry.after}`
                    : entry.operation === "target"
                      ? `= ${entry.after}`
                      : entry.operation === "outcome"
                        ? ""
                        : `${(entry.amount ?? 0) >= 0 ? "+" : "−"}${Math.abs(entry.amount ?? 0)}`;
              const retrigger = entry.retriggered ? " ↻" : "";
              return `${String(entry.sequence).padStart(2, "0")} ${entry.label}${retrigger}  ${change}`;
            }),
          ]
            .slice(0, landscape ? 10 : 8)
            .join("\n"),
          {
            fontFamily: "monospace",
            fontSize: landscape ? "12px" : "11px",
            color: "#fde68a",
            backgroundColor: "#0f172eee",
            padding: { x: 8, y: 6 },
            align: "right",
          },
        )
        .setOrigin(1, 0);
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
        ? `Run lost — ${this.run.lastReport?.score} fell short of ${this.run.currentEncounter.target}`
        : this.run.phase === "run-complete"
          ? `Run won! Final score ${this.run.lastReport?.score} • Currency ${this.run.currency}`
          : `Encounter won! ${this.run.lastReport?.score} ≥ ${this.run.currentEncounter.target}`;
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

  private renderShop(): void {
    const { width, height } = this.scale;
    const shop = this.run.shop!;
    this.textButton(
      12,
      12,
      "Abandon",
      () => {
        this.dispatch({ type: "abandon-run" });
        this.scene.start("menu");
      },
      false,
      100,
    );
    this.add
      .text(width / 2, 18, "BUILD SHOP", {
        fontFamily: "system-ui",
        fontSize: "24px",
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(
        width / 2,
        52,
        `¤ ${this.run.currency}  •  Reroll ¤${shop.rerollPrice}`,
        { fontFamily: "system-ui", fontSize: "17px", color: "#38bdf8" },
      )
      .setOrigin(0.5, 0);
    shop.offers.forEach((offer, index) => {
      const def = definitionFor(offer.definitionId)!;
      const y = 100 + index * 112;
      this.add
        .rectangle(width / 2, y, Math.min(width - 24, 500), 98, palette.panel)
        .setStrokeStyle(2, 0x38bdf8);
      this.add.text(24, y - 34, `${def.name}  •  ${def.rarity}`, {
        fontFamily: "system-ui",
        fontSize: "17px",
        fontStyle: "bold",
        color: palette.text,
      });
      this.add.text(24, y - 8, def.description, {
        fontFamily: "system-ui",
        fontSize: "13px",
        color: palette.muted,
        wordWrap: { width: width - 150 },
      });
      this.textButton(
        width - 106,
        y - 22,
        `Buy ¤${offer.price}`,
        () => {
          const events = this.dispatch({
            type: "buy-offer",
            offerId: offer.id,
          });
          this.feedback =
            events[0]?.type === "command-rejected"
              ? events[0].reason
              : "Item purchased";
          this.render();
        },
        true,
        94,
      );
    });
    const owned = [
      ...this.run.inventory.modifiers,
      ...this.run.inventory.consumables,
    ];
    this.add.text(
      16,
      Math.min(height - 168, 445),
      `BUILD ${this.run.inventory.modifiers.length}/${this.run.inventory.modifierCapacity}  •  TOOLS ${this.run.inventory.consumables.length}/${this.run.inventory.consumableCapacity}`,
      {
        fontFamily: "system-ui",
        fontSize: "14px",
        fontStyle: "bold",
        color: palette.text,
      },
    );
    owned.slice(0, 4).forEach((item, index) => {
      const def = definitionFor(item.definitionId)!;
      const y = Math.min(height - 135, 475) + index * 28;
      this.add.text(18, y, def.name, {
        fontFamily: "system-ui",
        fontSize: "13px",
        color: palette.muted,
      });
      this.textButton(
        width - 76,
        y - 10,
        "Sell",
        () => {
          this.dispatch({ type: "sell-item", instanceId: item.instanceId });
          this.feedback = "Item sold";
          this.render();
        },
        false,
        62,
      );
    });
    this.control(
      width / 2 - 82,
      height - 38,
      "Reroll",
      () => {
        const events = this.dispatch({ type: "reroll-shop" });
        this.feedback =
          events[0]?.type === "command-rejected"
            ? events[0].reason
            : "Offers refreshed";
        this.render();
      },
      false,
    );
    this.control(width / 2 + 82, height - 38, "Continue", () => {
      this.dispatch({ type: "leave-shop" });
      this.useOrStart();
    });
    this.add
      .text(width / 2, height - 74, this.feedback, {
        fontFamily: "system-ui",
        fontSize: "14px",
        color: palette.text,
      })
      .setOrigin(0.5);
  }

  private useOrStart(): void {
    const consumable = this.run.inventory.consumables[0];
    if (consumable) {
      this.dispatch({
        type: "use-consumable",
        instanceId: consumable.instanceId,
      });
      this.feedback = `Used ${definitionFor(consumable.definitionId)?.name}`;
    }
    this.dispatch({ type: "start-encounter" });
    this.selection = initialSelection();
    this.inputLocked = false;
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
