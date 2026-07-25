/** Garden-specific authored catalogue; definitions remain immutable and outside core. */
export const gardenContent = {
  helpers: [
    "compost-keeper",
    "rain-reader",
    "bee-friend",
    "mulch-maker",
    "shade-guide",
    "worm-keeper",
    "seed-saver",
    "bed-planner",
    "pruning-hand",
    "harvest-helper",
  ].map((id) => ({
    id: `garden-loop:${id}`,
    category: "passive-modifier" as const,
  })),
  supplies: ["watering-can", "fleece", "feed", "twine"].map((id) => ({
    id: `garden-loop:${id}`,
    category: "consumable" as const,
  })),
  plants: ["bean", "tomato", "lettuce", "marigold", "courgette"].map((id) => ({
    id: `garden-loop:${id}`,
    category: "playable-object" as const,
  })),
  traits: ["deep-rooted", "early", "drought-ready"].map((id) => ({
    id: `garden-loop:${id}`,
    category: "attached-modifier" as const,
  })),
  weather: ["dry-spell", "heavy-rain", "cold-snap"].map((id) => ({
    id: `garden-loop:${id}`,
    category: "special-encounter-rule" as const,
  })),
  approaches: [
    "garden-loop:balanced-bed",
    "garden-loop:resilient-bed",
  ] as const,
} as const;
export const gardenTerms = {
  run: ["season", "seasons"],
  encounter: ["growing session", "growing sessions"],
  specialEncounter: ["bad weather", "bad weather events"],
  passiveModifier: ["helper", "helpers"],
  consumable: ["supply", "supplies"],
  playableObject: ["plant", "plants"],
  attachedModifier: ["trait", "traits"],
  shop: ["garden centre", "garden centres"],
  currency: ["compost", "compost"],
  target: ["harvest goal", "harvest goals"],
} as const;
