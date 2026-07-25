# Common architecture mistakes

- Importing DOM, Phaser, storage or audio into core; keep these in hosts.
- Mutating `RunState` from a scene instead of issuing a command.
- Calling `Math.random()` for an outcome or consuming RNG while previewing a URL.
- Putting themed IDs, nouns or gameplay scoring in generic packages.
- Duplicating definitions into saves instead of stable IDs and versions.
- Registering unnamespaced effects or silently accepting unknown extension versions.
- Bundling simulation/Node tooling, malformed fixtures or mutable content-browser controls into production.
- Assuming six encounters, capacities or one pack when a policy/configuration owns the choice.
