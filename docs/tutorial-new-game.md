# Tutorial: clone to a deployed themed game

1. Clone the repository, install Node 22 (`nvm use`), run `npm ci`, then `npm run format:check && npm run lint && npm run typecheck && npm test`.
2. Run `npm run create-game -- orchard-loop`. The safe deterministic generator accepts only lowercase slugs, copies text source from `apps/new-game-template`, refuses overwrites and excludes build/dependency directories.
3. Rename package, title, stable app/module/content IDs and the Vite base. Define a complete terminology pack before writing presentation strings.
4. Replace `src/content.ts` definitions; keep immutable definitions distinct from owned mutable instances. Register the pack and module capabilities explicitly.
5. Implement the `GameplayModule` lifecycle: deterministic `createEncounter`, explicit `handleAction`, progress, report, validation and optional bot. Use only the supplied run RNG.
6. Configure schedule, target, reward, shop, inventory and outcome policies. Add a namespaced custom signal/effect only if generic operations cannot express the rule.
7. Worked addition: define `orchard-loop:mulch` as a passive, trigger it from an `orchard-loop:planted` signal, add score through a registered effect, render its ledger line, and test that the same seed/action both triggers it and reproduces the score.
8. Add deterministic action/report, win/loss, content validation, effect/policy registration, shop, save/replay round-trip and complete-run tests.
9. Run `npm run dev --workspace @core-loop/orchard-loop -- --host`; use the LAN URL on a phone in portrait and landscape. Test 320×568, 390×844, 568×320, 844×390, tablet and desktop.
10. Run `npm run build --workspace @core-loop/orchard-loop`. Configure Pages to upload only its `dist`; match Vite `base`, manifest scope/start URL and deployment subpath.
11. Verify normal web play, a seed-link round trip, save replacement confirmation, production debug gating, install/offline readiness and a complete offline run. Do not publish workspace packages to npm.
