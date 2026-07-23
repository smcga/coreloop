# Content packs and terminology

`@core-loop/content` is the headless authoring and loading boundary for reusable game content. A `ContentPack` declares a stable namespaced ID, integer content/schema versions, metadata, rarities, definitions, terminology packs, and a default terminology. Authored values are JSON-compatible: effects contain data, never callbacks or Phaser objects.

## Definitions, instances, and IDs

Definitions are immutable authored facts. The registry clones and deeply freezes a successfully validated pack. IDs use `namespace:stable-name`; display names are never identity. IDs are globally unique within a pack, including across categories. `ContentRegistry.get`, `getAs`, `byCategory`, and `byTag` retain authored order as canonical deterministic ordering.

Instances contain only run state: instance ID, definition ID, stored values, disabled/expiry state, temporary tags, attachment relationships, and transformation history. `createInstance` increments a caller-owned counter. Definitions remain outside saves. Categories are playable object, passive modifier, consumable, attached modifier, run upgrade, reward container, encounter, special encounter rule, shop pool, and starting loadout. Playable-object `gameplay` payloads are namespaced serialisable data core does not interpret.

## Validation, availability, rarity, and pools

Constructing a `ContentRegistry` validates first and throws one `ContentValidationError` containing all errors. Errors identify pack, definition/category, property path, reason, and safe offending value. Validation covers IDs, duplicates, tags, finite prices/weights, rarities, typed references, attachment hosts, transformations, loadouts, pools, terminology, trigger shapes, and custom handler IDs.

```bash
npm run content:validate
```

Availability may restrict encounter range/kind, tags, owned content, copy count, and gameplay capabilities. Hosts filter availability before weighted selection. Empty eligible pools produce explicit diagnostics without looping or consuming RNG. Rarity IDs are stable authored IDs with default weights, presentation, and price multipliers—not English logic branches. `selectWeighted` consumes exactly one RNG value after filtering.

## Attachments, duplication, and transformation

Hosts have counted slots (one by default; selected passives have two). Attachments have independent IDs, point to their host, and are ordered on the host. Shipped attachments do not consume ordinary inventory. Detach clears both sides. Incompatible/full hosts reject attachment.

Duplication creates a fresh deterministic ID, copies stored values/history, clears temporary/disabled/expiry state, and does not copy attachments. Unique definitions reject duplication. Transformation preserves the instance ID, resets stored values to target defaults, clears disabled/expiry, records the former definition, and retains only compatible attachments; incompatible children become detached inventory.

## Rewards, shops, loadouts, and saves

Reward containers describe three interactions: a three-item catalogue choice, fixed currency cache, and targeted attachment. A host generates outcomes with run RNG and must persist explicit choices until selected/skipped; presentation never rerolls them. Pools hold stable references and weights. Four loadouts provide balanced, economy, scaling, and attachment openings. Run upgrades model non-triggering capacity and shop changes.

Saves identify content pack/version, terminology, loadout, definitions, and mutable instances by stable ID. Definition bodies stay external. Missing or incompatible pack versions must reject with a restart message rather than substitute content. General migration remains deferred.

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

Add complete Lab/music terms—including the three categories above—assemble a pack, then call `new ContentRegistry(pack)`. Future games use the same explicit API. The second gameplay module, general migrations, simulation, scripting, and mod marketplace remain deferred to Issue #6 or later.
