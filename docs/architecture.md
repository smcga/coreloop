# Core Loop architecture

## Purpose

Core Loop is a framework for games that repeatedly alternate between game-specific encounters and reusable run-level systems.

```text
prepare encounter
→ play game-specific mechanics
→ submit score, metrics and signals
→ resolve win/loss and modifiers
→ grant rewards
→ visit shop or reward screen
→ advance to the next encounter
```

The framework is intentionally narrower than a general-purpose game engine. It does not attempt to own physics, rendering, animation, audio, pathfinding or the detailed mechanics inside an encounter.

## Core boundary

The reusable framework owns:

- run lifecycle and phases;
- encounter scheduling;
- target calculation;
- score and result resolution;
- currency and rewards;
- inventory and shops;
- passive modifiers and consumables;
- special encounter rules;
- deterministic randomness;
- serialisable state;
- commands, events and diagnostic ledgers.

A gameplay module owns:

- encounter-specific state;
- player actions during the encounter;
- its own scoring inputs;
- game-specific simulation;
- presentation of its mechanics;
- production of generic signals and a final encounter report.

The Phaser host owns:

- scenes and transitions;
- input and touch controls;
- rendering and animation;
- audio;
- browser integration;
- visualisation of framework events.

## Dependency direction

```text
apps/threshold-lab
        ↓
packages/phaser       Combination Grid | Timing Meter
        ↓                    ↓
packages/content ───→ gameplay-module contract
                             ↓
                        packages/core
        ↑
packages/testing (test-only helpers)
```

Required rules:

- `packages/core` imports no other application or presentation package.
- `packages/content` may depend on core types, but not Phaser.
- `packages/phaser` may depend on core and content.
- applications compose packages and provide concrete gameplay modules.
- game-specific modules must not become dependencies of core.

Core owns only the `RuntimeContentProvider` contract, generic runtime definitions, loadouts, and serialisable instances. `packages/content` owns authored definitions and the validated registry adapter. Consequently run state contains stable definition IDs and mutable instance data, never names, descriptions, artwork, or the authored definition bodies.

Locale presentation is selected independently by the application. Gameplay modules expose stable IDs and capabilities but no display metadata; locale packs resolve module, content, rule, track and action IDs into words. See [Presentation and localisation](presentation-and-localisation.md).

## Command and event model

The 0.1 lifecycle is `start-run` → `start-encounter` → `submit-encounter` → `enter-shop` → shop commands → `leave-shop`. Submission either moves immediately to run failure or awards currency; the sixth win completes the run. Invalid phase/command combinations preserve the existing state and emit a typed `command-rejected` event.

Framework state changes should pass through a small command API.

Illustrative commands:

```ts
type RunCommand =
  | { type: "start-run"; seed: number; loadoutId: string }
  | { type: "start-encounter" }
  | { type: "submit-signal"; signal: GameplaySignal }
  | { type: "complete-encounter"; report: EncounterReport }
  | { type: "buy-offer"; offerId: string }
  | { type: "reroll-shop" }
  | { type: "use-consumable"; instanceId: string }
  | { type: "advance" };
```

An engine transition returns state plus events:

```ts
interface TransitionResult {
  readonly state: RunState;
  readonly events: readonly RunEvent[];
}
```

Presentation may animate events, but events are not the source of truth. The returned `RunState` is authoritative.

Use discriminated unions and exhaustive switches so unhandled commands or events fail during development.

## State discipline

Prefer treating state as immutable at framework boundaries. Internal implementation may use carefully contained mutation where it materially simplifies effect resolution, but a completed command must return a coherent state snapshot.

Never expose partially resolved state to presentation or saving.

A command must either:

- complete successfully and return a new state plus events; or
- return a defined rejection/error event without corrupting state.

## Deterministic randomness

All randomness that affects gameplay, content offers, encounters or future state must use a run-scoped deterministic generator.

Requirements:

- its complete state is serialisable;
- identical starting state and command sequence produce identical results;
- helpers such as weighted choice and shuffle use the same generator;
- tests can supply fixed seeds;
- framework code and game modules do not call `Math.random()` for outcomes.

Visual-only variation may use a separate non-authoritative source, provided it cannot affect rules or saved state.

The run engine uses an explicitly implemented **Mulberry32** generator. Its unsigned 32-bit state is stored on `RunState`, every generated tile value and tag advances that state, and fixed test vectors protect replay compatibility. Mulberry32 is suitable here for fast deterministic game logic, not cryptography.

## Gameplay-module contract

The formal contract, registry, capability model, state envelope, deterministic Timing Meter representation, and third-module example are documented in [`gameplay-modules.md`](gameplay-modules.md).

The exact API will evolve through the playable test-bed, but a module will eventually need to provide equivalents of:

```ts
interface GameplayModule<TState> {
  readonly id: string;
  initialiseEncounter(brief: EncounterBrief, seed: number): TState;
  handleAction(
    state: Readonly<TState>,
    action: GameplayAction,
  ): GameplayResult<TState>;
  getProgress(state: Readonly<TState>): EncounterProgress;
  createReport(state: Readonly<TState>): EncounterReport;
  serialise(state: Readonly<TState>): unknown;
  deserialise(value: unknown): TState;
}
```

Do not freeze this interface before Threshold Lab needs it. Issue #2 introduces the first real encounter-report boundary; Issue #6 proves it with a second module.

## Signals and reports

A gameplay signal reports something that occurred during an encounter without exposing theme-specific classes to core.

```ts
interface GameplaySignal {
  readonly type: string;
  readonly sourceId?: string;
  readonly tags: readonly string[];
  readonly values: Readonly<Record<string, number>>;
}
```

A final encounter report summarises the result:

```ts
interface EncounterReport {
  readonly score: number;
  readonly tags: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
}
```

The framework can react to signals and reports through generic tags, values and registered handlers. It must not inspect music-, football- or tile-specific object types.

Threshold Lab calculates base and pattern scores in its gameplay module and submits only the generic final report. Core compares its final score with the prepared target; it does not understand selected tiles, pairs, sequences, or matching-tag rules.

## Content definitions and instances

Content definitions are immutable descriptions with stable IDs. Instances are mutable copies belonging to one run.

```text
ModifierDefinition
  id, tags, rarity, base price, trigger/effect data

ModifierInstance
  instance ID, definition ID, stored values, disabled state, expiry
```

This distinction supports duplication, scaling values, attachments, transformation and save compatibility.

## 0.1 inventory, shops, and effects

Shops are generated as three unique offers by weighted selection through the run RNG. Offer and instance counters are stored in the run, so IDs remain stable across saving. A legal reroll spends its displayed price, generates all offers as one transition, and raises the next price by two. Rejected purchases and rerolls return the original state object and do not advance RNG or spend currency.

The deliberately small typed dispatcher resolves 0.1 effects in this documented order:

1. the gameplay module's base and pattern score;
2. additive passives (tag bonus, echo, learned bonus);
3. multiplicative passives (pair amplifier, high risk);
4. temporary consumable bonus;
5. special-encounter penalty;
6. final score and post-result currency effects.

Consumables may be used only during `encounter-ready`. A successful use applies its encounter-local field or deterministic tile refresh and removes the instance; rejection leaves it untouched. Encounter-local effects disappear when the next brief is prepared.

## Browser persistence boundary

Core provides validation and a versioned JSON envelope but never accesses storage. Threshold Lab's `RunSaveStore` is a replaceable adapter over the minimal `getItem`/`setItem`/`removeItem` interface and currently receives `localStorage`.

```ts
interface SaveFile {
  formatVersion: 1;
  frameworkVersion: string;
  contentVersion: number;
  savedAt: string;
  run: RunState;
}
```

The complete authoritative state includes phase, RNG, encounter, inventory stored values, offers, and stable-ID counters. The app autosaves only after `handle` returns a successful completed transition. Rejected commands are not saved. On load, malformed or incompatible format/content versions are ignored; the menu offers Continue, New Run, and Delete Save. Abandon clears the browser save. Save migrations, replay compatibility across content releases, and IndexedDB are deliberately deferred.

## Terminology

Internal names remain generic. Theme-specific nouns are presentation data.

Examples:

| Generic concept   | Music theme | Possible football theme |
| ----------------- | ----------- | ----------------------- |
| encounter         | gig         | match                   |
| passive modifier  | fan         | supporter               |
| playable object   | sample      | player/action           |
| consumable        | tool        | tactic                  |
| attached modifier | FX          | training/trait          |

Do not rename internal types for each theme.

## Test-bed-driven evolution

Threshold Lab is not disposable scaffolding. It is the executable proof of the framework.

Every new abstraction should answer:

1. Which concrete Threshold Lab behaviour requires this?
2. How can a human see that it works?
3. How can a headless test prove it deterministically?
4. Does it introduce assumptions that a different gameplay module would reject?

If there is no current consumer, defer the abstraction.

## Explicit non-goals for the initial roadmap

- porting SoundDealer or FootballGame;
- sharing code across C# and TypeScript;
- a full entity-component system;
- React-based game UI;
- multiplayer or servers;
- native app-store wrappers;
- arbitrary user scripts;
- a visual effect editor;
- a general-purpose engine replacing Phaser.

## 0.2 effect pipeline

The bespoke 0.1 score dispatcher has been replaced by the typed deterministic trigger/effect runtime documented in [`effects.md`](effects.md). The latest encounter’s structured ledger is authoritative for score presentation.

## Current encounter boundary

`EncounterBrief` is framework-only: ID, ordinal, target, `RuleReference[]`, and `moduleSeed`. Core advances the run RNG once to derive that seed; a module starts a private deterministic generator from it. Module creation cannot mutate the run RNG, and rejected module actions never reach core. The opaque `GameplaySessionState` envelope records module ID/version, encounter ID, and validated JSON. Core stores that envelope but never reads `data`.

Concrete rules are scheduled by application composition. Core persists and announces references; the selected module interprets mechanic rules, generic policies/effects interpret run-level rules, and the application owns prose. `createRunEngine` receives immutable definitions and scheduling/reward hooks without a global registry.

## Internal subsystem ownership

The public `engine.ts` module is intentionally a compatibility facade. Its implementation is composed from internal domain modules; applications must continue to import the package root rather than these paths.

```text
engine facade → run reducer → encounter preparation
                         ├── economy inventory/acquisition helpers
                         └── effect runtime transaction adapter → effect interpreter
```

- **Run** owns public state/command/event shapes, phase validation, atomic command rejection, transition assembly, and ordered event sequencing. Add a new command and its orchestration in `run/reducer.ts`; keep the domain algorithm in the subsystem that owns it.
- **Encounters** own gameplay-neutral brief preparation, requirements, report validation/resolution, and encounter cleanup. New app mechanics do not belong here: they remain behind the gameplay-module contract.
- **Economy** owns inventory capacity/counting, acquisition and attachment compatibility, upgrades, sales, reward acquisition, and deterministic shop candidates/prices. Shop and reward entry points must share the same acquisition rules.
- **Effects** own the adapter that batches lifecycle signals, translates run state to effect runtime state, copies the result back, and records diagnostics and score ledgers. The generic interpreter remains independent.

A command is handled as one transaction: the reducer validates phase and shape, delegates to a domain operation, assembles the next immutable snapshot and event facts, and finally assigns event sequence numbers. A rejected command returns the original state object; it must not consume RNG values, counters, or currency. Dependency direction is inward from the facade and reducer to domain helpers. Domain helpers never import applications, Phaser/presentation, concrete content packs, or game-specific modules, and they never call back into the reducer.

### Compatibility fixtures and intentional changes

The internal run contracts live in `run/contracts.ts`; the public engine facade remains the only supported application import. `run/reducer.ts` validates engine composition and orchestrates atomic command/effect sequencing, while `run/lifecycle.ts` owns command dispatch and lifecycle transition assembly. `effects/transaction.ts` is the sole adapter between authoritative run snapshots and the low-level effect interpreter, including report validation, FIFO signal processing, runtime-state projection, and score-ledger construction.

Golden deterministic fixtures are compatibility contracts, not snapshots to refresh during refactors. When a deliberate breaking change affects RNG state, ordered events, ledgers, saves, replay hashes, or fixed-seed simulation output, document the reason and migration impact in its own issue, review the old and new vectors, and update the fixture only alongside that explicit behavioural change.
