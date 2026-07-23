# Trigger, effect, and score-ledger runtime

Core's effect runtime is a headless, serialisable interpreter. Content definitions contain typed triggers; run state contains only owned instances and stored values. Threshold Lab submits a `score` signal with gameplay tags and metrics, while core determines which owned definitions react.

## Resolution lifecycle and ordering

`resolveEffects` receives a complete runtime snapshot and a sequenced signal. It discovers active source instances, evaluates conditions, snapshots eligible executions, sorts them, resolves their operations against one working state, and appends emitted signals to the signal queue. It returns state, events, emitted signals, ledger entries, and diagnostics as one atomic value. It never saves.

The complete comparison order is:

1. stage (`gameplay`, additive, multiplicative, encounter rule, post-result);
2. ascending explicit priority (default zero);
3. owned inventory position;
4. lexical instance ID;
5. trigger position in its definition;
6. operation position in the trigger.

Signals are processed by ascending assigned sequence because emitted signals are appended FIFO. No renderer, object-property order, or random tie breaker participates.

Eligibility uses the state at signal discovery. Before an execution begins, its source is checked again: a disabled or destroyed source cannot execute. Completed operations are immediately visible to later executions and signals. A created source does not see the signal that created it, but may see a subsequently emitted signal. Signal emission is deferred to the end of the current signal's execution queue. This makes self-disable and A-destroys-B behaviour predictable.

## Conditions

The discriminated condition vocabulary includes signal type, required/forbidden signal and source tags, numeric comparisons (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`), ordinary/special encounter, scoped first/last occurrence, owned count and stored values through numeric operands, deterministic chance, and nested `all`, `any`, and `not` groups. Empty boolean groups are invalid.

Numeric operands read constants, signal/encounter metrics, score, target, currency, stored instance values, or owned count. There is no expression language. Chance uses integer numerator/denominator weights. Partial chances advance the run's Mulberry32 state exactly once; zero and full chance are exact and do not consume RNG.

## Operations and numeric rules

Generic operations add and multiply score, modify target, gain/lose currency, alter active prices, add/remove scoped tags, update bounded stored values, create/destroy/disable/enable instances, change a named action allowance, emit signals, and retrigger. Currency clamps at zero. Multipliers are integer rationals and floor after every multiplication; the ledger records the mathematical rounding adjustment. Stable instance IDs use the runtime's serialised counter.

Temporary instances declare encounter expiry. `expireEncounterEffects` removes them and clears encounter tags idempotently. Stored values remain on owned instances and therefore survive saves.

Custom operations use `EffectHandlerRegistry`. IDs must be namespaced, duplicate registration throws, and an unknown shipped handler fails validation. A handler receives only the deterministic state, signal, source, and typed custom operation and returns framework values. Ordinary content must use generic operations instead.

## Chaining, retriggers, and safety

Signal emission creates a new sequence, increases depth, retains encounter/action context, and re-evaluates conditions and RNG. Retrigger additionally marks the signal and is limited per source. Central conservative defaults cap depth at 12, signals at 64, retriggers per source at 8, and operations at 256. Crossing a limit stops only the unsafe continuation, preserves the valid working state, and emits both a typed diagnostic and diagnostic runtime event. This avoids recursion and browser freezes.

## Score ledger

Every score operation produces structured attribution: sequence, encounter/action, definition and instance, trigger, operation, label, before/after, additive value or rational multiplier, rounding adjustment, stage, and retrigger marker. Threshold Lab adds gameplay-base and final entries and saves only the latest encounter ledger, so save growth is bounded. Phaser formats these values; it never reconstructs them from the final score.

Scoring stages are gameplay base/pattern score, additive owned or temporary effects, multiplicative effects, encounter rules, and final result. Threshold Lab still owns tile values, pairs, sequences, matching tags, and metrics. Core owns generic reactions and the final score.

## Worked example

A `score` signal has `pair`, `cyan=2`, and base score 30. Cyan Focus and Pair Amplifier match. Cyan Focus is additive and queues before the multiplicative Pair Amplifier regardless of inventory order. It adds 20 and records `30 → 50`. Pair Amplifier applies `3/2`, records `50 → 75`, and the final entry reports 75. On encounter six, the encounter-rule source then subtracts five per cyan tile, recording `75 → 65`, before target comparison.

A straightforward new modifier needs an immutable definition with tags and a trigger such as:

```ts
{
  id: "example-bonus",
  event: "score",
  conditions: { type: "signal-tag", tag: "sequence" },
  operations: [
    { type: "add-score", amount: { from: "constant", value: 8 } },
  ],
}
```

No effect class or Phaser code is required.

## 0.1 migration and persistence

Cyan Focus, Pair Amplifier, Sequence Learner, First Echo, High Risk, Perfect Reward, Score Pulse, and the encounter-six cyan penalty now declare generic triggers/operations. Tile Refresh remains encounter-generation logic because replacing Threshold Lab's gameplay objects is outside the generic core effect vocabulary. The round-three allowance and High Risk's prepared selection limit remain brief preparation rules; their scoring consequences use the pipeline.

The content version is 2. Existing format-version-1 envelopes remain structurally supported, but 0.1 content-version-1 saves are deliberately rejected rather than guessed or silently mutated. Threshold Lab then offers a new run/delete path. Full migrations are Issue #7 work. Definitions remain external; owned IDs, stored values, active brief state, RNG, and the bounded latest ledger are saved. Issue #5's catalogue/authoring platform and Issue #6's second gameplay module remain deferred.
