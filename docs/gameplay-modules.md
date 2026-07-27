# Gameplay modules

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

`createEncounter` receives the encounter identity, number, target, compatible special-rule ID and payload, and a derived module seed. `validateAction` narrows browser, replay, bot, or simulation input before `handleAction` receives it. Accepted actions return new serialisable state and generic signals. `createReport` returns the same `EncounterReport` used by the run engine: final score, tags, numeric metrics, and signals. The coordinator calls `createReport` only after `isComplete` succeeds. Core compares score and target; it does not calculate patterns or accuracy.

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
