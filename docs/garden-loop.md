# Garden Loop architecture proof

Garden Loop is a second, independently built game composed as **Garden policies +
Garden content + planting module → headless Core Loop session → Garden UI**. Its
composition root creates the same `createHeadlessRunSession` used by other hosts
and contains no Threshold Lab implementation dependency.

```text
validated Garden content ─┬─→ runtime content provider ─┐
Garden schedule/policies ─┤                            ├─→ headless run session
owned-instance projection ┘                            │       │
planting module ←── encounter context/actions/reports ─┘       ├─→ save/replay
                                                               ├─→ simulation
                                                               └─→ Garden UI
```

The dependency direction is intentional: core receives only generic policy,
content-provider, projection and gameplay-module contracts. Architecture tests
reject application imports from core, and no Garden ID or Garden branch is
required there.

## Deliberately different season

The schedule policy authors five sessions: two ordinary beds, a dry spell, a
fourth ordinary bed, and a final severe storm. Targets and compost rewards come
from Garden policies. The first ordinary failure is recoverable; subsequent
failures end the season. The post-encounter policy routes garden-centre visits
after sessions two and four. Schedule, targets, outcomes, currency, inventory,
offers, RNG and event sequence are run state—not application counters.

Dry Spell demonstrates generic weather vocabulary by applying an encounter
`action` allowance operation; the planting module reads the result as its water
budget. Severe Storm's minimum-resilience payload is mechanic-specific and is
interpreted only by the planting module. Both are versioned schedule rule
references rather than presentation round branches.

## Content, ownership and runtime paths

One validated `garden-loop:season-one` pack supplies runtime definitions,
presentation and terms. There is no second definitions array.

| Concern                                       | Owner         | Runtime path                                   |
| --------------------------------------------- | ------------- | ---------------------------------------------- |
| schedule, targets, routes, compost            | run           | Garden policies → core commands                |
| plants, helpers, supplies, traits, facilities | run instances | content provider → inventory/effects           |
| candidate variation and planting              | module        | owned projection → module RNG → actions        |
| water, resilience and weather penalty         | module        | allowances/rule payload → report               |
| rewards                                       | run           | policy container → open/choice/target commands |
| centre offers and decisions                   | run           | route → provider → buy/reroll/sell/target      |
| labels and compost formatting                 | presentation  | terminology → view model/UI                    |

The balanced loadout creates stable plant instances. Before each encounter the
projection selects live, unattached playable objects, preserves each
`instanceId`, and copies authored growth, water and resilience into module
input. A purchased plant is therefore automatically eligible next session.
Deep Rooted remains an inventory child with a `hostInstanceId`; projection adds
two host resilience while its shared score trigger adds two harvest. Selling the
host removes both identities under generic inventory rules.

Compost Keeper awards currency through the post-result effect transaction. Bee
Friend receives accepted planting signals, accumulates two harvest per resilient
placement, and contributes exactly once during score resolution. Watering Can
becomes a one-encounter effect and contributes three harvest. The score ledger
retains source definition, trigger, track, before/after and amount for UI and
simulation attribution.

## Reward and route lifecycle

On success the reward policy rotates through currency, choice and targeted
containers. `open-reward-container` materialises the payload; choice and target
commands resolve it. `continue` is rejected while a reward remains pending.
Once clear, it follows only `pendingRoute`: sessions two and four enter the
centre, other sessions prepare the next encounter, and terminal routes finish
the season. The reducer also owns purchases, refreshes, capacity rejection,
facilities, attachment targeting and returns.

## Persistence, replay and simulation

Committed commands and planting actions autosave a framework envelope. Import
validates content, gameplay and policy identities; invalid local saves are
removed. New season deletes the envelope.

| Continuation boundary       | Authoritative data preserved                       |
| --------------------------- | -------------------------------------------------- |
| ready after supply          | encounter effect, inventory removal, allowance/RNG |
| active after one planting   | module envelope, stable candidate IDs, actions     |
| unopened/choice reward      | container, generated options and reward RNG        |
| targeted reward/acquisition | option/offer and host decision                     |
| centre after refresh        | offers, refresh count/price, currency and RNG      |
| after buy/trait/facility    | IDs, host links, capacities/upgrades               |
| recoverable first loss      | report/outcome and next route                      |

Replay records gameplay actions and every reward/economy command. Checkpoints
hash state and accumulated events at each input, so verification diagnoses the
first differing planting, reward or shop decision. Simulation constructs the
same configuration, registry, projection, provider and coordinator as the live
page; fixed-seed reports expose offers, acquisitions, triggers and attributed
score contributions.

## Mobile verification

Run `npm run dev --workspace @core-loop/garden-loop -- --host 0.0.0.0` and open
the LAN URL on a phone. Verify portrait and landscape layouts, 48px touch
targets, named plants and stable IDs, projected trait names, score attribution,
both weather sessions, centre refresh/purchase/return, background or refresh
continuation, and save export/import. The page uses no hover-only interaction
and suppresses overscroll during play. Physical-phone verification remains a
human release gate.
