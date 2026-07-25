# Documentation index and getting started

Core Loop is a headless, deterministic run framework plus optional Phaser host helpers. It is not a renderer, ECS, backend, account service, multiplayer layer or arbitrary scripting platform.

## Read by task

- [Architecture](architecture.md): boundaries, dependencies, state and deterministic RNG.
- [Run lifecycle, commands and events](run-lifecycle.md): state machine and host responsibilities.
- [Effects](effects.md): triggers, ordering, diagnostics, custom handlers and safety limits.
- [Content](content.md): definitions, instances, registries, terminology and validation.
- [Gameplay modules](gameplay-modules.md): module contract, capabilities and reports.
- [Compatibility and replay](compatibility-and-replay.md): policies, saves, migrations, replay and versioning.
- [Simulation and development tools](simulation-and-devtools.md): headless testing, simulation, content browser and inspector.
- [PWA and deployment](pwa-and-deployment.md): offline/update/audio behaviour and Pages.
- [Starter template](starter-template.md): the maintained minimal application.
- [New-game tutorial](tutorial-new-game.md): clone-to-deploy walkthrough.
- [Development](development.md): commands, phone testing and production gating.
- [Common mistakes](common-mistakes.md) and [release checklist](release-checklist.md).

Node 22 and npm are required. From a clone, run `npm ci`, then `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build:all`.
