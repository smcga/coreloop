# Issue #1 implementation brief

This document removes ambiguity from [Issue #1](https://github.com/smcga/coreloop/issues/1). A coding agent should be able to implement the issue using the issue, `AGENTS.md` and this brief without additional product decisions.

## Required outcome

Deliver the first deployed, touch-first Core Loop build. It is a playable shell, not yet the real run framework.

A user must be able to open Threshold Lab on desktop or phone, enter the game, tap numbered tiles, submit a selection and reset it.

## Technology decisions

Use:

- TypeScript with strict compiler settings;
- npm workspaces, managed from the repository root;
- Vite for the application and production build;
- Phaser for the playable canvas/game scenes;
- Vitest for tests;
- ESLint and Prettier, or current equivalent configurations that provide root lint and format checks;
- GitHub Actions for CI and GitHub Pages deployment.

Do not use React, Vue, another UI framework, an ECS or native mobile tooling.

Use a currently supported Node LTS version and record it in repository configuration such as `.nvmrc` and/or the `package.json` engines field. Do not introduce an alternative package manager lockfile.

## Expected repository shape

A reasonable final shape is:

```text
.github/
  workflows/
    ci.yml
    deploy-pages.yml
apps/
  threshold-lab/
    index.html
    package.json
    public/
    src/
      main.ts
      game/
        config.ts
        scenes/
          BootScene.ts
          MenuScene.ts
          LabScene.ts
      ui-or-domain helpers as needed
    tests/
packages/
  core/
    package.json
    src/index.ts
    tests/
  content/
    package.json
    src/index.ts
  phaser/
    package.json
    src/index.ts
  testing/
    package.json
    src/index.ts
AGENTS.md
README.md
docs/
package.json
package-lock.json
tsconfig.base.json
```

Exact filenames may differ when there is a clear reason, but preserve the package boundaries and avoid empty ceremony. Packages may begin with small documented exports or placeholders, but every package must build cleanly.

## Workspace package names

Use stable names following this pattern:

```text
@core-loop/core
@core-loop/content
@core-loop/phaser
@core-loop/testing
@core-loop/threshold-lab
```

Packages do not need to be publishable during Issue #1. Keep the root private and configure workspace dependencies normally.

## Root scripts

The root project must expose working commands equivalent to:

```bash
npm run dev
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run dev` should start Threshold Lab. The production build output must be suitable for static hosting.

## TypeScript requirements

The shared configuration must enable at least:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

Also enable appropriate modern module and bundler settings. Avoid suppressing errors with broad casts or `any`.

## Package boundaries in Issue #1

### `packages/core`

Provide a minimal headless package proving it can compile and test without browser or Phaser imports. Do not prematurely implement the Issue #2 run engine.

A small exported version or placeholder type is sufficient, accompanied by a real unit test.

### `packages/content`

Provide the package boundary and a minimal documented export. Do not build schemas or generic content loading yet.

### `packages/phaser`

Provide the integration boundary for shared Phaser-facing code. Keep app-specific scenes in Threshold Lab. A helper or typed configuration export is sufficient; do not invent a broad scene framework.

### `packages/testing`

Provide a small reusable test helper only when it has an immediate consumer. Otherwise expose a documented package entry point without speculative APIs.

### `apps/threshold-lab`

Contains the playable application and all temporary tile-selection state for this issue.

## Required playable flow

### Boot

- Load without external art assets.
- Fit the game to the available viewport.
- Use a clear background and readable high-contrast text.

### Main menu

Display:

- the title `Threshold Lab`;
- a short line explaining it is the Core Loop test-bed;
- a large `Start experiment` button.

### Lab scene

Display:

- twelve numbered tiles arranged responsively;
- a maximum selection count of five;
- selected count, for example `3 / 5`;
- live sum of selected tile values;
- `Submit` and `Reset` controls;
- a route back to the menu.

Interaction rules:

- tapping an unselected tile selects it when fewer than five are selected;
- tapping a selected tile deselects it;
- trying to select a sixth tile leaves state unchanged and gives brief visible feedback;
- Submit shows a result such as `Experiment score: 27`;
- Reset clears selection, sum and result feedback.

No score target, run progression, shop, saving or randomness is required yet.

## Responsive and mobile requirements

- Support narrow portrait screens and landscape screens.
- Important touch controls should be comfortably thumb-sized, with a target of at least 44 CSS pixels where HTML sizing applies.
- Do not require hover.
- Do not place essential controls outside safe visible bounds.
- Selected state must be communicated by shape/border/text as well as colour.
- Prevent active gameplay gestures from causing accidental page scrolling where practical.
- Set useful page metadata and viewport configuration.

The app should work with mouse/pointer input on desktop and touch/pointer input on mobile through the same interaction path where possible.

## Deployment decision

Deploy the static Vite build to GitHub Pages using GitHub Actions.

Expected public base path:

```text
/coreloop/
```

The workflow should deploy from `main` after merge. Pull requests should still run build validation without deploying over production.

Document:

```bash
npm run dev -- --host
```

or the workspace-equivalent command for testing from another device on the same local network.

## CI requirements

On pushes and pull requests, run:

1. clean dependency install with `npm ci`;
2. format check;
3. lint;
4. TypeScript checking;
5. tests;
6. production build.

Cache dependencies when straightforward, but correctness is more important than workflow optimisation.

## Testing expectations

At minimum include:

- a headless test proving `@core-loop/core` imports and runs without Phaser/DOM;
- a deterministic unit test for the tile-selection state/helper used by Threshold Lab, including the five-tile limit and reset behaviour;
- a production build exercised by CI.

Do not rely only on smoke tests that search source text for class names.

## Documentation updates expected in the implementation PR

Update README or development documentation with:

- prerequisites;
- install command;
- local development command;
- root verification commands;
- LAN phone-testing steps;
- deployed URL once known;
- workspace overview if the actual structure differs from this brief.

Update `AGENTS.md` only when the implementation establishes commands or conventions that differ from the documented expectations.

## Out of scope

Do not implement:

- `RunState`, commands or events beyond tiny placeholder types;
- deterministic run RNG;
- encounters or targets;
- shops, currency or inventory;
- modifiers or consumables;
- bosses;
- persistence;
- generic content schemas;
- PWA service workers;
- Timing Lab;
- elaborate art, audio or animation systems.

These belong to later issues.

## Acceptance checklist

- [ ] Root install and all documented checks pass.
- [ ] Workspace packages compile with intended dependency direction.
- [ ] Threshold Lab opens at the Vite development URL.
- [ ] The production build works under the `/coreloop/` base path.
- [ ] Menu-to-lab flow works.
- [ ] Twelve tiles can be selected and deselected.
- [ ] Selection is capped at five with visible feedback.
- [ ] Live sum, submit result and reset work.
- [ ] Desktop, phone portrait and phone landscape are usable.
- [ ] CI validates pull requests.
- [ ] GitHub Pages deployment is configured.
- [ ] Setup and phone-testing instructions are documented.

## PR description template

The implementation PR should include:

```markdown
Closes #1

## Visible result

Describe the deployed/playable Threshold Lab flow.

## Architecture

Summarise the workspace and package boundaries.

## Verification

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Manual/mobile checks

Describe desktop, physical phone portrait and landscape checks. Include the deployed or preview URL when available.

## Deferred to Issue #2

List any intentionally temporary app state or other known next-step work.
```
