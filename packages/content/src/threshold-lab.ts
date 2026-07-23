import type {
  ContentDefinition,
  ContentPack,
  PassiveModifierDefinition,
  TerminologyPack,
} from "./model";
const p = (name: string, description: string) => ({ name, description });
const rarity = (n: number) =>
  n % 7 === 0
    ? ("threshold-lab:rare" as const)
    : n % 3 === 0
      ? ("threshold-lab:uncommon" as const)
      : ("threshold-lab:common" as const);
const modifierSpecs = [
  [
    "cyan-focus",
    "Cyan Focus",
    "Adds 8 score for every cyan object.",
    "cyan",
    8,
  ],
  [
    "amber-focus",
    "Amber Focus",
    "Adds 7 score for every amber object.",
    "amber",
    7,
  ],
  [
    "pair-amplifier",
    "Pair Amplifier",
    "Pairs multiply score by 3/2.",
    "pair",
    0,
  ],
  [
    "sequence-learner",
    "Sequence Learner",
    "Sequences grow its persistent bonus by 3.",
    "scaling",
    3,
  ],
  [
    "first-echo",
    "First Echo",
    "Adds the first selected value again.",
    "retrigger",
    5,
  ],
  ["high-risk", "High Risk", "One fewer action; score is doubled.", "risk", 0],
  [
    "perfect-reward",
    "Perfect Reward",
    "Earn 5 coins when beating the target by 20.",
    "economy",
    5,
  ],
  [
    "steady-growth",
    "Steady Growth",
    "Gains 2 stored score after every success.",
    "scaling",
    2,
  ],
  [
    "diverse-study",
    "Diverse Study",
    "Rewards selections with three different tags.",
    "diversity",
    12,
  ],
  [
    "repeat-tax",
    "Repeat Tax",
    "Large bonus unless a value repeats.",
    "risk",
    15,
  ],
  [
    "shop-scout",
    "Shop Scout",
    "The first reroll each shop costs less.",
    "shop",
    2,
  ],
  [
    "coin-resonator",
    "Coin Resonator",
    "Adds score based on current currency.",
    "economy",
    1,
  ],
  [
    "finish-line",
    "Finish Line",
    "Attached effects add 5 more score.",
    "attachment",
    5,
  ],
  [
    "trick-memory",
    "Trick Memory",
    "Using a consumable grows a stored bonus.",
    "consumable",
    4,
  ],
  [
    "boss-reader",
    "Boss Reader",
    "Adds 18 score during special encounters.",
    "boss",
    18,
  ],
  [
    "low-profile",
    "Low Profile",
    "Common objects add 4 score each.",
    "rarity",
    4,
  ],
  [
    "rare-spark",
    "Rare Spark",
    "Rare owned content multiplies score by 6/5.",
    "rarity",
    0,
  ],
  ["odd-theory", "Odd Theory", "Odd values add 6 score each.", "odd", 6],
  ["even-theory", "Even Theory", "Even values add 6 score each.", "even", 6],
  [
    "target-chaser",
    "Target Chaser",
    "Adds 10 while below target.",
    "target",
    10,
  ],
  [
    "margin-bank",
    "Margin Bank",
    "Stores excess score for later challenges.",
    "scaling",
    2,
  ],
  [
    "last-stand",
    "Last Stand",
    "Multiplies the final action by 3/2.",
    "risk",
    0,
  ],
  ["small-set", "Small Set", "Two-object selections gain 16.", "pattern", 16],
  ["full-bench", "Full Bench", "Full selections gain 20.", "pattern", 20],
  [
    "chain-reactor",
    "Chain Reactor",
    "Emitted scoring signals retrigger once.",
    "retrigger",
    4,
  ],
  [
    "attachment-fund",
    "Attachment Fund",
    "Gain 2 currency when adding an attachment.",
    "attachment",
    2,
  ],
  [
    "transformer",
    "Transformer",
    "Transformations leave a permanent +6 memory.",
    "transform",
    6,
  ],
  [
    "copy-editor",
    "Copy Editor",
    "Duplicated content starts with +5 stored value.",
    "duplicate",
    5,
  ],
  [
    "tight-shelf",
    "Tight Shelf",
    "A full inventory multiplies score by 5/4.",
    "inventory",
    0,
  ],
  [
    "safety-glass",
    "Safety Glass",
    "The first disabling effect each encounter is prevented.",
    "protection",
    0,
  ],
] as const;
const passives: PassiveModifierDefinition[] = modifierSpecs.map(
  ([id, name, description, strategy, amount], i) => ({
    id: `threshold-lab:${id}`,
    category: "passive-modifier",
    tags: ["modifier", `strategy:${strategy}`],
    rarity: rarity(i),
    basePrice: 8 + (i % 12),
    weight: 8 - Math.floor(i / 10),
    presentation: p(name, description),
    attachmentSlots: i % 5 === 0 ? 2 : 1,
    initialStoredValues: strategy === "scaling" ? { bonus: 0 } : undefined,
    triggers:
      amount > 0
        ? [
            {
              id: "score-effect",
              event: "score",
              stage: "additive",
              operations: [
                {
                  type: "add-score",
                  amount: { from: "constant", value: amount },
                  label: name,
                },
              ],
            },
          ]
        : [
            {
              id: "score-effect",
              event: "score",
              stage: "multiplicative",
              operations: [
                {
                  type: "multiply-score",
                  numerator: 5,
                  denominator: 4,
                  label: name,
                },
              ],
            },
          ],
  }),
);
const consumableSpecs = [
  ["score-pulse", "Score Pulse", "Add 15 score this encounter.", "effect"],
  ["tile-refresh", "Object Refresh", "Replace the playable objects.", "effect"],
  [
    "limit-pulse",
    "Allowance Pulse",
    "Gain one action this encounter.",
    "effect",
  ],
  ["coin-cache", "Coin Cache", "Gain 8 currency.", "effect"],
  ["mirror-copy", "Mirror Copy", "Duplicate an owned modifier.", "duplicate"],
  ["phase-shift", "Phase Shift", "Transform an owned modifier.", "transform"],
  ["finish-kit", "Finish Kit", "Create and attach a modifier.", "attach"],
  [
    "rule-dampener",
    "Rule Dampener",
    "Disable the current special rule.",
    "effect",
  ],
  ["value-tuner", "Value Tuner", "Increase a stored value by 5.", "effect"],
  [
    "risky-bet",
    "Risky Bet",
    "Lose 3 currency for a large temporary bonus.",
    "effect",
  ],
] as const;
const consumables: ContentDefinition[] = consumableSpecs.map(
  ([id, name, description, operation], i) => ({
    id: `threshold-lab:${id}`,
    category: "consumable",
    tags: ["consumable", `operation:${operation}`],
    rarity: rarity(i),
    basePrice: 5 + i,
    weight: 5,
    presentation: p(name, description),
    legalPhases: ["encounter-ready", "shop"],
    operation,
    targetCategories:
      operation === "attach"
        ? ["playable-object", "passive-modifier"]
        : operation === "duplicate" || operation === "transform"
          ? ["passive-modifier"]
          : undefined,
    transformationTargets:
      operation === "transform"
        ? ["threshold-lab:cyan-focus", "threshold-lab:steady-growth"]
        : undefined,
  }),
);
const attachmentNames = [
  ["red-finish", "Red Finish", "Adds 6 score."],
  ["blue-finish", "Blue Finish", "Adds the cyan tag."],
  ["gold-finish", "Gold Finish", "Earns 1 currency after success."],
  ["echo-finish", "Echo Finish", "Retriggers its host once."],
  ["growth-finish", "Growth Finish", "Grows a stored bonus each challenge."],
  [
    "glass-finish",
    "Glass Finish",
    "Multiplies score but may disable its host.",
  ],
  ["guard-finish", "Guard Finish", "Protects its host from one disable."],
  ["rare-finish", "Rare Finish", "Raises the host rarity for rewards."],
  ["boss-finish", "Boss Finish", "Adds 10 during special challenges."],
  ["lean-finish", "Lean Finish", "Adds 12 when selecting three or fewer."],
  ["tax-finish", "Tax Finish", "Adds score but raises shop prices."],
  ["prism-finish", "Prism Finish", "Counts as every colour tag."],
] as const;
const attachments: ContentDefinition[] = attachmentNames.map(
  ([id, name, description], i) => ({
    id: `threshold-lab:${id}`,
    category: "attached-modifier",
    tags: ["attachment", i % 2 ? "colour" : "score"],
    rarity: rarity(i),
    basePrice: 7 + i,
    weight: 4,
    presentation: p(name, description),
    hostCategories: ["playable-object", "passive-modifier"],
    occupiesInventory: false,
    initialStoredValues: i === 4 ? { bonus: 0 } : undefined,
    triggers: [
      {
        id: "attachment-score",
        event: "score",
        stage: "additive",
        operations: [
          {
            type: "add-score",
            amount: { from: "constant", value: 3 + i },
            label: name,
          },
        ],
      },
    ],
  }),
);
const specialNames = [
  ["reduced-limit", "Reduced Allowance", "One fewer object may be selected."],
  ["cyan-penalty", "Cyan Leak", "Cyan objects lose 5 score."],
  ["repeat-penalty", "Echo Chamber", "Repeated values lose score."],
  [
    "diversity-check",
    "Diversity Check",
    "Selections need three distinct tags.",
  ],
  ["price-surge", "Price Surge", "The next shop costs more."],
  ["flat-multiplier", "Flattened Results", "Score multipliers are weakened."],
] as const;
const rules: ContentDefinition[] = specialNames.map(
  ([id, name, description], i) => ({
    id: `threshold-lab:${id}`,
    category: "special-encounter-rule",
    tags: ["special-rule"],
    weight: 3,
    rarity: rarity(i),
    presentation: p(name, description),
    severity: 1 + (i % 3),
    triggers: [
      {
        id: "rule-score",
        event: "score",
        stage: "encounter-rule",
        operations: [
          {
            type: "add-score",
            amount: { from: "constant", value: -(2 + i) },
            label: name,
          },
        ],
      },
    ],
  }),
);
const playable: ContentDefinition[] = [1, 2, 3, 4, 5, 6].map((value) => ({
  id: `threshold-lab:object-${value}`,
  category: "playable-object",
  tags: [value % 2 ? "odd" : "even", value % 3 ? "cyan" : "amber"],
  rarity: "threshold-lab:common",
  weight: 1,
  presentation: p(`Object ${value}`, `A base-value ${value} playable object.`),
  baseValues: { value },
  compatibleAttachmentTags: ["attachment"],
  gameplay: { "threshold-lab": { value } },
}));
const loadouts: ContentDefinition[] = [
  [
    "balanced",
    "Balanced",
    "threshold-lab:cyan-focus",
    "threshold-lab:score-pulse",
    10,
  ],
  [
    "economy",
    "Compound Interest",
    "threshold-lab:perfect-reward",
    "threshold-lab:coin-cache",
    16,
  ],
  [
    "scaling",
    "Long Study",
    "threshold-lab:sequence-learner",
    "threshold-lab:value-tuner",
    8,
  ],
  [
    "attachments",
    "Finish Workshop",
    "threshold-lab:finish-line",
    "threshold-lab:finish-kit",
    9,
  ],
].map(([id, name, mod, tool, currency]) => ({
  id: `threshold-lab:starter-${id}`,
  category: "starting-loadout",
  tags: ["starter"],
  presentation: p(String(name), `${name} opening strategy.`),
  currency: Number(currency),
  ownedDefinitionIds: [String(mod), String(tool)],
  capacities: { "passive-modifier": 4, consumable: 2, "attached-modifier": 3 },
  upgradeIds: [],
}));
const rewardIds = ["draft", "currency-cache", "workshop"];
const rewards: ContentDefinition[] = rewardIds.map((id, i) => ({
  id: `threshold-lab:reward-${id}`,
  category: "reward-container",
  tags: ["reward"],
  presentation: p(
    i === 0 ? "Research Draft" : i === 1 ? "Coin Cache" : "Finish Workshop",
    i === 0
      ? "Choose one of three content items."
      : i === 1
        ? "Receive a deterministic currency reward."
        : "Choose a host for a new attachment.",
  ),
  rewardType: i === 0 ? "choice" : i === 1 ? "currency" : "targeted",
  choiceCount: i === 0 ? 3 : undefined,
  currency: i === 1 ? 10 : undefined,
  poolId: i === 0 ? "threshold-lab:main-pool" : undefined,
  targetOperation: i === 2 ? "attach" : undefined,
}));
const poolEntries = [...passives, ...consumables, ...attachments].map((d) => ({
  definitionId: d.id,
  weight: d.weight ?? 1,
}));
const utility: ContentDefinition[] = [
  {
    id: "threshold-lab:capacity-study",
    category: "run-upgrade",
    tags: ["upgrade"],
    rarity: "threshold-lab:uncommon",
    basePrice: 15,
    presentation: p("Capacity Study", "Adds one passive-modifier slot."),
    changes: { "capacity:passive-modifier": 1 },
  },
  {
    id: "threshold-lab:shop-study",
    category: "run-upgrade",
    tags: ["upgrade"],
    rarity: "threshold-lab:rare",
    basePrice: 18,
    presentation: p("Shop Study", "Reduces reroll price by 2."),
    changes: { rerollPrice: -2 },
  },
  {
    id: "threshold-lab:main-pool",
    category: "shop-pool",
    tags: ["shop"],
    presentation: p("Main Catalogue", "Weighted general shop catalogue."),
    entries: poolEntries,
    allowDuplicates: false,
    categories: ["passive-modifier", "consumable", "attached-modifier"],
  },
  {
    id: "threshold-lab:six-challenge-run",
    category: "encounter",
    tags: ["encounter"],
    presentation: p(
      "Threshold Series",
      "Six deterministic escalating challenges.",
    ),
    targetBase: 45,
    playableObjectIds: playable.map((d) => d.id),
    specialRuleIds: rules.map((d) => d.id),
    rewardContainerIds: rewards.map((d) => d.id),
  },
];
const makeTerms = (id: string, words: readonly string[]): TerminologyPack => ({
  id,
  terms: Object.fromEntries(
    [
      "run",
      "stage",
      "encounter",
      "special-encounter",
      "playable-object",
      "passive-modifier",
      "consumable",
      "attached-modifier",
      "run-upgrade",
      "reward-container",
      "shop",
      "currency",
      "score",
      "target",
      "inventory",
      "reroll",
      "buy",
      "sell",
    ].map((key, i) => [key, { singular: words[i]!, plural: words[i + 18]! }]),
  ) as TerminologyPack["terms"],
});
const labSing = [
    "Run",
    "Stage",
    "Challenge",
    "Special Challenge",
    "Tile",
    "Relic",
    "Trick",
    "Finish",
    "Study",
    "Reward",
    "Shop",
    "Coin",
    "Score",
    "Target",
    "Inventory",
    "Reroll",
    "Buy",
    "Sell",
  ],
  labPlural = [
    "Runs",
    "Stages",
    "Challenges",
    "Special Challenges",
    "Tiles",
    "Relics",
    "Tricks",
    "Finishes",
    "Studies",
    "Rewards",
    "Shops",
    "Coins",
    "Score",
    "Targets",
    "Inventories",
    "Rerolls",
    "Buy",
    "Sell",
  ],
  musicSing = [
    "Tour",
    "Set",
    "Gig",
    "Headline Gig",
    "Sample",
    "Fan",
    "Tool",
    "FX",
    "Upgrade",
    "Drop",
    "Merch Table",
    "Cash",
    "Hype",
    "Goal",
    "Kit",
    "Remix",
    "Grab",
    "Trade",
  ],
  musicPlural = [
    "Tours",
    "Sets",
    "Gigs",
    "Headline Gigs",
    "Samples",
    "Fans",
    "Tools",
    "FX",
    "Upgrades",
    "Drops",
    "Merch Tables",
    "Cash",
    "Hype",
    "Goals",
    "Kits",
    "Remixes",
    "Grab",
    "Trade",
  ];
export const thresholdLabContentPack: ContentPack = {
  id: "threshold-lab:core",
  version: 3,
  schemaVersion: 1,
  metadata: p(
    "Threshold Lab Core",
    "The complete reusable Threshold Lab content catalogue.",
  ),
  tags: ["shipped"],
  capabilities: ["numeric-values", "tags", "attachments"],
  rarities: [
    {
      id: "threshold-lab:common",
      defaultWeight: 6,
      priceMultiplier: 1,
      presentation: p("Common", "Frequently offered content."),
    },
    {
      id: "threshold-lab:uncommon",
      defaultWeight: 3,
      priceMultiplier: 1.2,
      presentation: p("Uncommon", "Specialised content."),
    },
    {
      id: "threshold-lab:rare",
      defaultWeight: 1,
      priceMultiplier: 1.5,
      presentation: p("Rare", "Build-defining content."),
    },
  ],
  definitions: [
    ...playable,
    ...passives,
    ...consumables,
    ...attachments,
    ...rules,
    ...loadouts,
    ...rewards,
    ...utility,
  ],
  terminology: [
    makeTerms("threshold-lab:lab-terms", [...labSing, ...labPlural]),
    makeTerms("threshold-lab:music-terms", [...musicSing, ...musicPlural]),
  ],
  defaultTerminologyId: "threshold-lab:lab-terms",
};
