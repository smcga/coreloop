import Phaser from "phaser";
import { responsiveScale } from "@core-loop/phaser";
import { BootScene } from "./game/scenes/BootScene";
import { LabScene } from "./game/scenes/LabScene";
import { MenuScene } from "./game/scenes/MenuScene";
import "./style.css";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#101827",
  scale: responsiveScale,
  scene: [BootScene, MenuScene, LabScene],
});
