# Simulation and development inspection

`@core-loop/simulation` is an application-agnostic framework consumer. It owns registry, strategy, runner, aggregation, canonical report and formatting contracts, but imports no application source. The top-level [`tools/simulation-compositions.ts`](../tools/simulation-compositions.ts) adapter registers Threshold Lab, the generated starter and Garden Loop. This direction avoids a package-to-application dependency while letting each application provide its real content provider, policies and gameplay-module registry.

## Registering a composition

Create a namespaced `SimulationComposition` with provider/content identities and versions, the live `RunConfiguration` and `GameplayModuleRegistry`, registered policy/strategy/economy choices, and defaults. Register it in the top-level adapter with `SimulationRegistry.register`. Duplicate or non-namespaced identities are rejected, and unknown values list available choices.

Gameplay strategies receive only the validated, read-only module state and run context. They return an action which the authoritative `createHeadlessRunSession` coordinator validates and applies. `bindModuleDefaultStrategy` adapts a module's `createBotStrategy`; external strategies declare compatible module IDs and optional required capabilities. They cannot invoke module lifecycle/report methods directly.

Economy strategies are independent. They return one legal framework command for reward/shop state. `core:cheapest-affordable` is a deliberately simple example, not an optimal player: it selects a stable cheapest affordable direct offer when capacity permits, otherwise exits. Starter and Garden use `core:leave-shop` to demonstrate independently selectable economy behaviour.

## CLI

```bash
npm run simulate -- --list
npm run simulate -- --game threshold-lab:main --module threshold-lab:timing-meter \
  --policy core:default --strategy threshold-lab:balanced \
  --economy core:cheapest-affordable --runs 10000 --seed-start 1 --format json
npm run simulate -- --game starter:main --runs 100 --seed-start 1
npm run simulate -- --game garden-loop:main --runs 100 --seed-start 1
```

Use `--help` for defaults and all options. `--seed-end` is inclusive. Invalid identities, strategy/module compatibility and numeric ranges fail before a seed is consumed. `--max-commands` bounds each run and emits structured diagnostics. Progress is written only to stderr, JSON only to stdout, and `--output` reports are optional local artefacts that must not be committed.

## Report schema and interpretation

Report format version 2 records composition, provider, content, module, policy, gameplay strategy and economy strategy identities; the complete request and inclusive seed range; completion/failure/abortion; phase frequency and economy totals; content eligibility, offers, acquisitions, sales, uses and triggers; reachability warnings; diagnostics; and bounded outlier seeds.

Encounter rows are discovered from the actual schedule and keyed by schedule position plus encounter identity. They retain kind/rule identities and every named score track, with target statistics where a target exists. No six-encounter allocation exists. Canonical key and row ordering means identical requests produce byte-equivalent JSON.

Content contribution comes from typed score-ledger entries. Offer/purchase/use/sale/trigger counts come from typed engine events rather than application inference. A contribution associates an observed ledger delta with its recorded source; reachability and completion comparisons remain descriptive correlation, not causal inference. A warning can reveal strategy behaviour rather than bad content.

Diagnostics and outliers are deterministic and bounded. Reproduce an outlier by starting the corresponding registered game with its reported seed and module, or by replaying the same request with `--runs 1 --seed-start SEED`. Strategy bots are deterministic but are intentionally not searches for optimal play.

## Inspection models

Application-hosted content-browser and inspector presentation remains optional. Pure models must be passed provider/registry data: arbitrary categories, rarities, groups and module compatibility for content; variable schedules, provider/policy identities, generic instances and attachments, pending acquisitions, named tracks/ledgers, and ordered events/diagnostics for live state. They must not import Threshold Lab globals. Existing Threshold Lab models follow this injected-data boundary and remain gated behind `?dev=1` in development builds.

## Verification

`npm run simulate:smoke` exercises fixed seeds through both Threshold Lab modules. The simulation test matrix also runs the four-entry starter and five-entry Garden schedule twice through the same coordinator, checks canonical equality/schema validation and includes negative registry, compatibility, safety-limit and architecture-boundary cases.
