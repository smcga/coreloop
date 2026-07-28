# Core Loop roadmap

## Current status

The 1.1 architectural integration work is implemented: policies, authored content, economy, effects, gameplay coordination, saves, replay, presentation, and simulation now meet at the same reusable run-session boundary. Threshold Lab, the generated starter, and Garden Loop provide three compositions without application-specific branches in core.

The 1.2 integration acceptance pass makes Garden Loop the end-to-end proof of run-owned content projection, authoritative reward containers and routing, generic gameplay allowances, effect attribution, phase-exact saves, replay and simulation. Stage progression and persistent profile/unlock foundations exist, but expanding Garden's stage or unlock design remains deferred from this proof.

Core Loop is developed in three releases. Each release contains three large delivery issues and must end with a noticeably stronger playable build.

## 1.1 — Architectural integration and second-game proof

Tracker: [#39](https://github.com/smcga/coreloop/issues/39)

The release replaces the remaining parallel application paths with one authoritative framework path:

- run policies own schedules, targets, rewards, pricing, inventory limits, and outcomes;
- authored content providers own inventory, rewards, shop candidates, and upgrades;
- gameplay actions and framework commands execute atomically through the headless session and effect transaction;
- starter and Garden Loop use the same session, persistence, replay, economy, and simulation contracts as Threshold Lab;
- generic encounter results support named score tracks and objective outcomes;
- presentation resolves terminology and locale data without changing authoritative state;
- architecture tests protect the headless core and reusable simulation package from application dependencies.

### Release proof

Threshold Lab retains both gameplay modules on its six-encounter run; the generated starter uses a four-challenge schedule; and Garden Loop uses a five-session season. All three are registered with the generic simulator while core remains unaware of their mechanic, content, and presentation identities.

**Implementation status:** complete across [#29](https://github.com/smcga/coreloop/issues/29)–[#38](https://github.com/smcga/coreloop/issues/38). Physical-phone portrait/landscape smoke testing, release tagging, and closing the tracker remain human release gates.

## 0.1 — Playable Spine

Tracker: [#10](https://github.com/smcga/coreloop/issues/10)

### [#1 — Workspace and touch-first shell](https://github.com/smcga/coreloop/issues/1)

Tangible result: a deployed Threshold Lab page that works on phone and desktop, with a main menu and tappable tile experiment.

Implementation detail is expanded in [`issue-1-brief.md`](issue-1-brief.md).

### [#2 — Deterministic run engine](https://github.com/smcga/coreloop/issues/2)

Tangible result: the playable experiment becomes a complete six-encounter seeded run with targets, rewards, win/loss and an observable command/event log.

### [#3 — Shops, modifiers, bosses and saves](https://github.com/smcga/coreloop/issues/3)

Tangible result: Threshold Lab becomes a small recognisable roguelite with build growth, shops, periodic special rules and refresh-safe continuation.

### Release proof

A player can open a URL on a phone, complete or fail a six-encounter run, purchase an upgrade, see it affect later play, face two special encounters and resume after refresh.

**Implementation status:** complete in the Issue #3 implementation; release acceptance, physical-phone verification, merge, and tagging remain human gates.

## 0.2 — Generic Systems

Tracker: [#11](https://github.com/smcga/coreloop/issues/11)

### [#4 — Trigger/effect pipeline and score ledger](https://github.com/smcga/coreloop/issues/4)

Tangible result: complex modifier chains are visible, ordered and explainable rather than hidden in bespoke handlers.

### [#5 — Generic content and terminology](https://github.com/smcga/coreloop/issues/5)

Tangible result: a much deeper Threshold Lab content pool exercises passive modifiers, consumables, attachments, rewards and theme-specific display language.

### [#6 — Second gameplay module](https://github.com/smcga/coreloop/issues/6)

Tangible result: Timing Lab provides substantially different encounter mechanics while using the same run, shop, economy, content and save systems.

**Implementation status:** implemented; preview and physical-phone acceptance remain human gates before the 0.2 release is tagged manually.

### Release proof

A player can choose between two encounter games and complete the same surrounding run loop in either. Several modifiers work in both without branches in core.

## 1.0 — Starter Kit

Tracker: [#12](https://github.com/smcga/coreloop/issues/12)

### [#7 — Hardening, migrations and replay](https://github.com/smcga/coreloop/issues/7)

Tangible result: runs survive framework evolution, custom policies/effects can live outside core, and deterministic runs can be exported and replayed.

### [#8 — Simulation and inspection tools](https://github.com/smcga/coreloop/issues/8)

Tangible result: developers can inspect one trigger chain or simulate thousands of runs to identify balance problems.

### [#9 — PWA, starter template and third-theme proof](https://github.com/smcga/coreloop/issues/9)

Tangible result: Core Loop is installable where supported, documented, deployable and proven by creating a third themed app without changing core.

### Release proof

A developer can use the template to create and deploy a new mobile-first themed run game while consuming the framework packages as-is.

## Sequencing rule

Complete issues in order unless a tracker explicitly changes the dependency chain. Later work may inform an earlier design, but later-phase systems should not be implemented before their first required playable consumer.

## Success criterion

The project succeeds when starting a new game means implementing its encounter mechanics, content and presentation—not rebuilding the surrounding run loop or fighting assumptions inherited from a previous theme.
