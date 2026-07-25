# Common architecture mistakes

- Importing DOM, Phaser, storage or audio into core; keep these in hosts.
- Mutating `RunState` from a scene instead of issuing a command.
- Calling `Math.random()` for an outcome or consuming RNG while previewing a URL.
- Putting themed IDs, nouns or gameplay scoring in generic packages.
- Duplicating definitions into saves instead of stable IDs and versions.
- Registering unnamespaced effects or silently accepting unknown extension versions.
- Bundling simulation/Node tooling, malformed fixtures or mutable content-browser controls into production.
- Assuming six encounters, capacities or one pack when a policy/configuration owns the choice.

## Boundary regressions

- Adding playable objects, colours, input allowances, accuracy bands, or mechanic penalties to `EncounterBrief`.
- Branching in core on a concrete module, rule, item, effect, or handler ID.
- Putting a concrete catalogue in core instead of content/application composition.
- Letting a module use the run RNG directly or `Math.random()`; modules receive one derived seed per encounter.
- Treating opaque module JSON as unvalidated: the owning module must validate its versioned envelope on restore.
