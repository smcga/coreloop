import type { EncounterReport } from "@core-loop/core";

export interface PlayableObject {
  readonly id: string;
  readonly value: number;
  readonly tags: readonly string[];
}
export interface SelectionEncounter {
  readonly id: string;
  readonly objects: readonly PlayableObject[];
}

export interface SelectionState {
  readonly selected: ReadonlySet<string>;
}

export interface ScoreBreakdown {
  readonly base: number;
  readonly pairBonus: number;
  readonly sequenceBonus: number;
  readonly matchingTagBonus: number;
  readonly total: number;
}

export function initialSelection(): SelectionState {
  return { selected: new Set() };
}

export function toggleObject(
  state: SelectionState,
  objectId: string,
  limit: number,
): SelectionState {
  const selected = new Set(state.selected);
  if (selected.has(objectId)) selected.delete(objectId);
  else if (selected.size < limit) selected.add(objectId);
  else return state;
  return { selected };
}

export function calculateScore(
  objects: readonly PlayableObject[],
): ScoreBreakdown {
  const base = objects.reduce((sum, object) => sum + object.value, 0);
  const values = new Map<number, number>();
  const tags = new Map<string, number>();
  for (const object of objects) {
    values.set(object.value, (values.get(object.value) ?? 0) + 1);
    for (const tag of object.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  const pairBonus = [...values.values()].some((count) => count >= 2) ? 8 : 0;
  const unique = [...values.keys()].sort((a, b) => a - b);
  let longest = unique.length === 0 ? 0 : 1;
  let current = longest;
  for (let index = 1; index < unique.length; index += 1) {
    current = unique[index]! === unique[index - 1]! + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  const sequenceBonus = longest >= 3 ? 12 : 0;
  const matchingTagBonus = [...tags.values()].some((count) => count >= 3)
    ? 10
    : 0;
  return {
    base,
    pairBonus,
    sequenceBonus,
    matchingTagBonus,
    total: base + pairBonus + sequenceBonus + matchingTagBonus,
  };
}

export function selectedObjects(
  encounter: SelectionEncounter,
  state: SelectionState,
): readonly PlayableObject[] {
  return encounter.objects.filter((object) => state.selected.has(object.id));
}

export function createEncounterReport(
  encounter: SelectionEncounter,
  state: SelectionState,
): EncounterReport {
  const chosen = selectedObjects(encounter, state);
  const score = calculateScore(chosen);
  return {
    encounterId: encounter.id,
    score: score.total,
    tags: [
      ...(score.pairBonus ? ["pair"] : []),
      ...(score.sequenceBonus ? ["sequence"] : []),
      ...(score.matchingTagBonus ? ["matching-tag"] : []),
    ],
    metrics: {
      base: score.base,
      pairBonus: score.pairBonus,
      sequenceBonus: score.sequenceBonus,
      matchingTagBonus: score.matchingTagBonus,
      firstValue: chosen[0]?.value ?? 0,
      cyan: chosen.filter((object) => object.tags.includes("cyan")).length,
      amber: chosen.filter((object) => object.tags.includes("amber")).length,
      violet: chosen.filter((object) => object.tags.includes("violet")).length,
    },
    signals: [],
  };
}
