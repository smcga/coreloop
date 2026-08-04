# Build a game as an SDK consumer

The executable companion is [`examples/consumer-game`](../examples/consumer-game), outside the npm workspace graph. `npm run consumer:validate` builds package tarballs, installs them in a temporary clean directory, and runs its typecheck, tests, and production build. Use Node.js 22.

## 1. Install the packages

```bash
npm run build:packages
npm pack ./packages/core
npm pack ./packages/content
npm pack ./packages/simulation
npm install ./core-loop-core-0.1.0.tgz ./core-loop-content-0.1.0.tgz ./core-loop-simulation-0.1.0.tgz
```

Each package build also prepares its public package dependencies when their declarations are absent, so individual workspace builds and `npm run build:all` work from a clean checkout.

Run this from an empty ESM TypeScript/Vite project. Do not add repository path aliases or import source files.

## 2. Define terminology and content

Import `TerminologyPack`, `ContentPack`, `ContentRegistry`, and `createRuntimeContentProvider` from `@core-loop/content`. Namespace all persisted IDs. The fixture's [`content.ts`](../examples/consumer-game/src/content.ts) demonstrates playable content, a passive modifier, temporary consumable, shop pool, currency and choice rewards, special rule, terminology, and loadout.

```ts
const registry = new ContentRegistry(pack);
const provider = createRuntimeContentProvider(registry);
```

## 3. Define policies and stages

A `RunPolicySet` owns schedule, target, rewards, routing and outcome. Begin with `defaultPolicies` and replace authored decisions. The fixture uses a variable four-entry schedule with a versioned special rule. Policy IDs are persisted contracts.

## 4. Implement and register gameplay

Implement `GameplayModule<State, Action>`, validate restored state/actions, and return a report. Derive outcomes from the supplied encounter seed using `createRandom`; never use `Math.random()`. Register the opaque module with `createGameplayModuleRegistry([module])`.

## 5. Project run-owned content

Set a versioned `GameplayContextProjection` on `RunConfiguration` when the mechanic needs owned authored objects. Its pure `project` function receives generic inventory and returns serialisable module data. Projection ID/version is saved, so shape changes need an intentional compatibility decision.

```ts
const projection = {
  id: "dice:owned-dice",
  version: 1,
  moduleId: module.id,
  project: ({ inventory }) => ({
    dice: inventory.instances.filter((x) => x.category === "playable-object"),
  }),
} satisfies GameplayContextProjection;
```

## 6. Compose effects and gameplay operations

Prefer stable authored operations such as `add-score`, `currency`, stored values, tags, and allowances. `GameplayOperationRegistry` is an **advanced escape hatch** for genuinely module-owned mutations; pass it to both the host and simulation when required.

## 7. Create a headless session

Compose `RunConfiguration` from policies, provider, shop providers, capabilities, rarity pricing and optional projection, then use the command boundary:

```ts
const session = createHeadlessRunSession({
  configuration,
  modules,
  operations,
});
let state = session.createInitialState();
state = session.handleCommand(state, {
  type: "start-run",
  seed: 71,
  gameplayModuleId: module.id,
}).state;
```

## 8. Implement a minimal host

Render state, send framework commands through `handleCommand`, and mechanic actions through `handleGameplayAction`. Never mutate returned state. Route reward and shop decisions through commands so they become replay inputs. See the minimal DOM [`main.ts`](../examples/consumer-game/src/main.ts); a Phaser adapter follows the same boundary.

## 9. Save, load and replay

Use the root save exports from `@core-loop/core` to create, export, import and validate saves at command boundaries. Use `createSessionReplayExecutor`, `exportReplay`, `importReplay`, and `verifyReplay` to verify recorded commands/actions, including reward and shop decisions. A restored save retains RNG state and the next deterministic result.

## 10. Simulate

Register a `SimulationComposition` containing the same configuration, registries, bot strategy and economy strategy, then call `runSimulation`. The fixture's [`simulation.ts`](../examples/consumer-game/src/simulation.ts) has no application-specific runner branch.

## Public API audit

The package-root exports of `@core-loop/core`, `@core-loop/content`, and `@core-loop/simulation` are the stable SDK surface used by this example. Operation registries and migration hooks are advanced escape hatches. Application code, `packages/*/src`, reducers and repository tools are internal.

The audit found that packages previously exported TypeScript source as their consumer default. Their manifests now resolve bundled ESM and declarations for consumers, declare runtime dependencies and Node expectations, and ship only intentional `dist` artefacts plus npm metadata. Repository-only TypeScript and Vite aliases keep local builds working before package artefacts exist; the isolated consumer has no aliases. No broad internal export was required.

```bash
npm run consumer:validate
```
