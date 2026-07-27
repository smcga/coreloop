# Run lifecycle, commands, events and signals

The authoritative path is `not-started` → `encounter-ready` → `encounter-active` → `encounter-won` → `shop` and back to `encounter-ready`; a submitted loss reaches `run-lost`, while the configured outcome policy reaches `run-won`. Applications must call `handle(state, command)` and render its returned state/events rather than mutating state.

## Authoritative run policies

Every constructed engine receives an explicit `RunPolicySet`. Its versioned start, schedule, target, reward, shop-generation, shop-pricing, inventory, and outcome policies own those decisions; core has no fixed run length or economy. The exported `defaultPolicies` bundle preserves Threshold Lab's six-encounter, 10-currency lifecycle. The exact references are exposed by the engine and stored in run state.

The complete schedule is generated and validated by `start-run`, then persisted with its zero-based `schedulePosition`. Entries contain a stable ID, ordinal, generic kind, and versioned rules. A special encounter is an ordinary schedule entry with different data; advancement always selects the next entry.

Policies receive read-only RNG snapshots and cannot return RNG state. Schedule, target, reward, and pricing calculation therefore consume no RNG. Only engine-owned module-seed derivation and weighted shop selection advance the authoritative RNG.

Commands start runs and encounters, submit gameplay signals/reports, use inventory, enter/buy/reroll/leave shops and abandon. `store-gameplay-session` may carry the accepted action ID and its authored signals; the session and complete effect result commit together. Invalid phase/command pairs and malformed/non-serialisable signals return `command-rejected` without RNG or sequence advancement. Public events have a monotonic run-level sequence (persisted independently from the per-encounter score-ledger sequence) and remain presentation/diagnostic facts rather than event-sourced state. A gameplay module owns actions and emits namespaced signals plus the documented generic capability signals and an `EncounterReport`; core consumes their ordered tags, numeric values, metrics, and raw score. See [architecture](architecture.md), [gameplay modules](gameplay-modules.md), and [effects](effects.md) for worked Threshold Lab examples.
