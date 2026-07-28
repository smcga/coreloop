import {
  CONTENT_SCHEMA_VERSION,
  type ContentDefinition,
  type ContentPack,
  type TerminologyPack,
} from "@core-loop/content";

const presentation = (name: string, description: string) => ({
  name,
  description,
});

const terms: TerminologyPack = {
  id: "garden-loop:english",
  applicationTitle: "Garden Loop",
  terms: {
    run: { singular: "season", plural: "seasons" },
    stage: { singular: "season stage", plural: "season stages" },
    encounter: { singular: "growing session", plural: "growing sessions" },
    "special-encounter": {
      singular: "weather event",
      plural: "weather events",
    },
    "playable-object": { singular: "plant", plural: "plants" },
    "passive-modifier": { singular: "helper", plural: "helpers" },
    consumable: { singular: "supply", plural: "supplies" },
    "attached-modifier": { singular: "trait", plural: "traits" },
    "run-upgrade": { singular: "facility", plural: "facilities" },
    "reward-container": { singular: "reward", plural: "rewards" },
    shop: { singular: "garden centre", plural: "garden centres" },
    currency: { singular: "compost", plural: "compost" },
    score: { singular: "harvest", plural: "harvests" },
    target: { singular: "harvest goal", plural: "harvest goals" },
    inventory: { singular: "garden shed", plural: "garden sheds" },
    reroll: { singular: "refresh", plural: "refreshes" },
    buy: { singular: "take home", plural: "take home" },
    sell: { singular: "return", plural: "returns" },
  },
};

const definitions: ContentDefinition[] = [
  {
    id: "garden-loop:bean",
    category: "playable-object",
    tags: ["plant", "resilient"],
    rarity: "garden-loop:common",
    basePrice: 3,
    weight: 8,
    presentation: presentation("Bean", "A dependable climbing crop."),
    baseValues: { growth: 6, water: 2, resilience: 4 },
    compatibleAttachmentTags: ["plant-trait"],
    attachmentSlots: 1,
    gameplay: { family: "legume" },
  },
  {
    id: "garden-loop:marigold",
    category: "playable-object",
    tags: ["plant", "companion"],
    rarity: "garden-loop:common",
    basePrice: 3,
    weight: 8,
    presentation: presentation("Marigold", "A diverse companion plant."),
    baseValues: { growth: 5, water: 1, resilience: 3 },
    compatibleAttachmentTags: ["plant-trait"],
    attachmentSlots: 1,
    gameplay: { family: "flower" },
  },
  {
    id: "garden-loop:compost-keeper",
    category: "passive-modifier",
    tags: ["helper", "economy"],
    rarity: "garden-loop:common",
    basePrice: 6,
    weight: 7,
    attachmentSlots: 1,
    presentation: presentation(
      "Compost Keeper",
      "Earns compost after a successful harvest.",
    ),
    triggers: [
      {
        id: "successful-harvest-compost",
        event: "encounter-won",
        stage: "post-result",
        operations: [
          { type: "currency", amount: { from: "constant", value: 2 } },
        ],
      },
    ],
  },
  {
    id: "garden-loop:bee-friend",
    category: "passive-modifier",
    tags: ["helper", "planting"],
    rarity: "garden-loop:common",
    basePrice: 5,
    weight: 8,
    attachmentSlots: 1,
    presentation: presentation(
      "Bee Friend",
      "Adds 2 harvest for each resilient plant placed this session.",
    ),
    initialStoredValues: { encounterHarvest: 0 },
    triggers: [
      {
        id: "resilient-plant-bonus",
        event: "garden-loop:planted",
        stage: "gameplay",
        conditions: { type: "signal-tag", tag: "resilient" },
        operations: [
          {
            type: "stored-value",
            key: "encounterHarvest",
            amount: { from: "constant", value: 2 },
          },
        ],
      },
      {
        id: "apply-resilient-plant-bonus",
        event: "score",
        stage: "additive",
        operations: [
          {
            type: "add-score",
            amount: { from: "stored", key: "encounterHarvest" },
          },
          {
            type: "stored-value",
            key: "encounterHarvest",
            action: "set",
            amount: { from: "constant", value: 0 },
          },
        ],
      },
    ],
  },
  {
    id: "garden-loop:watering-can",
    category: "consumable",
    tags: ["supply", "water"],
    rarity: "garden-loop:common",
    basePrice: 3,
    weight: 9,
    presentation: presentation(
      "Watering Can",
      "Adds 3 harvest for the next growing session.",
    ),
    legalPhases: ["encounter-ready"],
    operation: "effect",
    triggers: [
      {
        id: "watering-bonus",
        event: "score",
        stage: "additive",
        operations: [
          { type: "add-score", amount: { from: "constant", value: 3 } },
        ],
      },
    ],
  },
  {
    id: "garden-loop:deep-rooted",
    category: "attached-modifier",
    tags: ["plant-trait", "resilient"],
    rarity: "garden-loop:uncommon",
    basePrice: 4,
    weight: 5,
    presentation: presentation(
      "Deep Rooted",
      "Adds 2 resilience to its host and 2 harvest.",
    ),
    hostCategories: ["playable-object", "passive-modifier"],
    slot: "garden-loop:trait",
    occupiesInventory: false,
    triggers: [
      {
        id: "deep-rooted-harvest",
        event: "score",
        stage: "additive",
        operations: [
          { type: "add-score", amount: { from: "constant", value: 2 } },
        ],
      },
    ],
  },
  {
    id: "garden-loop:larger-shed",
    category: "run-upgrade",
    tags: ["facility", "capacity"],
    rarity: "garden-loop:uncommon",
    basePrice: 7,
    weight: 4,
    presentation: presentation("Larger Shed", "Makes room for another helper."),
    changes: { "capacity:passive-modifier": 1 },
  },
  ...(["dry-spell", "severe-storm"] as const).map(
    (id, index): ContentDefinition => ({
      id: `garden-loop:${id}`,
      category: "special-encounter-rule",
      tags: ["weather", index ? "severe" : "dry"],
      presentation: presentation(
        index ? "Severe Storm" : "Dry Spell",
        index
          ? "Only resilient planting can withstand the final storm."
          : "One less unit of water is available.",
      ),
      severity: index + 1,
    }),
  ),
  {
    id: "garden-loop:garden-centre",
    category: "shop-pool",
    tags: ["shop"],
    presentation: presentation(
      "Garden Centre",
      "Helpers, supplies, traits and facilities.",
    ),
    allowDuplicates: false,
    categories: [
      "playable-object",
      "passive-modifier",
      "consumable",
      "attached-modifier",
      "run-upgrade",
    ],
    entries: [
      "bean",
      "marigold",
      "compost-keeper",
      "bee-friend",
      "watering-can",
      "deep-rooted",
      "larger-shed",
    ].map((id) => ({ definitionId: `garden-loop:${id}`, weight: 5 })),
  },
  {
    id: "garden-loop:balanced-bed",
    category: "starting-loadout",
    tags: ["approach"],
    presentation: presentation(
      "Balanced Bed",
      "A bean, watering can and space to grow.",
    ),
    currency: 10,
    ownedDefinitionIds: [
      "garden-loop:bean",
      "garden-loop:marigold",
      "garden-loop:watering-can",
    ],
    capacities: { "playable-object": 3, "passive-modifier": 1, consumable: 2 },
  },
  ...(["compost-reward", "plant-choice", "trait-reward"] as const).map(
    (id, index): ContentDefinition => ({
      id: `garden-loop:${id}`,
      category: "reward-container",
      tags: ["reward"],
      presentation: presentation(
        id.replaceAll("-", " "),
        "An authored Garden reward container.",
      ),
      rewardType: (["currency", "choice", "targeted"] as const)[index]!,
      ...(index === 0
        ? { currency: 4 }
        : index === 1
          ? { choiceCount: 2, poolId: "garden-loop:garden-centre" }
          : {
              poolId: "garden-loop:garden-centre",
              targetOperation: "attach" as const,
            }),
    }),
  ),
];

export const gardenContentPack: ContentPack = {
  id: "garden-loop:season-one",
  version: 1,
  schemaVersion: CONTENT_SCHEMA_VERSION,
  metadata: presentation("Garden Loop", "A five-session growing season."),
  capabilities: ["garden-loop:plants"],
  definitions,
  rarities: [
    {
      id: "garden-loop:common",
      defaultWeight: 8,
      priceMultiplier: 1,
      presentation: presentation("Common", "Reliable garden stock."),
    },
    {
      id: "garden-loop:uncommon",
      defaultWeight: 4,
      priceMultiplier: 1.25,
      presentation: presentation("Uncommon", "Specialist garden stock."),
    },
  ],
  terminology: [terms],
  defaultTerminologyId: terms.id,
  presentation: {
    "garden-loop:dry-spell": "A dry spell reduces available water.",
    "garden-loop:severe-storm": "The severe storm demands resilient plants.",
  },
};

/** Backwards-compatible catalogue-shaped view for integrations that only list IDs. */
export const gardenContent = gardenContentPack.definitions;
export const gardenTerms = terms;
