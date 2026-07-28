# Trigger, effect, and score-ledger runtime

Core's effect runtime is a headless, serialisable interpreter. Content definitions contain typed triggers; run state contains owned instances, stored values, persistent effect outputs, and deterministic signal/event counters. Accepted module action signals, report signals, and framework lifecycle facts all enter the same authoritative queue.

## Guaranteed signal envelope and lifecycle names

Every signal has a stable ID and monotonic sequence plus its type, tags, numeric values, encounter context, optional action/source identity, depth, and retrigger metadata. Application-defined signal types must be namespaced. Core also reserves the generic gameplay capability types `score`, `action-completed`, `pattern-completed`, and `score-contribution`.

Framework lifecycle signals use the matching event name, including `run-started`, `encounter-prepared`, `encounter-started`, `encounter-won`, `encounter-lost`, `currency-gained`, `currency-spent`, `shop-entered`, `shop-rerolled`, `item-purchased`, `item-sold`, `consumable-used`, `run-upgrade-applied`, `run-completed`, `run-failed`, `run-abandoned`, and `instance-expired`. Score resolution additionally guarantees `score-calculation-started`, `score`, and `score-calculation-completed`. A report's authored signals run first and in order; result signals run only after the final target and score are known.

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

Generic operations add and multiply score, modify target, gain/lose currency, alter active prices, add/remove scoped tags, update bounded stored values, create/destroy/disable/enable instances, change a named action allowance, emit signals, and retrigger. Currency clamps at zero. Multipliers are integer rationals and floor after every multiplication; the ledger records `after - mathematical` as the rounding adjustment for the operation's scalar or named track (zero for exact multiplication and negative when flooring removes a fraction). Stable instance IDs use the runtime's serialised counter.

Temporary instances declare encounter expiry. `expireEncounterEffects` removes them and clears encounter tags idempotently. Stored values remain on owned instances and therefore survive saves.

Custom operations use an explicitly composed `EffectHandlerRegistry`, supplied as
`RunConfiguration.effectHandlers`. IDs must be namespaced, duplicate registration
throws, and an unknown shipped handler fails when the configured engine is created.
A handler receives cloned deterministic state, signal, source, and the typed custom
operation. Its complete return value is canonical JSON validated before commit.
Returned signals do not keep handler-authored IDs, sequence, source, context, or
depth: the coordinator assigns those fields, appends the signals to the same FIFO
queue, and applies the ordinary depth, signal, retrigger, and operation limits.
Ordinary content must use generic operations instead.

## Chaining, retriggers, and safety

Signal emission creates a new sequence, increases depth, retains encounter/action context, and re-evaluates conditions and RNG. Retrigger additionally marks the signal and is limited per source. Central conservative defaults cap depth at 12, signals at 64, retriggers per source at 8, and operations at 256. Crossing a limit stops only the unsafe continuation, preserves the valid working state, and emits both a typed diagnostic and diagnostic runtime event. This avoids recursion and browser freezes.

## Score ledger

Score operations may name a track and include additive, rational multiply, cap, and minimum operations. Core creates canonically key-sorted base/final rows for every reported track; adjustment rows retain deterministic stage/source order and identify their track. Rational multiplication floors immediately per track. An operation naming an absent track emits a structured diagnostic rather than silently reading zero or creating that track. Numeric operands can explicitly read a raw report track, current resolved track, named target, or named limit.

Every score operation produces structured attribution: sequence, encounter/action, definition and instance, trigger, operation, label, before/after, additive value or rational multiplier, rounding adjustment, stage, and retrigger marker. Threshold Lab adds gameplay-base and final entries and saves only the latest encounter ledger, so save growth is bounded. Phaser formats these values; it never reconstructs them from the final score.

The gameplay report's `score` is always the raw scalar score. Earlier action signals may change stored values, allowances, tags, or currency, but their score operations are not accumulated into that raw value. At completion, core resets the score boundary to the report value, processes report signals, then `score-calculation-started` and `score`; score operations at those stages apply immediately in deterministic trigger order. `NumericValue.from = "score"` therefore means the transaction's current score (raw at calculation start, then adjusted after each operation). Integer-rational multipliers floor immediately. The final target after all target operations determines win/loss. A module that emits `score-contribution` still owns folding those contributions into its raw report, so core never adds them automatically and cannot double-count them.

Consequently, an `add-score` triggered only by an action signal is provisional: it may support immediate presentation and chaining, but report resolution replaces it with the module-authored raw score. Action-triggered final bonuses should instead accumulate an encounter value (for example on the source instance), read and attribute that value from a final `score` trigger, and reset it after applying. Garden Loop's Bee Friend demonstrates this pattern. Persistent action effects such as currency, allowances, tags, stored values, and instance changes survive normally; only score has the explicit module-report boundary.

Price modifiers, allowances, tags, instances, stored values, RNG, diagnostics, and sequence counters are copied back together with score/currency results. Encounter allowances reset to the next module's declared defaults and tags clear when advancing; temporary instances emit `instance-expired` and are removed. Allowance effects accept only finite safe-integer amounts and reserved (`action`, `turn`, `attempt`) or namespaced keys, clamp at zero, and are visible to module creation and every later action. Rejected commands and malformed action/report signals return the original state object without advancing any counter.

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

## Module-specific operations

Prefer generic trigger conditions and operations. Use a generic custom handler only
when generic run/effect state must change in a way the operation vocabulary cannot
express. If an operation changes opaque mechanic state, define a versioned custom
handler reference on the consumable and install a `GameplayOperationHandler` in the
application's `GameplayOperationRegistry` instead. Core must never branch on the
handler, item, module, or rule ID.

The headless session accepts module-local consumables during an active encounter.
It restores the current envelope, invokes the handler with cloned JSON projections,
canonicalises the result, asks the selected module to validate the returned state,
validates emitted module signals, stores the state and processes those signals, and
only then consumes the item. A throw, missing/wrong handler version, unsupported
module, malformed signal, or invalid module state returns the exact original run
state (including RNG and counters).

```ts
const operations = new GameplayOperationRegistry([
  {
    id: "example:replace-object",
    version: 1,
    supportedModuleIds: ["example:grid"],
    apply: ({ gameplay, operation }) => ({
      gameplay: replaceObject(gameplay, operation),
      signals: [
        {
          type: "example:object-replaced",
          tags: [],
          values: { count: 1 },
        },
      ],
    }),
  },
]);

createHeadlessRunSession({ configuration, modules, operations });
```

The content reference must use the same ID and integer version. Record every
installed generic and gameplay-operation reference in save and replay compatibility
metadata; changing code without increasing its version breaks deterministic
compatibility. Handlers are synchronous deterministic adapters: they must not use
Phaser, DOM/storage, wall-clock values, network access, `Math.random()`, mutate host
session objects directly, or return non-serialisable values. Live play, replay, bots,
and simulation should all call `createHeadlessRunSession`, never invoke handlers or
write `GameplaySessionState` themselves.
