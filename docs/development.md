# Development workflow

This document describes how Core Loop work should be planned, implemented and verified. The root npm scripts are the canonical development and verification commands; `docs/issue-1-brief.md` records the bootstrap specification.

## Delivery philosophy

Work in vertical slices. Each issue should leave the deployed test-bed noticeably more capable than before.

A typical slice includes:

1. a headless rule or contract;
2. automated tests;
3. integration into Threshold Lab;
4. visible feedback for the player;
5. mobile/manual verification;
6. documentation of new extension points.

Do not complete framework infrastructure in isolation and defer its first playable consumer to another issue unless the issue explicitly requires that sequencing.

## Starting an issue

Before coding:

- read the full issue and its dependency chain;
- read `AGENTS.md`;
- read the relevant architecture and test-bed documents;
- inspect current package scripts and recent changes;
- identify acceptance criteria that require human/mobile checks;
- note explicit out-of-scope items.

For work delegated to an agent, a good instruction is:

```text
Implement issue #N in smcga/coreloop. Read AGENTS.md and all documentation linked by the issue first. Work in a new branch, run the repository checks, and open a draft PR with the issue's human-verification checklist.
```

Issue #1 has an additional concrete brief in `docs/issue-1-brief.md`.

## Branches and pull requests

Use short-lived branches. Agent-created branches should use a clear `agent/` prefix.

Examples:

```text
agent/bootstrap-threshold-lab
agent/deterministic-run-engine
agent/generic-effect-pipeline
```

Open a draft PR early when useful, but do not mark it ready until automated checks pass and the documented manual checks have either been completed or clearly handed off.

Keep one issue per PR where practical. Large planned issues may still result in a large PR; avoid mixing unrelated cleanup or future-phase features into it.

## Commit guidance

Prefer coherent commits that describe outcomes rather than implementation trivia.

Examples:

```text
Bootstrap TypeScript workspace
Add touch-first Threshold Lab shell
Configure Pages deployment
```

Do not rewrite unrelated files merely to satisfy personal formatting preferences.

## Expected checks

Issue #1 will establish exact scripts. The intended root verification set is:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run the narrowest relevant tests during development, then the complete root checks before completing a PR.

Record the commands actually run in the PR description. Mention failures caused by unavailable credentials or external deployment configuration rather than claiming success.

## Local phone testing

Once the Vite application exists, expose it on the local network:

```bash
npm run dev -- --host
```

Depending on workspace script forwarding, the final command may use `--workspace` or an app-specific script. Keep README instructions accurate.

Verification procedure:

1. Connect the development machine and phone to the same network.
2. Start Vite with LAN hosting.
3. Open the displayed network URL on the phone.
4. Test portrait orientation.
5. Rotate to landscape and retest.
6. Check all important actions with touch only.
7. Background and restore the browser when state handling is relevant.
8. Repeat against the deployed static build before a release.

Do not expose a development server to an untrusted public network.

## Automated test boundaries

### Core tests

Core tests run in a Node-like environment without Phaser or browser globals. They cover:

- legal and illegal state transitions;
- deterministic random outcomes;
- encounter resolution;
- economy and inventory behaviour;
- effect ordering;
- save/replay behaviour.

### Content tests

Content tests cover:

- runtime validation;
- duplicate IDs;
- missing references;
- compatibility and weighted-pool rules;
- creation of mutable instances from definitions.

### Application tests

Application tests cover small pieces of deterministic UI/domain state and adapters. Avoid brittle tests of exact pixel positions unless layout logic specifically requires them.

### Manual tests

Use manual tests for touch comfort, orientation, animation clarity, audio activation and the complete player flow.

## Architecture decision rules

Document a decision when it changes:

- package dependency direction;
- public framework contracts;
- command/event semantics;
- deterministic ordering;
- save compatibility;
- content definition shape;
- gameplay-module responsibilities.

A short section in the relevant architecture document is usually sufficient. Formal ADRs can be introduced later if decisions become numerous or contentious.

## Scope control

When an issue reveals useful follow-up work that is not required for acceptance:

- keep the current implementation extensible where inexpensive;
- do not implement the speculative feature;
- capture it in the PR notes or a new issue;
- avoid placeholders that create APIs without a consumer.

Later-phase systems such as a generic effect language, PWA support or simulation should not be pulled into Issue #1 simply because they are visible on the roadmap.

## Dependency choices

Prefer small, mature dependencies that remove substantial work. Before adding one, consider:

- whether platform or language features already suffice;
- bundle size and mobile impact;
- maintenance activity;
- type quality;
- deterministic behaviour;
- whether it would leak into the public core API.

Keep game rules owned by Core Loop rather than hidden in an external state-management framework.

## Release progression

- `0.1 — Playable Spine`: one complete mobile run with shops, modifiers, special encounters and save/resume.
- `0.2 — Generic Systems`: deep generic content plus a second encounter gameplay module.
- `1.0 — Starter Kit`: stable extension points, simulation/debug tools, PWA delivery, template and third-theme proof.

Release tags should represent the playable definitions of done in the tracker issues, not merely completed package APIs.

## Save verification

For the 0.1 build, refresh in both an open shop and before a special encounter. Continue from the menu and confirm the phase, offers, inventory, active rule, and next reroll remain unchanged. Autosaves occur after successful framework transitions, never while a command is resolving; use Delete Save or Abandon to exercise removal.
