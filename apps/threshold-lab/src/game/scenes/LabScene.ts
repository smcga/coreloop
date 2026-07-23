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
import { terminology } from "../../terminology";
import {
  computeEncounterLayout,
  computeShopLayout,
  type Rect,
} from "../ui/Layout";
import { ui } from "../ui/UiTokens";

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
    if (this.run.phase === "shop") return this.renderShop();
    const brief = this.run.currentEncounter;
    if (brief === null) return;
    const { width, height } = this.scale;
    const terms = terminology().terms;
    const resolved = this.run.phase !== "encounter-active";
    const layout = computeEncounterLayout(width, height, {
      tileCount: brief.tiles.length,
      debugOpen: this.debug,
      resolved,
    });
    const chosen = selectedTiles(brief, this.selection);
    const score = calculateScore(chosen);

    this.textButton(
      layout.header.x,
      layout.header.y,
      "‹ Menu",
      () => this.scene.start("menu"),
      false,
      88,
    );
    this.add
      .text(width / 2, layout.header.y + 4, "THRESHOLD LAB", {
        fontFamily: ui.font,
        fontSize: layout.mode === "compact" ? "18px" : "24px",
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5, 0);
    this.textButton(
      layout.header.x + layout.header.width - 82,
      layout.header.y,
      this.debug ? "Close" : "Debug",
      () => {
        this.debug = !this.debug;
        this.render();
      },
      false,
      82,
    );

    const hudFont = layout.mode === "compact" ? "14px" : "17px";
    this.add
      .text(
        width / 2,
        layout.hud.y + 2,
        `${terms.run.singular.toUpperCase()} ${brief.number}/6  •  ${terms.target.singular.toUpperCase()} ${brief.target}  •  ${this.run.currency} ${terms.currency.plural}`,
        {
          fontFamily: ui.font,
          fontSize: hudFont,
          fontStyle: "bold",
          color: "#38bdf8",
          align: "center",
          wordWrap: { width: layout.hud.width },
        },
      )
      .setOrigin(0.5, 0);
    this.add
      .text(
        width / 2,
        layout.hud.y + 24,
        `Seed ${this.run.seed}  •  Score ${score.total}  •  ${this.selection.selected.size}/${brief.selectionLimit}`,
        { fontFamily: ui.font, fontSize: "13px", color: palette.text },
      )
      .setOrigin(0.5, 0);
    this.add
      .text(
        width / 2,
        layout.hud.y + 43,
        brief.specialRule
          ? brief.specialRule === "reduced-limit"
            ? "⚠ One fewer selection"
            : "⚠ Cyan tiles lose 5"
          : `Base ${score.base}  •  Pair +${score.pairBonus}  •  Sequence +${score.sequenceBonus}  •  Tags +${score.matchingTagBonus}`,
        {
          fontFamily: ui.font,
          fontSize: "12px",
          color: brief.specialRule ? palette.warning : palette.muted,
          align: "center",
          wordWrap: { width: layout.hud.width },
        },
      )
      .setOrigin(0.5, 0);

    const rows = Math.ceil(brief.tiles.length / layout.columns);
    const gridWidth =
      layout.columns * layout.tileSize + (layout.columns - 1) * layout.gap;
    const gridHeight = rows * layout.tileSize + (rows - 1) * layout.gap;
    const startX =
      layout.board.x +
      (layout.board.width - gridWidth) / 2 +
      layout.tileSize / 2;
    const startY =
      layout.board.y +
      (layout.board.height - gridHeight) / 2 +
      layout.tileSize / 2;
    brief.tiles.forEach((tile, index) => {
      const x =
        startX + (index % layout.columns) * (layout.tileSize + layout.gap);
      const y =
        startY +
        Math.floor(index / layout.columns) * (layout.tileSize + layout.gap);
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
          layout.tileSize,
          layout.tileSize,
          selected ? palette.selected : palette.panel,
        )
        .setStrokeStyle(selected ? 5 : 3, selected ? 0xffffff : tagColour);
      if (!resolved && !this.inputLocked)
        shape
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.toggle(tile.id));
      this.add
        .text(x, y - 4, selected ? `✓ ${tile.value}` : String(tile.value), {
          fontFamily: ui.font,
          fontSize: `${Math.max(18, layout.tileSize * 0.31)}px`,
          fontStyle: "bold",
          color: palette.text,
        })
        .setOrigin(0.5);
      this.add
        .text(x, y + layout.tileSize * 0.3, tile.tags[0] ?? "", {
          fontFamily: ui.font,
          fontSize: "10px",
          color: palette.muted,
        })
        .setOrigin(0.5);
    });

    if (!resolved) {
      this.control(
        width / 2 - 82,
        layout.actions.y + layout.actions.height / 2,
        "Submit",
        () => this.submit(),
      );
      this.control(
        width / 2 + 82,
        layout.actions.y + layout.actions.height / 2,
        "Clear",
        () => {
          this.selection = initialSelection();
          this.feedback = "Selection cleared";
          this.render();
        },
        false,
      );
    } else if (this.run.phase === "reward") {
      this.control(
        width / 2,
        layout.actions.y + layout.actions.height / 2,
        "Enter shop",
        () => {
          this.dispatch({ type: "enter-shop" });
          this.feedback = "Shop open";
          this.render();
        },
      );
    } else
      this.control(
        width / 2,
        layout.actions.y + layout.actions.height / 2,
        "Start new run",
        () => this.startNewRun(),
      );

    this.add
      .text(width / 2, layout.feedback.y + 4, this.feedback, {
        fontFamily: ui.font,
        fontSize: "15px",
        fontStyle: "bold",
        color: this.run.phase === "run-failed" ? palette.warning : palette.text,
        align: "center",
        wordWrap: { width: layout.feedback.width - 16 },
      })
      .setOrigin(0.5, 0);
    const detailRect = layout.details ?? {
      x: layout.feedback.x,
      y: layout.feedback.y + 30,
      width: layout.feedback.width,
      height: layout.feedback.height - 30,
    };
    if (this.debug)
      this.panelText(
        detailRect,
        ["EVENT LOG", ...this.log].slice(-9).join("\n"),
        "#d1fae5",
        layout.details ? "11px" : "10px",
      );
    else if (resolved && this.run.scoreLedger.length)
      this.panelText(
        detailRect,
        [
          "SCORE BREAKDOWN",
          ...this.run.scoreLedger.map(
            (entry) => `${entry.label}: ${entry.after}`,
          ),
        ]
          .slice(0, layout.details ? 12 : 5)
          .join("  •  "),
        "#fde68a",
        "11px",
      );
  }

  private panelText(
    rect: Rect,
    value: string,
    colour: string,
    fontSize: string,
  ): void {
    this.add
      .rectangle(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        Math.max(1, rect.height),
        palette.panel,
      )
      .setStrokeStyle(1, 0x334155);
    this.add.text(rect.x + 8, rect.y + 6, value, {
      fontFamily: ui.mono,
      fontSize,
      color: colour,
      wordWrap: { width: rect.width - 16 },
      maxLines: Math.max(1, Math.floor((rect.height - 12) / 14)),
    });
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
    const owned = [
      ...this.run.inventory.modifiers,
      ...this.run.inventory.consumables,
    ];
    const layout = computeShopLayout(width, height, {
      offerCount: shop.offers.length,
      inventoryCount: owned.length,
    });
    this.textButton(
      layout.header.x,
      layout.header.y,
      "Abandon",
      () => {
        this.dispatch({ type: "abandon-run" });
        this.scene.start("menu");
      },
      false,
      88,
    );
    this.add
      .text(width / 2, layout.header.y + 2, "BUILD SHOP", {
        fontFamily: ui.font,
        fontSize: layout.mode === "compact" ? "20px" : "26px",
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(
        width / 2,
        layout.header.y + 30,
        `¤ ${this.run.currency}  •  Reroll ¤${shop.rerollPrice}`,
        {
          fontFamily: ui.font,
          fontSize: "15px",
          color: "#38bdf8",
        },
      )
      .setOrigin(0.5, 0);

    shop.offers.forEach((offer, index) => {
      const def = definitionFor(offer.definitionId)!;
      const card = layout.offers[index]!;
      this.add
        .rectangle(
          card.x + card.width / 2,
          card.y + card.height / 2,
          card.width,
          card.height,
          palette.panel,
        )
        .setStrokeStyle(2, 0x38bdf8);
      const padding = 12;
      const buttonWidth = Math.min(96, Math.max(74, card.width * 0.3));
      const horizontalCard = card.width > 440;
      const textWidth = horizontalCard
        ? card.width - buttonWidth - padding * 3
        : card.width - padding * 2;
      this.add.text(
        card.x + padding,
        card.y + 9,
        `${def.name}  •  ${def.rarity}`,
        {
          fontFamily: ui.font,
          fontSize: card.height < 90 ? "14px" : "16px",
          fontStyle: "bold",
          color: palette.text,
          wordWrap: { width: textWidth },
          maxLines: 1,
        },
      );
      this.add.text(card.x + padding, card.y + 34, def.description, {
        fontFamily: ui.font,
        fontSize: "12px",
        color: palette.muted,
        wordWrap: { width: textWidth },
        maxLines: Math.max(
          1,
          Math.floor((card.height - (horizontalCard ? 48 : 84)) / 15),
        ),
      });
      const buttonX = horizontalCard
        ? card.x + card.width - buttonWidth - padding
        : card.x + padding;
      const buttonY = horizontalCard
        ? card.y + (card.height - 42) / 2
        : card.y + card.height - 48;
      this.textButton(
        buttonX,
        buttonY,
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
        buttonWidth,
      );
    });

    this.add
      .text(
        layout.inventory.x + 6,
        layout.inventory.y + 4,
        `BUILD ${this.run.inventory.modifiers.length}/${this.run.inventory.modifierCapacity}  •  TOOLS ${this.run.inventory.consumables.length}/${this.run.inventory.consumableCapacity}`,
        {
          fontFamily: ui.font,
          fontSize: "13px",
          fontStyle: "bold",
          color: palette.text,
        },
      )
      .setOrigin(0, 0);
    const rowWidth = Math.min(
      280,
      layout.inventory.width / Math.max(1, Math.min(2, owned.length)),
    );
    owned.slice(0, 4).forEach((item, index) => {
      const def = definitionFor(item.definitionId)!;
      const column = layout.inventory.height < 80 ? index : index % 2;
      const row = layout.inventory.height < 80 ? 0 : Math.floor(index / 2);
      const x = layout.inventory.x + 6 + column * rowWidth;
      const y = layout.inventory.y + 25 + row * 25;
      this.add.text(x, y, def.name, {
        fontFamily: ui.font,
        fontSize: "12px",
        color: palette.muted,
        maxLines: 1,
        fixedWidth: rowWidth - 54,
      });
      this.textButton(
        x + rowWidth - 50,
        y - 8,
        "Sell",
        () => {
          this.dispatch({ type: "sell-item", instanceId: item.instanceId });
          this.feedback = "Item sold";
          this.render();
        },
        false,
        48,
      );
    });
    this.add
      .text(width / 2, layout.feedback.y + 4, this.feedback, {
        fontFamily: ui.font,
        fontSize: "13px",
        color: palette.text,
        wordWrap: { width: layout.feedback.width },
        align: "center",
      })
      .setOrigin(0.5, 0);
    const actionY = layout.actions.y + layout.actions.height / 2;
    this.control(
      width / 2 - 82,
      actionY,
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
    this.control(width / 2 + 82, actionY, "Continue", () => {
      this.dispatch({ type: "leave-shop" });
      this.useOrStart();
    });
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
