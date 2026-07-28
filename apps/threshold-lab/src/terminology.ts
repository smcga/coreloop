import {
  ContentRegistry,
  thresholdLabContentPack,
  type ActionLabelKey,
  type LocalePresentationPack,
} from "@core-loop/content";

const registry = new ContentRegistry(thresholdLabContentPack);
const storageKey = "core-loop:terminology";
export function selectedTerminologyId(): string {
  const saved = localStorage.getItem(storageKey);
  return thresholdLabContentPack.terminology.some((term) => term.id === saved)
    ? saved!
    : thresholdLabContentPack.defaultTerminologyId;
}
export function terminology() {
  return registry.terminology(selectedTerminologyId());
}
const actions = Object.fromEntries(
  [
    "start",
    "continue",
    "advance",
    "reroll",
    "buy",
    "sell",
    "use",
    "attach",
    "transform",
    "duplicate",
  ].map((key) => [key, key[0]!.toUpperCase() + key.slice(1)]),
) as Record<ActionLabelKey, string>;
const content = Object.fromEntries(
  thresholdLabContentPack.definitions.map((definition) => [
    definition.id,
    definition.presentation,
  ]),
);
const rules = Object.fromEntries(
  thresholdLabContentPack.definitions
    .filter((definition) => definition.category === "special-encounter-rule")
    .map((definition) => [definition.id, definition.presentation]),
);
export function presentation(): LocalePresentationPack {
  const selected = terminology();
  return {
    id: `${selected.id}:en-gb`,
    locale: "en-GB",
    terminology: selected.terms,
    actions,
    content,
    rules,
    tracks: { score: selected.terms.score.singular, accuracy: "Accuracy" },
    modules: {
      "threshold-lab:combination-grid": {
        name: "Combination Grid",
        description: "Number patterns and selections",
        instructions:
          "Select numbered objects to build pairs, runs and tag matches.",
      },
      "threshold-lab:timing-meter": {
        name: "Timing Meter",
        description: "Stop the marker near centre",
        instructions:
          "Stop the moving marker near the centre over four timing attempts.",
      },
    },
    currency: {
      display: "name",
      nameKey: "currency",
      maximumFractionDigits: 0,
    },
  };
}
export function toggleTerminology(): string {
  const next = selectedTerminologyId().endsWith("lab-terms")
    ? "threshold-lab:music-terms"
    : "threshold-lab:lab-terms";
  localStorage.setItem(storageKey, next);
  return next;
}
