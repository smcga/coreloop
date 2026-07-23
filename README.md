# Core Loop

Core Loop is a mobile-first TypeScript framework for building run-based score-challenge games with replaceable encounter gameplay.

The framework is intended for games that share a broad structure:

1. enter an encounter with a target;
2. play game-specific mechanics to produce score and signals;
3. win rewards or end the run;
4. visit shops and improve a build;
5. face periodic special encounters with altered rules.

The encounter itself is deliberately replaceable. A future game might build a song, play football, solve a timing challenge or use another mechanic entirely while reusing the surrounding run, economy, shop, modifier and progression systems.

## Quick start

Prerequisites: Node.js 22 (see `.nvmrc`) and npm.

```bash
npm install
npm run dev
```

Threshold Lab is served by Vite. The production build uses the `/coreloop/` base path and is deployed to [GitHub Pages](https://smcga.github.io/coreloop/) after changes reach `main`.

Run the complete repository verification suite with:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

### Test on a phone

Connect the phone and development computer to the same trusted network, then run:

```bash
npm run dev -- --host
```

Open Vite's displayed network URL on the phone. Play a complete seeded six-encounter run in portrait and landscape, including shops, a purchase, a reroll, special encounters, and refresh/continue. No interaction requires hover, and the page prevents scrolling during play.

## Workspace

- `packages/core` — browser-independent deterministic command/event run engine.
- `packages/content` — validated headless content packs, terminology, registries, and instance lifecycle helpers.
- `packages/phaser` — shared Phaser-facing integration helpers.
- `packages/testing` — future reusable scenario-test helpers.
- `apps/threshold-lab` — the playable Phaser test-bed with Combination Grid and Timing Meter modules.

## Seeded runs and diagnostics

Starting an experiment creates and displays a numeric run seed. The engine uses that seed for the entire encounter schedule; the same seed and command sequence reproduce the same generated tiles. Threshold Lab's small **Debug** button shows recent commands, ordered events, reports, and phase transitions without replacing the player-facing result display.

## Project status

The 0.2 Generic Systems implementation is demonstrated in the touch-first **Threshold Lab** test-bed: players choose Combination Grid or Timing Meter while sharing the deterministic six-encounter run, shops, effects, content, terminology, and browser save/resume.

- [Phase 1 tracker: 0.1 Playable Spine](https://github.com/smcga/coreloop/issues/10)
- [Phase 2 tracker: 0.2 Generic Systems](https://github.com/smcga/coreloop/issues/11)
- [Phase 3 tracker: 1.0 Starter Kit](https://github.com/smcga/coreloop/issues/12)
- [First implementation issue](https://github.com/smcga/coreloop/issues/1)

## Intended stack

- strict TypeScript
- npm workspaces
- Vite
- Phaser
- Vitest
- static web deployment, progressing to a PWA

The headless framework packages must not depend on Phaser, the DOM or browser storage.

## Documentation

- [`AGENTS.md`](AGENTS.md) — instructions and constraints for coding agents
- [`docs/architecture.md`](docs/architecture.md) — boundaries and core design
- [`docs/threshold-lab.md`](docs/threshold-lab.md) — playable test-bed specification
- [`docs/development.md`](docs/development.md) — expected development and verification workflow
- [`docs/effects.md`](docs/effects.md) — deterministic triggers, operations, chaining, and score ledger
- [`docs/gameplay-modules.md`](docs/gameplay-modules.md) — replaceable gameplay contract, capabilities, saves, and deterministic actions
- [`docs/content.md`](docs/content.md) — content packs, validation, instances, attachments, rewards, and terminology
- [`docs/issue-1-brief.md`](docs/issue-1-brief.md) — concrete implementation brief for the first issue
- [`docs/roadmap.md`](docs/roadmap.md) — release progression

## Guiding rule

Every substantial framework change must produce a visible improvement in a playable test-bed during the same delivery phase. Core Loop should not accumulate speculative abstractions that cannot yet be exercised by a game.
