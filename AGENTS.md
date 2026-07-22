# AGENTS.md

This file is the primary repository guidance for coding agents working on Core Loop.

## Mission

Build a mobile-first TypeScript framework for run-based score-challenge games. The framework owns the surrounding run loop—progression, encounters, targets, rewards, economy, shops, persistent modifiers, special rules and saving—while individual games supply their own encounter mechanics.

Threshold Lab is the permanent playable test-bed. Every substantial framework feature must be demonstrated there, or in another explicitly requested test module, within the same issue.

## Read before changing code

1. Read the assigned GitHub issue completely.
2. Read `README.md` and the relevant files in `docs/`.
3. Inspect the existing workspace and scripts before assuming paths or commands.
4. Check the issue dependencies and avoid implementing later-phase systems early.

For Issue #1, also follow `docs/issue-1-brief.md`.

## Non-negotiable architecture

- `packages/core` is headless TypeScript. It must not import Phaser, DOM APIs, browser storage, audio APIs or rendering types.
- Framework rules are command-driven. Presentation sends commands and renders the returned state/events.
- Phaser scenes and UI code must not directly mutate framework-owned run state.
- Randomness affecting a run must come from a serialisable, run-scoped deterministic RNG. Do not use `Math.random()` for framework or gameplay outcomes.
- Keep immutable content definitions separate from mutable run instances.
- Generic framework terminology must not contain theme-specific nouns such as card, joker, fan, sample, footballer or gig.
- Game-specific encounter mechanics must stay outside `packages/core`.
- Do not add React, a full ECS, multiplayer, native wrappers, arbitrary scripting or a visual editor unless an issue explicitly asks for them.
- Prefer the smallest abstraction that supports the current issue and its playable proof.

## Intended workspace

```text
packages/
  core/       Headless run rules and state transitions
  content/    Content definitions, loading and validation
  phaser/     Optional Phaser-facing adapters and shared presentation helpers
  testing/    Scenario and test helpers
apps/
  threshold-lab/  Touch-first playable framework test-bed
```

Later issues may add more apps or packages. Do not create speculative packages without a concrete consumer.

## Technical defaults

Unless the issue or existing repository says otherwise:

- TypeScript is strict.
- Use npm workspaces.
- Use Vite for browser development and builds.
- Use Phaser for game presentation.
- Use Vitest for unit and scenario tests.
- Keep formatting and lint rules automated.
- Prefer discriminated unions for commands and events.
- Prefer `readonly` data at framework boundaries.
- Avoid `any`; use `unknown` plus validation where external data enters the system.
- Keep exported APIs intentional and small.

## Expected root checks

Once Issue #1 establishes the workspace, preserve working root commands equivalent to:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Inspect `package.json` for the exact commands. Do not claim checks passed unless they were actually run.

## Testing expectations

- Core rules must be testable without launching a browser or Phaser.
- Add tests for every state transition, deterministic outcome and bug fix introduced by the issue.
- Prefer behavioural/scenario tests over tests that merely assert files or class names exist.
- Fixed seeds must reproduce the same generated content and future random outcomes.
- A save/load round trip must not change the next deterministic result once saving is introduced.
- UI work must include a practical touch/mobile verification path in the PR description.

## Mobile-first verification

Desktop browser emulation is not sufficient for final human verification. Maintain a build that can be opened from a phone using Vite LAN hosting or the deployed static site.

At minimum, check:

- narrow portrait layout;
- landscape layout;
- comfortable touch targets;
- no accidental page scrolling during play;
- readable text without zooming;
- no hover-only interaction;
- resuming after backgrounding or refreshing where relevant.

## Issue workflow

When implementing an issue:

1. Restate the issue outcome in implementation terms.
2. Identify the smallest vertical slice that becomes playable early.
3. Implement headless behaviour before or alongside presentation, not after a large UI mock-up.
4. Connect each new framework capability to Threshold Lab.
5. Run relevant automated checks.
6. Verify the acceptance flow manually where possible.
7. Update documentation when contracts, structure or commands change.

Stay within the assigned issue. Record tempting follow-up work rather than silently expanding scope.

## Pull-request expectations

A PR should explain:

- what visibly changed in the playable build;
- what framework capability was added;
- important architectural decisions;
- tests and commands run;
- phone/manual verification performed;
- limitations or follow-up work;
- the issue it closes or advances.

Use a draft PR while work or human verification remains incomplete.

## Definition of a good change

A good Core Loop change is observable in a playable build, deterministic where rules are involved, testable headlessly, independent of a particular theme, and no more abstract than the current use case requires.
