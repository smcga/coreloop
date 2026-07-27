import { defaultPolicies, type RunConfiguration } from "@core-loop/core";
import { ContentRegistry } from "./registry";
import { createRuntimeContentProvider } from "./runtime-provider";
import { thresholdLabContentPack } from "./threshold-lab";

export const thresholdLabContentProvider = createRuntimeContentProvider(
  new ContentRegistry(thresholdLabContentPack),
);

export const thresholdLabRunConfiguration: RunConfiguration = {
  content: thresholdLabContentProvider,
  defaultLoadoutId: "threshold-lab:starter-balanced",
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
                ? "faster-marker"
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
