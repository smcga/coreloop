# Threshold Lab test-bed specification

Threshold Lab is the playable verification game developed alongside Core Loop. It should remain simple enough to understand immediately and rich enough to expose framework behaviour.

## Design purpose

Threshold Lab exists to answer three questions continuously:

1. Is the current framework build actually playable?
2. Can a human observe the feature just added?
3. Is the implementation generic enough to survive later gameplay modules?

It is not intended to become the flagship game, and visual polish should not delay framework progress. It should nevertheless feel coherent and pleasant enough that repeated phone testing is realistic.

## Core encounter concept

The initial encounter presents a grid of numbered tiles.

- Tiles have a numeric value.
- Tiles may later have generic tags such as colour, shape or family.
- The player taps tiles to select or deselect them.
- A selection limit constrains each attempt.
- Submitting the selection produces a score.
- Later releases add bonuses for pairs, sequences and matching tags.
- The player must meet or exceed an encounter target.

The mechanic is intentionally transparent: testers can predict a basic score and immediately recognise modifier effects.

## Phase 1 progression

A complete 0.1 run contains six encounters.

```text
Encounter 1
→ reward/shop
→ Encounter 2
→ reward/shop
→ Special Encounter 3
→ reward/shop
→ Encounter 4
→ reward/shop
→ Encounter 5
→ reward/shop
→ Special Encounter 6
→ run victory
```

Failure handling may begin as immediate run failure. The framework can support more varied life/loss policies later through configuration.

## Issue #1 playable slice

Issue #1 deliberately stops before the real run engine.

Required visible behaviour:

- a main menu with a clear start button;
- a game screen containing twelve numbered tiles in a responsive grid;
- tap/click selection and deselection;
- a visible selection limit of five;
- a live sum of selected values;
- a submit button that shows a simple result message;
- a reset button that clears the selection;
- a route back to the main menu;
- touch-friendly portrait and landscape layouts.

Temporary state may live inside the Threshold Lab app for this issue. It must be straightforward to replace with the headless command/event engine in Issue #2.

Suggested first grid:

```text
1  2  3  4
5  6  7  8
9 10 11 12
```

Do not implement shops, boss rules, modifiers, content schemas or saving in Issue #1.

## Issue #2 playable slice

Issue #2 replaces temporary progression state with the first framework engine.

The encounter module should produce an `EncounterReport`; the run engine should own:

- seeded run creation;
- encounter sequence;
- target values;
- pass/fail resolution;
- currency rewards;
- advancing or ending the run.

At that stage, add simple scoring patterns:

- base sum of selected tiles;
- pair bonus for matching a basic tag;
- sequence bonus for consecutive values;
- set bonus for several matching tags.

The exact balance is less important than clear, deterministic presentation.

## Issue #3 playable slice

Issue #3 completes the recognisable loop with:

- shops between won encounters;
- currency and rerolls;
- owned passive modifiers;
- simple consumables;
- special rules on encounters three and six;
- save, refresh and resume;
- run victory and defeat screens.

Suggested starter content:

- +10 score for each tile with a specified tag;
- pairs multiply score by 1.5;
- gain currency after a perfect encounter;
- permanently gain value after completing a sequence;
- retrigger the first selected tile;
- lose one selection slot but double final score.

## Presentation principles

- Touch targets should be at least comfortably thumb-sized.
- Important controls cannot rely on hover.
- Selected tiles need more than colour alone to indicate state.
- The current target, score/sum, selection count and major result must be readable without zooming.
- Avoid tiny debug text in the main play flow.
- Prevent accidental page scrolling or browser gestures from disrupting active play where practical.
- Preserve browser accessibility semantics where Phaser/HTML integration allows it.

## Visual direction

Use a restrained laboratory/prototype theme:

- dark or neutral background;
- high-contrast panels;
- numbered geometric tiles;
- simple pulse/scale feedback on selection;
- concise result messages;
- minimal particles only when they clarify an event.

No external art assets are required for the first release. Generated shapes and text are sufficient.

## Human verification script for Issue #1

1. Open the deployed URL on a desktop browser.
2. Start Threshold Lab.
3. Select and deselect several tiles.
4. Verify no more than five can be selected.
5. Submit and confirm the displayed sum matches the selected values.
6. Reset and verify all state clears.
7. Repeat on a physical phone in portrait orientation.
8. Rotate to landscape and confirm controls remain accessible.
9. Confirm no essential interaction requires a mouse hover.

## Future second module

Phase 2 introduces Timing Lab, where a moving marker is stopped by tapping. This module must use the same surrounding run systems while emitting different gameplay signals.

Threshold Lab should therefore avoid leaking concepts such as tile coordinates, grid matches or selected numbers into `packages/core`.
