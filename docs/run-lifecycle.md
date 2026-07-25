# Run lifecycle, commands, events and signals

The authoritative path is `not-started` → `encounter-ready` → `encounter-active` → `encounter-won` → `shop` and back to `encounter-ready`; a submitted loss reaches `run-lost`, while the configured outcome policy reaches `run-won`. Applications must call `handle(state, command)` and render its returned state/events rather than mutating state.

Commands start runs and encounters, submit gameplay signals/reports, use inventory, enter/buy/reroll/leave shops and abandon. Invalid phase/command pairs return `command-rejected` without RNG advancement. Events are ordered presentation/diagnostic facts, not state. A gameplay module owns actions and emits namespaced signals plus a generic `EncounterReport`; core only consumes tags, numeric values, metrics and score. See [architecture](architecture.md), [gameplay modules](gameplay-modules.md), and [effects](effects.md) for worked Threshold Lab examples.
