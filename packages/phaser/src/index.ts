import Phaser from "phaser";

/** Shared scaling defaults for mobile-first Core Loop hosts. */
export const responsiveScale: Phaser.Types.Core.ScaleConfig = {
  mode: Phaser.Scale.RESIZE,
  autoCenter: Phaser.Scale.CENTER_BOTH,
};
