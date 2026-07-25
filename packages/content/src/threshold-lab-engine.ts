import type { ItemDefinition, RunConfiguration } from "@core-loop/core";

/** Framework-facing catalogue for the Threshold Lab application. */
export const thresholdLabEngineDefinitions: readonly ItemDefinition[] =
  Object.freeze([
    {
      id: "threshold-lab:cyan-focus",
      category: "modifier",
      name: "Cyan Focus",
      description: "+10 per selected cyan object",
      rarity: "threshold-lab:common",
      weight: 5,
      basePrice: 10,
      triggers: [
        {
          id: "cyan-score",
          event: "score",
          stage: "additive",
          operations: [
            {
              type: "add-score",
              amount: { from: "metric", key: "cyan" },
              factor: 10,
            },
          ],
        },
      ],
    },
    {
      id: "threshold-lab:pair-amplifier",
      category: "modifier",
      name: "Pair Amplifier",
      description: "Pair bonus ×1.5",
      rarity: "threshold-lab:common",
      weight: 4,
      basePrice: 12,
      triggers: [
        {
          id: "amplify-pair",
          event: "score",
          stage: "multiplicative",
          conditions: { type: "signal-tag", tag: "pair" },
          operations: [
            { type: "multiply-score", numerator: 3, denominator: 2 },
          ],
        },
      ],
    },
    {
      id: "threshold-lab:perfect-reward",
      category: "modifier",
      name: "Perfect Reward",
      description: "+5 currency when scoring 20 over target",
      rarity: "threshold-lab:uncommon",
      weight: 3,
      basePrice: 14,
      triggers: [
        {
          id: "perfect-currency",
          event: "result",
          stage: "post-result",
          conditions: {
            type: "compare",
            left: { from: "signal", key: "margin" },
            comparator: "gte",
            right: { from: "constant", value: 20 },
          },
          operations: [
            { type: "currency", amount: { from: "constant", value: 5 } },
          ],
        },
      ],
    },
    {
      id: "threshold-lab:score-pulse",
      category: "consumable",
      name: "Score Pulse",
      description: "+15 score this encounter",
      rarity: "threshold-lab:uncommon",
      weight: 3,
      basePrice: 8,
      use: { type: "encounter-effect" },
      triggers: [
        {
          id: "score-pulse",
          event: "score",
          stage: "additive",
          operations: [
            { type: "add-score", amount: { from: "constant", value: 15 } },
          ],
        },
      ],
    },
  ]);

export const thresholdLabRunConfiguration: RunConfiguration = {
  definitions: thresholdLabEngineDefinitions,
  initialItems: ["threshold-lab:score-pulse"],
  rulesForEncounter: (number, moduleId) => {
    if (number !== 3 && number !== 6) return [];
    const suffix =
      moduleId === "threshold-lab:timing-meter"
        ? number === 3
          ? "faster-marker"
          : "narrow-zones"
        : number === 3
          ? "reduced-selection"
          : "cyan-penalty";
    return [{ id: `threshold-lab:${suffix}`, version: 1 }];
  },
};
