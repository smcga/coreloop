# Gameplay modules

## Projecting run-owned content

The run engine owns inventory instances, attachments, upgrades and their stable
identities; a gameplay module owns only the mechanic state stored in its session
envelope. Applications bridge those boundaries with a versioned
`GameplayContextProjection` in `RunConfiguration`. Immediately before encounter
creation, the headless coordinator gives that pure projector a read-only,
presentation-free snapshot of generic instances, runtime definitions, run and
encounter tags, allowances and the prepared encounter. Its canonical JSON result
is passed to `GameplayModule.createEncounter` as `context.projection`.

Projection must be deterministic for the same snapshot and definitions. It must
not retain or mutate inputs, use presentation data, or consume the run RNG;
module-specific random variation should use `context.seed` after interpreting the
projection. Core canonicalises output before committing any transition, so
functions, cycles, non-finite numbers and other invalid JSON reject
`start-encounter` atomically. The module remains responsible for validating the
opaque value. Sessions record the projector ID/version and restoration rejects a
missing or changed projector with a typed compatibility error. Changing projected
mechanic meaning therefore requires a projector version bump (and normally a
module version bump when saved module state changes).

Garden Loop is the worked example: its projector selects generic
`playable-object` instances, carries their stable instance/definition IDs and
stored growth values into planting, resolves the host relationship for the
`Deep Rooted` attachment, and adds resilience. Purchased plants consequently
join later encounters through the same live, save/replay and simulation
coordinator path. A music game can similarly select sample-tagged instances, or
a sports game squad-tagged instances, without adding those concepts to core.

Modules that need no owned content require no projector and receive an empty JSON
object. Never pass `RunState` itself: doing so would allow mechanic code to mutate
progression state, couple it to storage shape, and bypass the command boundary.

Gameplay modules are headless adapters between a game's encounter mechanic and the reusable run. The application explicitly constructs a `GameplayModuleRegistry`; there is no import-time or global registration. A module declares a stable namespaced ID, positive version, display metadata, unique stable capabilities, deterministic encounter creation, legal action handling, progress, completion, report creation, action and state validation, and an optional bot strategy.

Applications compose that registry with their configured engine through `createHeadlessRunSession`. This is the supported orchestration boundary for live play, tests, simulation, and replay: hosts call `handleCommand` for lifecycle commands and `handleGameplayAction` with untrusted input. The coordinator creates encounter state, processes signals, persists the versioned envelope, detects completion, and creates the report from the exact validated saved state. Host-authored `store-gameplay-session` and `submit-encounter` commands are rejected by this API.

```text
Core run framework
        ↑
Gameplay-module contract
        ↑
Combination Grid | Timing Meter
        ↑
Phaser scenes and presenters
```

Core stores only this envelope and never reads `data`:

```ts
interface GameplaySessionState {
  moduleId: string;
  moduleVersion: number;
  encounterId: string;
  data: JsonValue;
}
```

The registry is the single narrowing boundary. It rejects unknown IDs, duplicate IDs, duplicate capabilities, invalid versions, invalid state, and saves whose module version differs from the installed adapter. It never silently selects a replacement. The menu can therefore offer deletion and a new-run path for an incompatible save.

Historical envelopes are handled by the explicit save migration graph. Current envelopes identify the selected module and its version; unsupported identities fail with a compatibility diagnostic.

## Actions, signals, reports, and deterministic state

### Named encounter results (save format 9)

Modules may report named numeric tracks, boolean objectives, resources, tags, and statistics. Encounter briefs likewise carry generic targets, objective requirements, and limits. A versioned encounter-outcome policy interprets those values; the reducer does not embed mechanic-specific comparisons. The scalar convention remains concise: set `score`, omit the generic maps, and use the default policies. Core normalises it to `tracks.score`, while `EncounterBrief.target`, `lastReport.score`, and scalar breakdowns remain compatibility views.

Non-framework keys in tracks, objectives, resources, requirements, and statistics must be namespaced (for example `my-game:efficiency`); `score` and the legacy metric map are compatibility vocabulary. Numeric values must be finite. Gameplay creation now also receives `requirements`; `target` remains the scalar convenience value.

`createEncounter` receives the encounter identity, number, requirements and scalar target view, compatible special-rule ID and payload, and a derived module seed. `validateAction` narrows browser, replay, bot, or simulation input before `handleAction` receives it. Accepted actions return new serialisable state and generic signals. `createReport` returns the same generic `EncounterReport` used by the run engine. The coordinator calls `createReport` only after `isComplete` succeeds; the selected encounter-outcome policy evaluates it.

Combination Grid owns generated numbered objects, selected IDs, its selection allowance, pair/sequence/tag calculations, and grid actions. Timing Meter owns attempts, motion parameters, accuracy zones, streaks, and timing actions. Neither module imports Phaser.

Timing positions are integer thousandths from **0 through 1000**. Presentation quantises the current marker with `Math.round` when Stop is pressed. The centre is 500. With the normal 100-unit perfect width, distance from centre is classified using inclusive boundaries: perfect `≤ 50`, good `≤ 160`, fair `≤ 300`, otherwise miss. Scores are 30, 20, 12, and 0 respectively. Perfect is centred, non-perfect successful results below/above 500 are early/late, and misses use the missed tag. Motion advances in deterministic 16 ms fixed steps; scoring never reads wall-clock time or Phaser frame count.

The run RNG determines speed and initial direction. Explicitly replaying the same positions against the same generated state yields the identical report. Browser saves occur after a complete Stop transition. A moving marker is uncommitted presentation state: after refresh the current attempt restarts at its generated edge without consuming RNG; all completed attempts and generated parameters remain saved.

## Capabilities and content

Availability can declare `requiredCapabilities`, `forbiddenCapabilities`, and, only when capabilities cannot express the constraint, `supportedModuleIds`. Eligibility is evaluated in authored order before weighted selection so object iteration cannot alter RNG. An empty pool must produce an explicit diagnostic or documented generic fallback without consuming RNG.

Both shipped modules expose `score` and `action`, allowing definitions built around generic `score`, `action-completed`, first/final occurrence, margin, and stored-value signals to work unchanged. Shared examples include Steady Growth, First Echo, Perfect Reward, Target Chaser, and Boss Reader. Grid content can require `selection`, `pair-pattern`, `sequence-pattern`, or `tagged-object`; Timing content can require `accuracy`, `streak`, `perfect-result`, or `early-late`. The effect engine must never check a module ID.

Encounters three and six remain special. The host filters rule definitions by capabilities and passes opaque payloads to the selected module. Combination Grid interprets reduced allowance and tag penalties. Timing Meter demonstrates faster motion and a narrower perfect zone; parameters expire with their owning encounter.

## Minimal third module

```ts
const module: GameplayModule<{ done: boolean }, { type: "finish" }> = {
  id: "example:one-action",
  version: 1,
  displayName: "One Action",
  description: "Complete one explicit action.",
  capabilities: ["score", "action"],
  createEncounter: ({ rng }) => ({ rng, state: { done: false } }),
  handleAction: (state) => ({
    state: { done: true },
    accepted: !state.done,
    signals: [{ type: "action-completed", tags: [], values: {} }],
  }),
  isComplete: (state) => state.done,
  getProgress: (state) => ({
    completedActions: Number(state.done),
    totalActions: 1,
    score: state.done ? 30 : 0,
    status: state.done ? "complete" : "ready",
    metrics: {},
  }),
  createReport: (_state, context) => ({
    encounterId: context.encounterId,
    score: 30,
    tags: ["action-completed"],
    metrics: { actionCount: 1 },
    signals: [],
  }),
  validateState: (value) => {
    if (!value || typeof value !== "object" || !("done" in value))
      throw new Error("Invalid One Action state");
    return value as { done: boolean };
  },
};
```

Register it explicitly beside the other adapters, author capability-compatible content and rules, add a Phaser presenter, and run the generic scenario harness with a bot strategy. No coordinator branch or core or content-package import of the implementation is required.

## Generic creation contract

A module receives `{ encounterId, encounterNumber, target, rules, seed }`. It owns every playable object, allowance, action, threshold, and mechanic-specific modifier in its versioned JSON state. `seed` is obtained by advancing the framework RNG exactly once. Start a module RNG from the seed; never return or independently persist a second authoritative run stream. The coordinator, not the host, stores completed/updated state in `GameplaySessionState` and submits its generic `EncounterReport`.
