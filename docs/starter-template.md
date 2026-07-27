# Canonical new-game template

`apps/new-game-template` is the smallest complete composition of Core Loop. It does not recreate progression: the headless session coordinator owns the four-entry schedule, targets, encounter outcome, rewards, currency, inventory, shop, effects and deterministic module state. The browser host sends commands/actions and renders returned state.

## Composition map

| File                 | Game-owned responsibility                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/gameplay.ts`    | One deterministic, serialisable gameplay module, validated actions/signals, reports and bot.                                        |
| `src/content.ts`     | One validated pack, terminology, loadout, modifiers, consumables, attachment, upgrade, encounters, reward containers and shop pool. |
| `src/composition.ts` | Namespaced four-challenge schedule/target/outcome policies, module registry, runtime provider and headless coordinator.             |
| `src/runtime.ts`     | Presentation-neutral command host, framework save envelopes, compatibility checks and replay recording/verification.                |
| `src/main.ts`        | Touch UI and a small browser `localStorage` text adapter.                                                                           |

The schedule is intentionally unlike Threshold Lab: four challenges, with an authored special rule on the last. `starter:steady` reacts to the module's `starter:value-chosen` signal. `starter:pulse` and the other teaching items use generic effect operations. `starter:bank-last-choice` documents the versioned custom-handler escape hatch: banking opaque module-local choice history is not a generally useful core operation, so a game would explicitly register it rather than expanding the generic vocabulary.

All committed transitions autosave. The menu supports Continue/New/Delete, while the footer exports/imports framework save text and exports/verifies deterministic replay text. Incompatible content, module, policy or custom-handler versions produce the framework compatibility error instead of silently resetting progress.

The UI obtains progress from `RunState.schedule`, copy from the terminology pack, offers from `ShopState`, inventory from authoritative instances and scoring detail from the effect ledger. It never mutates these values.

## Generator contract

Run `npm run create-game -- my-game`. The generator refuses existing output, excludes `dist` and `node_modules`, and changes only package/app metadata, Vite base path and visible HTML title. It deliberately leaves searchable TODOs beside `starter:*` IDs because stable authored IDs require a developer decision. Its output lists exact install, develop, typecheck, test and build commands.

Generated apps use workspace packages; they copy no framework source and import no Threshold Lab or Garden Loop implementation. Verify one with:

```bash
npm install
npm run typecheck
npm test --workspace @core-loop/my-game
npm run build --workspace @core-loop/my-game
```

For phone verification, run `npm run dev --workspace @core-loop/my-game -- --host`, then complete a run in narrow portrait and landscape. Check touch target comfort, readable ledger/shop copy, no hover dependency and refresh/Continue.
