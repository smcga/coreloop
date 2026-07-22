# Core Loop

Core Loop is a mobile-first TypeScript framework for building run-based score-challenge games with replaceable encounter gameplay.

The framework is intended for games that share a broad structure:

1. enter an encounter with a target;
2. play game-specific mechanics to produce score and signals;
3. win rewards or end the run;
4. visit shops and improve a build;
5. face periodic special encounters with altered rules.

The encounter itself is deliberately replaceable. A future game might build a song, play football, solve a timing challenge or use another mechanic entirely while reusing the surrounding run, economy, shop, modifier and progression systems.

## Project status

The repository is at the planning and bootstrap stage. Development starts with a small touch-first test-bed called **Threshold Lab** so every framework addition can be verified in a playable browser build.

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
- [`docs/issue-1-brief.md`](docs/issue-1-brief.md) — concrete implementation brief for the first issue
- [`docs/roadmap.md`](docs/roadmap.md) — release progression

## Guiding rule

Every substantial framework change must produce a visible improvement in a playable test-bed during the same delivery phase. Core Loop should not accumulate speculative abstractions that cannot yet be exercised by a game.
