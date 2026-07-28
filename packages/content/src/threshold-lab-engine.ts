import { defaultPolicies, type RunConfiguration } from "@core-loop/core";
import { ContentRegistry } from "./registry";
import {
  createRuntimeContentProvider,
  createShopPoolProviders,
} from "./runtime-provider";
import { thresholdLabContentPack } from "./threshold-lab";

const registry = new ContentRegistry(thresholdLabContentPack);
export const thresholdLabContentProvider =
  createRuntimeContentProvider(registry);

export const thresholdLabRunConfiguration: RunConfiguration = {
  content: thresholdLabContentProvider,
  defaultLoadoutId: "threshold-lab:starter-balanced",
  shopProviders: createShopPoolProviders(registry),
  gameplayCapabilities: {
    "threshold-lab:combination-grid": ["selection", "allowance:action"],
    "threshold-lab:timing-meter": ["timing", "allowance:action"],
  },
  rarityPriceMultipliers: Object.fromEntries(
    thresholdLabContentPack.rarities.map((rarity) => [
      rarity.id,
      rarity.priceMultiplier,
    ]),
  ),
  encounterRuleEffects: {
    "threshold-lab:reduced-selection": {
      id: "threshold-lab:reduced-selection",
      label: "Reduced action allowance",
      tags: ["special-rule"],
      triggers: [
        {
          id: "reduce-action",
          event: "encounter-prepared",
          operations: [
            {
              type: "modify-allowance",
              resource: "action",
              amount: { from: "constant", value: -1 },
              lifetime: "encounter",
            },
          ],
        },
      ],
    },
    "threshold-lab:fewer-attempts": {
      id: "threshold-lab:fewer-attempts",
      label: "Reduced action allowance",
      tags: ["special-rule"],
      triggers: [
        {
          id: "reduce-action",
          event: "encounter-prepared",
          operations: [
            {
              type: "modify-allowance",
              resource: "action",
              amount: { from: "constant", value: -1 },
              lifetime: "encounter",
            },
          ],
        },
      ],
    },
  },
  policies: {
    ...defaultPolicies,
    schedule: {
      ...defaultPolicies.schedule,
      createSchedule: ({ gameplayModuleId }) =>
        Array.from({ length: 6 }, (_, index) => {
          const ordinal = index + 1,
            special = ordinal === 3 || ordinal === 6;
          const suffix =
            gameplayModuleId === "threshold-lab:timing-meter"
              ? ordinal === 3
                ? "fewer-attempts"
                : "narrow-zones"
              : ordinal === 3
                ? "reduced-selection"
                : "cyan-penalty";
          return {
            id: `encounter-${ordinal}`,
            ordinal,
            kind: special ? "special" : "ordinary",
            rules: special
              ? [{ id: `threshold-lab:${suffix}`, version: 1 }]
              : [],
          };
        }),
    },
  },
};
