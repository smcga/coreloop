# Garden Loop architecture proof

Garden Loop is a second, independently built game composed as **Garden policies +
Garden content + planting module → headless Core Loop session → Garden UI**. Its
composition root is `apps/garden-loop/src/configuration.ts`; it creates the same
`createHeadlessRunSession` used by other hosts and contains no Threshold Lab
implementation dependency.

## Deliberately different season

The schedule policy authors five sessions: two ordinary beds, a dry spell, a
fourth ordinary bed, and a final severe storm. Targets and compost rewards come
from Garden policies. The first ordinary failure is a recoverable setback;
subsequent failures end the season. Garden-centre visits occur after sessions
two and four in the presentation, rather than after every successful encounter.
The schedule, current position, targets, outcomes, currency, inventory, offers,
RNG and event sequence are engine state—not application counters.

Weather is represented by versioned schedule rule references. The dry-spell
payload reduces water allowance while severe weather requires combined
resilience. Those payloads are mechanic-specific and are interpreted by the
planting module; generic score, currency, allowance and inventory effects remain
in the shared effect vocabulary. This is the same narrow boundary a versioned
custom handler would use, without needing one for the current rules.

## Content mapping

One validated `garden-loop:season-one` pack supplies presentation and terms as
well as runtime definitions:

- plants are playable objects;
- helpers are passive modifiers reacting to planting/result signals;
- supplies are consumable encounter effects;
- traits are targeted attachments;
- facilities are run upgrades (the larger shed changes generic capacity);
- weather entries are special-encounter rules;
- the garden centre is a deterministic shop pool;
- compost, choice and targeted containers are authored reward content.

The engine-facing provider is generated directly from that registry. There is no
second definitions array and no Garden ID branch in `packages/core`.

## Planting and persistence

Only plant generation, validated choose/place actions, water, growth,
resilience, diversity and the raw harvest report are module-owned. Every live
action goes through `handleGameplayAction`; the UI renders the opaque validated
module envelope and generic run state.

Bee Friend demonstrates action-to-final-score accumulation without changing the
module's raw-report contract. A resilient placement increments a saveable value
on that helper; its final `score` trigger adds the accumulated value to harvest,
attributes the adjustment to Bee Friend in the ledger, and clears it. Tender
placements do not accumulate a bonus, and core does not automatically fold
generic `score-contribution` signals into module reports.

Committed commands and planting actions autosave a framework save envelope.
Continue restores exact module state and deterministic engine state in encounter,
reward or shop phases. The Save tools disclosure provides text export/import;
incompatible content, gameplay or policy identities produce typed framework
errors and the invalid local save is removed. New season deletes the envelope.
The coordinator-compatible deterministic bot is used by headless season tests.

## Mobile verification

Run `npm run dev --workspace @core-loop/garden-loop` and open the shown LAN URL
on a phone. Verify portrait and landscape layouts, 48px touch targets, the dry
spell and severe storm, a garden-centre refresh/purchase/return, background or
refresh continuation, and save export/import. The page uses no hover-only
interaction and suppresses overscroll during play.
