# Gameplay modules

Gameplay modules are headless adapters between a game's encounter mechanic and the reusable run. The application explicitly constructs a `GameplayModuleRegistry`; there is no import-time or global registration. A module declares a stable namespaced ID, positive version, display metadata, unique stable capabilities, deterministic encounter creation, legal action handling, progress, completion, report creation, state validation, and an optional bot strategy.

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

Issue #6 raises the content/save compatibility version to 3. Earlier envelopes have no selected module identity and are deliberately rejected rather than guessing Combination Grid; migration remains Issue #7 scope.

## Actions, signals, reports, and deterministic state

`createEncounter` receives the encounter identity, number, target, compatible special-rule ID and payload, and current serialisable RNG. It returns state plus the advanced RNG. `handleAction` receives an explicit action rather than browser input. Accepted actions return new serialisable state and generic signals. `createReport` returns the same `EncounterReport` used by the run engine: final score, tags, numeric metrics, and signals. Core compares score and target; it does not calculate patterns or accuracy.

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

Register it explicitly beside the other adapters, author capability-compatible content and rules, add a Phaser presenter, and run the generic scenario harness with a bot strategy. No core or content-package import of the implementation is required.
