# Simulation and development inspection

Issue #8 adds measurement and inspection tools above the headless framework boundary. `@core-loop/simulation` depends on core, content, and Threshold Lab's two gameplay adapters; core does not depend on the simulator, CLI, report formatting, DOM, or Phaser. Runs are single-threaded and each seed starts from a fresh `RunState`. Strategies drive module actions and every surrounding transition uses `handle`, including consumable use, encounter submission, shop entry, purchase, and exit.

## CLI

```bash
npm run simulate -- \
  --content threshold-lab \
  --module threshold-lab:combination-grid \
  --runs 10000 \
  --seed-start 1

npm run simulate -- \
  --content threshold-lab \
  --module threshold-lab:timing-meter \
  --runs 10000 \
  --seed-start 1 \
  --format json
```

Options are `--content`, `--module`, `--loadout`, `--policy`, `--strategy`, `--runs`, `--seed-start`, inclusive `--seed-end`, `--format human|json`, `--output`, `--verbose`, and `--max-outliers`. Defaults select Threshold Lab, Combination Grid, the balanced loadout/strategy, default policies, seeds beginning at 1, and 100 runs. Unknown identities and invalid ranges fail rather than falling back. Progress uses stderr and therefore never contaminates JSON stdout. Output files and generated reports are local artefacts and must not be committed.

The `balanced` strategy exhaustively scores legal full-size Combination Grid selections, including pair, three-value sequence, and matching-tag bonuses. Equal scores use stable object-ID ordering. Timing Meter uses a deterministic quantised error profile containing perfect, good, fair, and miss offsets—never timers or animation. The economy portion consumes a legal held consumable, buys the cheapest affordable stable-ID offer when capacity permits, and leaves the shop through commands. It deliberately does not claim optimal play.

## Reports and limitations

Human output covers outcomes, per-encounter score/target ratios, economy, offers/purchases/triggers, reachability warnings, bounded outliers, and diagnostics. JSON format version 1 includes framework/content/module/policy identities, the complete request, aggregates, encounter and content rows, reachability, bounded examples, and diagnostics. Object keys and arrays use canonical deterministic ordering. The validator rejects unknown report versions.

Aggregation retains numeric counters, six bounded score arrays used for medians, per-definition counters, and at most `maxOutliers` returned examples. It does not retain run states, complete event histories, or replays. The command limit safely diagnoses malformed or non-terminating runs. Contribution is attributed from score-ledger before/after values. Ownership completion and score comparisons are descriptive correlations, not causal estimates; small samples and a deterministic strategy cannot establish statistical certainty.

Reachability distinguishes never eligible, eligible but never offered, offered but never purchased, and purchased modifiers that never trigger. A warning can describe strategy behaviour rather than broken authored content, so it is an investigation lead. Outlier ordering is deterministic and examples are bounded.

`npm run simulate:smoke` runs 20 fixed seeds for both gameplay modules in Node, validates completion without unexpected diagnostics, and exercises stable schema/report construction. Large simulations remain local rather than normal CI work.

## Content browser and live inspection

Start Vite and deliberately add `?dev=1`, for example `http://localhost:5173/coreloop/?dev=1`. The browser is enabled only when both Vite's compile-time `DEV` boolean and that query flag are true; a production build cannot activate it with the query alone. Its touch-sized drawer lists every loaded definition and supports search and category selection. The pure view model additionally supports rarity, tag, module compatibility, required capability, availability, validation, and custom-handler filters.

Rows show name, stable ID, category, rarity, price, tags, compatible modules, and validation. Structured detail resolves pack/version, authored fields, pool membership, loadout inclusion, validation warnings, and optional canonical JSON. `inspectorViewModel` provides seed, Mulberry32 identity/state, phase, encounter, module, content/save versions, active brief, validated module envelope, named inventory/stored values, shop, last report, and score ledger without transient wall-clock fields. These pure models are intended for the existing responsive debug drawer; they avoid an overlapping text wall and remain testable without pixels.

Controlled development operations remain non-mutating: canonical state copying and definition lookup are derived views. Existing save/replay import, export, and verification stay the authoritative controlled actions. Arbitrary currency, score, inventory, or object editing is intentionally absent. Simulation-report import is deferred: format validation is implemented, but the browser does not persist or load files.

## Balance finding and correction

Configuration: Combination Grid, balanced strategy/economy, default policies/loadout, seeds 1–100. Before correction, **High Risk was offered 106 times and purchased 0 times**. The deterministic buyer consistently preferred less expensive offers, leaving this modifier unmeasured despite repeated reachability. Diagnosis: its 18-coin price made it a dead offer for the shipped practical economy strategy. The targeted correction reduced High Risk's base price from 18 to 11, without changing its effect. Repeating the identical simulation produced **106 offers, 18 purchases, and 46 triggers**; completion remained 100%. This is strategy-specific evidence, not a claim of universally optimal balance.

## Text-only verification checklist

Run both example commands twice for deterministic comparison, inspect completion and encounter-six failure rates, and investigate reachability rows. With `?dev=1`, search each category, filter a module in the pure model tests, and inspect a trigger definition. During a live run, use the existing Debug drawer after starting, purchasing, and resolving an encounter; inspect phase transitions and ledger. Verify production gating with `npm run build`. Phone verification should cover narrow portrait, landscape, desktop, touch targets, and drawer scrolling. No screenshots or other binary artefacts belong in the repository.
