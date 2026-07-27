import {
  CONTENT_SCHEMA_VERSION,
  ContentRegistry,
  createRuntimeContentProvider,
  createShopPoolProviders,
  type ContentPack,
  type TerminologyPack,
} from "@core-loop/content";

const p = (name: string, description: string) => ({ name, description });

export const starterTerminology: TerminologyPack = {
  id: "starter:plain-language",
  applicationTitle: "Four Choice",
  terms: {
    run: { singular: "run", plural: "runs" },
    stage: { singular: "step", plural: "steps" },
    encounter: { singular: "challenge", plural: "challenges" },
    "special-encounter": {
      singular: "final challenge",
      plural: "final challenges",
    },
    "playable-object": { singular: "value", plural: "values" },
    "passive-modifier": { singular: "talent", plural: "talents" },
    consumable: { singular: "boost", plural: "boosts" },
    "attached-modifier": { singular: "finish", plural: "finishes" },
    "run-upgrade": { singular: "upgrade", plural: "upgrades" },
    "reward-container": { singular: "reward", plural: "rewards" },
    shop: { singular: "workshop", plural: "workshops" },
    currency: { singular: "token", plural: "tokens", short: "tk" },
    score: { singular: "score", plural: "scores" },
    target: { singular: "goal", plural: "goals" },
    inventory: { singular: "kit", plural: "kits" },
    reroll: { singular: "refresh", plural: "refreshes" },
    buy: { singular: "get", plural: "get" },
    sell: { singular: "trade", plural: "trades" },
  },
};

/** TODO after generating: rename every `starter:*` ID to your stable namespace. */
export const starterContentPack: ContentPack = {
  id: "starter:content",
  version: 1,
  schemaVersion: CONTENT_SCHEMA_VERSION,
  metadata: p("Starter content", "A compact, complete teaching pack."),
  capabilities: ["starter:choice"],
  rarities: [
    {
      id: "starter:common",
      defaultWeight: 1,
      priceMultiplier: 1,
      presentation: p("Common", "Teaching content"),
    },
  ],
  terminology: [starterTerminology],
  defaultTerminologyId: starterTerminology.id,
  definitions: [
    {
      id: "starter:value",
      category: "playable-object",
      tags: ["value"],
      presentation: p(
        "Generated value",
        "A module-owned deterministic option.",
      ),
      baseValues: { value: 1 },
      gameplay: { kind: "choice" },
    },
    {
      id: "starter:steady",
      category: "passive-modifier",
      tags: ["talent"],
      rarity: "starter:common",
      basePrice: 4,
      presentation: p(
        "Steady start",
        "Adds two whenever the module reports a choice.",
      ),
      triggers: [
        {
          id: "choice-bonus",
          event: "starter:value-chosen",
          stage: "additive",
          operations: [
            {
              type: "add-score",
              amount: { from: "constant", value: 2 },
              label: "Steady start",
            },
          ],
        },
      ],
    },
    {
      id: "starter:bold",
      category: "passive-modifier",
      tags: ["talent"],
      rarity: "starter:common",
      basePrice: 5,
      presentation: p(
        "Bold finish",
        "Adds three to the final score through the generic effect vocabulary.",
      ),
      triggers: [
        {
          id: "score-bonus",
          event: "score",
          stage: "additive",
          operations: [
            {
              type: "add-score",
              amount: { from: "constant", value: 3 },
              label: "Bold finish",
            },
          ],
        },
      ],
    },
    {
      id: "starter:pulse",
      category: "consumable",
      tags: ["boost"],
      rarity: "starter:common",
      basePrice: 3,
      presentation: p("Score pulse", "Adds five during the next challenge."),
      legalPhases: ["encounter-ready", "shop"],
      operation: "effect",
      triggers: [
        {
          id: "pulse-score",
          event: "score",
          stage: "additive",
          operations: [
            {
              type: "add-score",
              amount: { from: "constant", value: 5 },
              label: "Score pulse",
            },
          ],
        },
      ],
    },
    {
      id: "starter:tagger",
      category: "consumable",
      tags: ["boost"],
      rarity: "starter:common",
      basePrice: 2,
      presentation: p("Focus tag", "Adds a run tag using a generic effect."),
      legalPhases: ["encounter-ready", "shop"],
      operation: "effect",
      triggers: [
        {
          id: "tag-run",
          event: "score",
          operations: [
            {
              type: "tag",
              action: "add",
              target: "encounter",
              tag: "focused",
              lifetime: "encounter",
            },
          ],
        },
      ],
    },
    {
      id: "starter:polished",
      category: "attached-modifier",
      tags: ["finish"],
      rarity: "starter:common",
      basePrice: 3,
      presentation: p("Polished", "A finish attachable to a talent."),
      hostCategories: ["passive-modifier"],
      slot: "starter:finish",
      occupiesInventory: false,
      triggers: [
        {
          id: "polished-score",
          event: "score",
          stage: "additive",
          operations: [
            {
              type: "add-score",
              amount: { from: "constant", value: 1 },
              label: "Polished",
            },
          ],
        },
      ],
    },
    {
      id: "starter:roomy-kit",
      category: "run-upgrade",
      tags: ["upgrade"],
      rarity: "starter:common",
      basePrice: 6,
      presentation: p("Roomy kit", "Adds one talent slot."),
      changes: { "capacity:passive-modifier": 1 },
    },
    {
      id: "starter:currency-reward",
      category: "reward-container",
      tags: ["reward"],
      presentation: p(
        "Token reward",
        "Awards tokens through the run reward policy.",
      ),
      rewardType: "currency",
      currency: 5,
    },
    {
      id: "starter:choice-reward",
      category: "reward-container",
      tags: ["reward"],
      presentation: p("Choice reward", "Select from the authored pool."),
      rewardType: "choice",
      choiceCount: 2,
      poolId: "starter:main-pool",
    },
    {
      id: "starter:standard",
      category: "encounter",
      tags: ["ordinary"],
      presentation: p("Standard challenge", "A regular choice challenge."),
      targetBase: 15,
      playableObjectIds: ["starter:value"],
      rewardContainerIds: ["starter:currency-reward", "starter:choice-reward"],
    },
    {
      id: "starter:last-step",
      category: "special-encounter-rule",
      tags: ["special"],
      presentation: p("Last step", "Marks the fourth challenge as special."),
      severity: 1,
    },
    {
      id: "starter:main-pool",
      category: "shop-pool",
      tags: ["shop"],
      presentation: p("Workshop pool", "All purchasable starter content."),
      allowDuplicates: false,
      entries: [
        "starter:bold",
        "starter:pulse",
        "starter:tagger",
        "starter:polished",
        "starter:roomy-kit",
      ].map((definitionId) => ({ definitionId, weight: 1 })),
    },
    {
      id: "starter:balanced",
      category: "starting-loadout",
      tags: ["loadout"],
      presentation: p(
        "Balanced kit",
        "Starts with a signal-reactive talent and a boost.",
      ),
      currency: 12,
      ownedDefinitionIds: ["starter:steady", "starter:pulse"],
      capacities: {
        "passive-modifier": 3,
        consumable: 2,
        "attached-modifier": 2,
      },
      upgradeIds: [],
    },
  ],
};

export const starterContentRegistry = new ContentRegistry(starterContentPack);
export const starterContentProvider = createRuntimeContentProvider(
  starterContentRegistry,
);
export const starterShopProviders = createShopPoolProviders(
  starterContentRegistry,
);

/**
 * Versioned escape-hatch example. Banking module-local history cannot be
 * expressed as a generic run operation; a real game registers this only when
 * its module owns the corresponding state contract.
 */
export const starterCustomEffect = {
  id: "starter:bank-last-choice",
  version: 1,
} as const;
