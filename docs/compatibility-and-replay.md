# Extension, save, and replay compatibility

Core Loop 1.0A exposes deterministic extension points without a hidden global registry. Applications compose a `PolicyRegistry`, `EffectHandlerRegistry`, and `GameplayModuleRegistry`, then persist stable namespaced IDs and integer versions. Unknown IDs and mismatches raise `FrameworkError` with a machine-readable code and details; UI copy stays outside core.

## Policies and custom effects

The small interfaces are `EncounterSchedulePolicy`, `TargetPolicy`, `RewardPolicy`, `ShopGenerationPolicy`, `ShopPricingPolicy`, `InventoryPolicy`, `ContentCompatibilityPolicy`, and `RunOutcomePolicy`. Contexts contain serialisable facts and the run RNG where randomness is allowed. `defaultPolicies` describes the established six encounters, rounds three/six special rules, linear targets/rewards, three offers, base prices, 4/2 inventory limits, exact content selection, and current win/loss boundary.

```ts
const policies = new PolicyRegistry([defaultPolicies.target, myTargetPolicy]);
const selected = policies.get<TargetPolicy>({
  id: "my-game:targets",
  version: 1,
});
```

`EffectHandlerRegistry.register(id, handler, version)` requires a namespace, rejects duplicates, and protects `core:`. A handler receives a cloned deterministic state/signal/operation and returns typed state/events/signals. Its result is canonical-validated before commit, so failure cannot expose partial state. Envelopes list handler identity/version in `customEffects`.

Threshold Lab's worked external examples are in `apps/threshold-lab/src/extensions/sample.ts`: `threshold-lab:steep-targets` and `threshold-lab:reverse-meter-direction` require no core modification.

## Save envelope and migrations

Save format **4** contains framework version, content pack ID/version, gameplay module ID/version, policies, custom effects, RNG algorithm/version, mutable `RunState`, saved time, and optional replay metadata. It never duplicates definitions.

The built-in graph is `1 → 2 → 3 → 4`: historical v1 used `contentVersion`; v2 adds content identity; v3 adds module identity; v4 adds policies, handlers, and RNG identity. Plain UTF-8 fixtures under `packages/core/tests/fixtures/saves` cover each boundary, corruption, a missing pack, and an unsupported module. Migrations operate on clones, never consume run RNG, must advance exactly, and commit atomically. Current saves validate without rewriting.

`loadSaveFile` can check installed content/module versions and reports missing packs, unsupported versions, and unsafe numeric state with paths. The host may offer reset, compatible import, inspection, or return-to-menu; it never silently substitutes or deletes content.

## Replay and canonical hashes

Replay format **1** records seed, compatibility references, and ordered run commands/module actions. Combination Grid uses stable object IDs; Timing Meter uses the existing quantised stop position. Pointer motion, frames, terminology, and wall time are not inputs.

`verifyReplay` is headless and module-neutral through a supplied executor. It applies inputs in order and compares boundary checkpoints plus final state and ordered-event hashes. First divergence reports sequence/type, expected/actual hashes, phase, module, and encounter.

Canonical JSON sorts object keys, preserves arrays, and rejects `undefined`, functions, non-finite numbers, and cycles. Stable text hashes use FNV-1a 32-bit (`fnv1a32:...`), for deterministic comparison rather than security. Explicit transient keys can be excluded.

Formatted JSON is primary import/export. `coreloop-replay-v1:` contains URL-escaped validated JSON with an 8,000-character cap; larger runs fall back to text. Imports cap at 1 MB and cannot execute code.

Autosaves, accepted inputs, and checkpoints occur only after complete transitions. Rejections preserve state/RNG and are omitted from authoritative history. Migration, effects, shop/rewards, purchase, gameplay action, and submission are atomic.

## Worked composition

1. Define a namespaced/versioned target policy outside core.
2. Define and register a deterministic custom effect outside core.
3. Resolve references before a seeded run.
4. Save using `createSaveFile` with matching references.
5. Record accepted commands/actions, `createReplay`, export, and verify via an executor backed by the module registry.

Threshold Lab's menu imports/exports save and replay JSON and shows migration/validation messages. Deterministic replay execution is tested in Node. No server, binary fixture, or executable content is required.
