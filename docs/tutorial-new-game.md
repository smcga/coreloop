# Tutorial: build a game by composition

## 1. Generate and verify

Use Node 22, install the workspace, then run `npm run create-game -- orchard-loop`. Follow the exact commands printed by the generator. Rename every marked `starter:*` module, content, policy, terminology and handler ID before saves or replays are published; IDs are persistent compatibility contracts.

## 2. Change the five game-owned areas

1. **Gameplay module/actions/state — `src/gameplay.ts`.** Replace the choice mechanic. Derive creation only from the supplied module seed, validate all untrusted actions and restored state, emit namespaced serialisable signals, create progress/report values, and supply a deterministic bot. Never use the DOM, Phaser, storage or `Math.random()` here.
2. **Content definitions — `src/content.ts`.** Author a single validated catalogue and construct its runtime provider. Put starting inventory/currency in the loadout, purchasable definitions in a capability-filtered pool, and effects in triggers. Do not create a parallel engine-specific catalogue.
3. **Terminology/presentation metadata — `src/content.ts`.** Define category names, score/target/currency labels and the application title before writing UI. Keep presentation names out of framework state.
4. **Policies — `src/composition.ts`.** Compose versioned schedule, target, reward, shop, inventory and outcome policies. The sample demonstrates a four-entry schedule and custom target curve. Register the module and its capabilities with the coordinator.
5. **Scenes/view models — `src/main.ts` and `src/runtime.ts`.** Send only coordinator commands/actions. Render authoritative schedule, module progress, inventory, reward/shop and ledger views. Replace the DOM host with Phaser scenes if desired, but keep the headless runtime boundary.

A normal new game **does not edit `packages/core`**. Add a namespaced custom effect handler only when the behaviour depends on game-specific state that generic score, target, currency, instance, tag, allowance, stored-value and signal operations cannot represent. Version and compatibility-test that handler.

## 3. Test the actual lifecycle

Keep headless tests for repeated seed/action equality, invalid-action atomicity, passive/consumable/attachment/upgrade effects, every save phase, replay modification detection and a bot-completed run. Then build and serve over LAN:

```bash
npm run typecheck
npm test --workspace @core-loop/orchard-loop
npm run build --workspace @core-loop/orchard-loop
npm run dev --workspace @core-loop/orchard-loop -- --host
```

On a phone, complete the schedule in portrait and landscape, enter the shop, purchase/reroll/trade where legal, refresh and Continue, and export/import both save and replay text.

## Troubleshooting

- **Duplicate or invalid namespaced IDs:** use lowercase `namespace:name` IDs and register each once. Do not casually rename an ID after shipping saves.
- **Incompatible saves:** retain the old module/content/policy/handler version with a migration when supported, or clearly offer Delete/New. Never cast an incompatible envelope into state.
- **Empty shop pool:** check pool entries, encounter availability, supported module IDs and required/forbidden capability filters. Ensure `gameplayCapabilities` matches the registered module.
- **Non-serialisable state/action/signal:** restrict boundaries to JSON values, finite numbers and namespaced signal types. Validators should reject class instances, functions, `undefined`, `NaN` and cyclic objects.
- **Replay divergence:** reproduce from the reported input sequence; check RNG consumption, input ordering, policy/content versions and accidental time/global-state reads.
- **Direct state mutation detected:** remove assignments to run, session, inventory, currency, reward or offer objects. Send the appropriate command/action and replace the local reference with the returned state.
