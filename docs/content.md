# Content packs and terminology

`@core-loop/content` is the headless authoring and loading boundary for reusable game content. A `ContentPack` declares a stable namespaced ID, integer content/schema versions, metadata, rarities, definitions, terminology packs, and a default terminology. Authored values are JSON-compatible: effects contain data, never callbacks or Phaser objects.

## Definitions, instances, and IDs

Definitions are immutable authored facts. The registry clones and deeply freezes a successfully validated pack. IDs use `namespace:stable-name`; display names are never identity. IDs are globally unique within a pack, including across categories. `ContentRegistry.get`, `getAs`, `byCategory`, `byTag`, and `byGroup` retain authored order as canonical deterministic ordering. Optional namespaced `groups` classify content into authored families without adding theme-specific categories to the framework; for example, two games can each define different families of consumables.

Instances contain only run state: instance ID, definition ID, stored values, disabled/expiry state, temporary tags, attachment relationships, and transformation history. `createInstance` increments a caller-owned counter. Definitions remain outside saves. Categories are playable object, passive modifier, consumable, attached modifier, run upgrade, reward container, encounter, special encounter rule, shop pool, and starting loadout. Playable-object `gameplay` payloads are namespaced serialisable data core does not interpret.

## Validation, availability, rarity, and pools

Constructing a `ContentRegistry` validates first and throws one `ContentValidationError` containing all errors. Errors identify pack, definition/category, property path, reason, and safe offending value. Validation covers IDs, duplicates, tags, finite prices/weights, rarities, typed references, attachment hosts, transformations, loadouts, pools, terminology, trigger shapes, and custom handler IDs.

```bash
npm run content:validate
```

Availability may restrict encounter range/kind, tags, owned content, copy count, and gameplay capabilities. Hosts filter availability before weighted selection. Empty eligible pools produce explicit diagnostics without looping or consuming RNG. Rarity IDs are stable authored IDs with default weights, presentation, and price multipliers—not English logic branches. `selectWeighted` consumes exactly one RNG value after filtering.

## Attachments, duplication, and transformation

Hosts have counted attachment capacity (one by default). Attachments have independent IDs, point to their host, and are ordered on the host. An attachment may declare a namespaced exclusive `slot`; a host can carry attachments in different slots but never two in the same slot. This supports independent, stackable layers such as a playable object's finish, mark, and tuning without putting those theme-specific concepts in core. Shipped attachments do not consume ordinary inventory. Detach clears both sides. Incompatible, full, and same-slot hosts reject attachment.

Together, the generic primitives cover familiar run-builder content without hard-coding another game's vocabulary:

- consumable categories plus `groups` represent separate consumable families;
- authored rarity IDs, weights, presentation, and price multipliers represent rarity tiers for passive modifiers or any other definition;
- attached modifiers with exclusive slots represent independent edition-, seal-, and enhancement-like layers;
- transformation supports replacing a definition while preserving instance identity, while attachments support additive alterations that remain separate content instances.

Threshold Lab exercises these contracts with two technique groups and three attachment slots (`finish`, `mark`, and `tuning`) on playable objects.

Duplication creates a fresh deterministic ID, copies stored values/history, clears temporary/disabled/expiry state, and does not copy attachments. Unique definitions reject duplication. Transformation preserves the instance ID, resets stored values to target defaults, clears disabled/expiry, records the former definition, and retains only compatible attachments; incompatible children become detached inventory.

## Rewards, shops, loadouts, and saves

Reward containers describe three interactions: a three-item catalogue choice, fixed currency cache, and targeted attachment. A host generates outcomes with run RNG and must persist explicit choices until selected/skipped; presentation never rerolls them. Pools hold stable references and weights. Four loadouts provide balanced, economy, scaling, and attachment openings. Run upgrades model non-triggering capacity and shop changes.

Saves identify content pack/version, terminology, loadout, definitions, and mutable instances by stable ID. Definition bodies stay external. Missing or incompatible pack versions must reject with a restart message rather than substitute content. Migrations preserve these identities and fail explicitly when an installed pack cannot satisfy them.

## Terminology

Terminology supplies singular/plural and optional short forms for every visible framework concept. Singular is used only for exactly one. Threshold Lab ships Lab terms (`Challenge`, `Relic`, `Trick`, `Tile`, `Finish`, `Coins`) and music terms (`Gig`, `Fan`, `Tool`, `Sample`, `FX`, `Cash`). The app persists only the selected terminology ID; switching does not touch run state or RNG.

## Worked extension

```ts
const definitions = [
  {
    id: "my-game:steady",
    category: "passive-modifier",
    tags: ["score"],
    rarity: "my-game:common",
    basePrice: 8,
    weight: 4,
    presentation: { name: "Steady", description: "Adds 4 score." },
    triggers: [
      {
        id: "score",
        event: "score",
        operations: [
          { type: "add-score", amount: { from: "constant", value: 4 } },
        ],
      },
    ],
  },
  {
    id: "my-game:copy",
    category: "consumable",
    tags: ["copy"],
    presentation: { name: "Copy", description: "Duplicates a modifier." },
    legalPhases: ["shop"],
    operation: "duplicate",
    targetCategories: ["passive-modifier"],
  },
  {
    id: "my-game:glow",
    category: "attached-modifier",
    tags: ["attachment"],
    presentation: { name: "Glow", description: "Adds score." },
    hostCategories: ["passive-modifier"],
    occupiesInventory: false,
  },
  {
    id: "my-game:shop",
    category: "shop-pool",
    tags: ["shop"],
    presentation: { name: "Shop", description: "Main pool." },
    entries: [{ definitionId: "my-game:steady", weight: 4 }],
    allowDuplicates: false,
  },
];
```

Add complete Lab/music terms—including the three categories above—assemble a pack, then call `new ContentRegistry(pack)`. Future games use the same explicit API. Applications compose the pack with their selected gameplay module and the headless simulator exercises the same composition.

## Framework composition

Concrete item names, visual metadata, namespaced rule IDs, and module capability requirements belong here or in an application. `thresholdLabRunConfiguration` adapts Threshold Lab definitions to core's generic `ItemDefinition`/effect contracts. Core receives this immutable configuration through `createRunEngine`; definitions are not copied into `RunState`. A different application supplies a different configuration without editing core.
