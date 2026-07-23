import Phaser from "phaser";
import { palette } from "../config";
import { RunSaveStore } from "../../persistence";
import { terminology, toggleTerminology } from "../../terminology";
import { computeMenuLayout, type Rect } from "../ui/Layout";
import { ui } from "../ui/UiTokens";
import { COMBINATION_GRID_ID, TIMING_METER_ID } from "../../gameplay/modules";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }
  create(): void {
    this.scale.on("resize", this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off("resize", this.render, this),
    );
    this.render();
  }
  private render(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const terms = terminology().terms;
    const store = new RunSaveStore(localStorage);
    const saved = store.load();
    const actions = [
      ...(saved
        ? [
            {
              label: `Continue ${terms.run.singular.toLowerCase()}`,
              action: () => this.scene.start("lab", { run: saved.run }),
            },
          ]
        : []),
      {
        label: "Import save JSON",
        action: () => {
          const text = window.prompt("Paste a Core Loop save JSON envelope");
          if (!text) return;
          try {
            const result = store.importText(text);
            window.alert(
              result.migratedFrom === null
                ? "Current save imported"
                : `Save v${result.migratedFrom} migrated and imported`,
            );
            this.render();
          } catch (error) {
            window.alert(
              `Save import failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      },
      ...(saved
        ? [
            {
              label: "Copy save JSON",
              action: () => {
                const text = store.exportText();
                if (text)
                  void navigator.clipboard.writeText(text).then(
                    () => window.alert("Save JSON copied"),
                    () => window.prompt("Copy save JSON", text),
                  );
              },
            },
          ]
        : []),
      {
        label: "Import replay JSON",
        action: () => {
          const text = window.prompt("Paste a Core Loop replay JSON envelope");
          if (!text) return;
          try {
            const replay = store.importReplayText(text);
            window.alert(
              `Replay validated: ${replay.inputs.length} inputs. Use automated Verify Replay for deterministic execution.`,
            );
          } catch (error) {
            window.alert(
              `Replay import failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      },
      ...(store.loadReplay()
        ? [
            {
              label: "Copy replay JSON",
              action: () => {
                const text = store.exportReplayText();
                if (text)
                  void navigator.clipboard.writeText(text).then(
                    () => window.alert("Replay JSON copied"),
                    () => window.prompt("Copy replay JSON", text),
                  );
              },
            },
          ]
        : []),
      {
        label: `New · Combination Grid\nNumber patterns and selections`,
        action: () =>
          this.scene.start("lab", { moduleId: COMBINATION_GRID_ID }),
      },
      {
        label: `New · Timing Meter\nStop the marker near centre`,
        action: () => this.scene.start("lab", { moduleId: TIMING_METER_ID }),
      },
      ...(saved
        ? [
            {
              label: "Delete save",
              action: () => {
                store.clear();
                this.render();
              },
            },
          ]
        : []),
      {
        label: `${terms.encounter.singular} · ${terms["passive-modifier"].singular} · ${terms.currency.plural}`,
        action: () => {
          toggleTerminology();
          this.render();
        },
      },
    ];
    const layout = computeMenuLayout(width, height, actions.length);
    this.add
      .text(width / 2, layout.titleY, "THRESHOLD LAB", {
        fontFamily: "system-ui",
        fontSize: `${Math.min(42, width / 11)}px`,
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        layout.subtitleY,
        `Build a ${terms.run.singular.toLowerCase()} through six ${terms.encounter.plural.toLowerCase()}`,
        {
          fontFamily: "system-ui",
          fontSize: `${Math.min(20, width / 20)}px`,
          color: palette.muted,
          align: "center",
          wordWrap: { width: layout.content.width },
        },
      )
      .setOrigin(0.5);
    actions.forEach((action, index) =>
      this.button(
        layout.buttons[index]!,
        action.label,
        action.action,
        index === actions.length - 1,
      ),
    );
  }
  private button(
    rect: Rect,
    label: string,
    action: () => void,
    terminology = false,
  ): void {
    const bg = this.add
      .rectangle(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        rect.height,
        terminology ? palette.panel : palette.accent,
      )
      .setStrokeStyle(3, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(rect.x + rect.width / 2, rect.y + rect.height / 2, label, {
        fontFamily: ui.font,
        fontSize: terminology ? "15px" : "20px",
        fontStyle: "bold",
        color: terminology ? palette.text : "#082f49",
        align: "center",
        wordWrap: { width: rect.width - 24 },
      })
      .setOrigin(0.5);
    bg.on("pointerdown", action);
  }
}
