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
packages/phaser       gameplay module
        ↓                    ↓
packages/content ─────→ packages/core
        ↑
packages/testing (test-only helpers)
```

Required rules:

- `packages/core` imports no other application or presentation package.
- `packages/content` may depend on core types, but not Phaser.
- `packages/phaser` may depend on core and content.
- applications compose packages and provide concrete gameplay modules.
- game-specific modules must not become dependencies of core.

## Command and event model

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

## Gameplay-module contract

The exact API will evolve through the playable test-bed, but a module will eventually need to provide equivalents of:

```ts
interface GameplayModule<TState> {
  readonly id: string;
  initialiseEncounter(brief: EncounterBrief, seed: number): TState;
  handleAction(state: Readonly<TState>, action: GameplayAction): GameplayResult<TState>;
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

## Content definitions and instances

Content definitions are immutable descriptions with stable IDs. Instances are mutable copies belonging to one run.

```text
ModifierDefinition
  id, tags, rarity, base price, trigger/effect data

ModifierInstance
  instance ID, definition ID, stored values, disabled state, expiry
```

This distinction supports duplication, scaling values, attachments, transformation and save compatibility.

The first release may use typed handlers for its small content set. The generic trigger/effect representation arrives in Phase 2.

## Terminology

Internal names remain generic. Theme-specific nouns are presentation data.

Examples:

| Generic concept | Music theme | Possible football theme |
|---|---|---|
| encounter | gig | match |
| passive modifier | fan | supporter |
| playable object | sample | player/action |
| consumable | tool | tactic |
| attached modifier | FX | training/trait |

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
