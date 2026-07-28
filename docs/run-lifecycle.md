# Run lifecycle, commands, events and signals

The authoritative path is `not-started` → `encounter-ready` → `encounter-active` → `encounter-won` → `shop` and back to `encounter-ready`; a submitted loss reaches `run-lost`, while the configured outcome policy reaches `run-won`. Applications must call `handle(state, command)` and render its returned state/events rather than mutating state.

## Authoritative run policies

Every constructed engine receives an explicit `RunPolicySet`. Its versioned start, schedule, target, reward, post-encounter route, shop-generation, shop-pricing, inventory, and outcome policies own those decisions; core has no fixed run length or economy. The exported `defaultPolicies` bundle preserves Threshold Lab's six-encounter, 10-currency lifecycle. The exact references are exposed by the engine and stored in run state.

`PostEncounterPolicy` resolves a deterministic destination after outcome and reward determination. The result is stored as `pendingRoute`; reward containers are resolved before a generic `continue` follows that route. A host may choose its screen or animation, but cannot choose whether to visit a shop or skip to the next encounter: mismatched `enter-shop`, `advance`, or `leave-shop` commands are rejected atomically. Shopless games return `next-encounter`; selected-shop games inspect stable schedule entry data; terminal routes return `run-complete` or `run-failed`. Route policies receive no RNG and their identity/version participates in saves and replay compatibility. Historical saves reconstruct the default route from their phase without consuming RNG.

The complete schedule is generated and validated by `start-run`, then persisted with its zero-based `schedulePosition`. Entries contain a stable ID, ordinal, generic kind, and versioned rules. A special encounter is an ordinary schedule entry with different data; advancement always selects the next entry.

Policies receive read-only RNG snapshots and cannot return RNG state. Schedule, target, reward, and pricing calculation therefore consume no RNG. Only engine-owned module-seed derivation and weighted shop selection advance the authoritative RNG.

Commands start runs and encounters, use inventory, enter/buy/reroll/leave shops and abandon. `createHeadlessRunSession` owns the internal gameplay-session storage and encounter-report commands; supported hosts cannot provide either value. Starting an encounter creates and validates module state exactly once, while every accepted action stores its state and complete effect result together. Completion creates a report from that stored state in the same coordinator transition. Invalid phase/command pairs and malformed/non-serialisable signals return `command-rejected` without RNG or sequence advancement. Public events have a monotonic run-level sequence (persisted independently from the per-encounter score-ledger sequence) and remain presentation/diagnostic facts rather than event-sourced state. A gameplay module owns actions and emits namespaced signals plus the documented generic capability signals and an `EncounterReport`; core consumes their ordered tags, numeric values, metrics, and raw score. See [architecture](architecture.md), [gameplay modules](gameplay-modules.md), and [effects](effects.md) for worked Threshold Lab examples.

# Stages and persistent progression

A **run** owns its deterministic schedule and mutable economy. A **stage** groups one or more authored encounters; stages may have unequal lengths and special encounters are selected by schedule data, not by ordinal convention. Existing flat schedules are adapted to one stage, so applications may omit stage UI.

Stage position is authoritative run state and therefore participates in saves and replay hashes. Target, reward, shop-generation, and post-encounter policies receive optional stage context. `stage-started` and `stage-completed` facts bracket deterministic transitions.

Cross-run unlocks instead live in the storage-neutral, versioned `PlayerProfile`. Hosts persist profiles separately from run saves and apply a versioned `UnlockPolicy` atomically to terminal run facts. Content and loadouts use namespaced `requiredUnlockIds`; unknown unlock IDs are retained. Incompatible profiles produce typed errors and can be recovered by selecting/migrating the correct content profile or explicitly starting a fresh profile. This boundary supports run-based eligibility, not quests, maps, dialogue, or a narrative campaign engine.
