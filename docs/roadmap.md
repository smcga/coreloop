# Core Loop roadmap

Core Loop is developed in three releases. Each release contains three large delivery issues and must end with a noticeably stronger playable build.

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

## 0.2 — Generic Systems

Tracker: [#11](https://github.com/smcga/coreloop/issues/11)

### [#4 — Trigger/effect pipeline and score ledger](https://github.com/smcga/coreloop/issues/4)

Tangible result: complex modifier chains are visible, ordered and explainable rather than hidden in bespoke handlers.

### [#5 — Generic content and terminology](https://github.com/smcga/coreloop/issues/5)

Tangible result: a much deeper Threshold Lab content pool exercises passive modifiers, consumables, attachments, rewards and theme-specific display language.

### [#6 — Second gameplay module](https://github.com/smcga/coreloop/issues/6)

Tangible result: Timing Lab provides substantially different encounter mechanics while using the same run, shop, economy, content and save systems.

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
