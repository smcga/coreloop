import Phaser from "phaser";
import { palette } from "../config";
import { RunSaveStore } from "../../persistence";

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
    this.add
      .text(width / 2, height * 0.3, "THRESHOLD LAB", {
        fontFamily: "system-ui",
        fontSize: `${Math.min(42, width / 11)}px`,
        fontStyle: "bold",
        color: palette.text,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.43, "The touch-first Core Loop test-bed", {
        fontFamily: "system-ui",
        fontSize: `${Math.min(20, width / 20)}px`,
        color: palette.muted,
        align: "center",
        wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);
    const store = new RunSaveStore(localStorage);
    const saved = store.load();
    if (saved)
      this.button(width / 2, height * 0.57, "Continue run", () =>
        this.scene.start("lab", { run: saved.run }),
      );
    this.button(
      width / 2,
      saved ? height * 0.69 : height * 0.62,
      "New run",
      () => this.scene.start("lab", { fresh: true }),
    );
    if (saved)
      this.button(width / 2, height * 0.81, "Delete save", () => {
        store.clear();
        this.render();
      });
  }
  private button(
    x: number,
    y: number,
    label: string,
    action: () => void,
  ): void {
    const bg = this.add
      .rectangle(
        x,
        y,
        Math.min(320, this.scale.width * 0.78),
        64,
        palette.accent,
      )
      .setStrokeStyle(3, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: "system-ui",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#082f49",
      })
      .setOrigin(0.5);
    bg.on("pointerdown", action);
  }
}
