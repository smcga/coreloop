import type {
  EncounterBrief,
  EncounterReport,
  PlayableTile,
} from "@core-loop/core";

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

export function toggleTile(
  state: SelectionState,
  tileId: string,
  limit: number,
): SelectionState {
  const selected = new Set(state.selected);
  if (selected.has(tileId)) selected.delete(tileId);
  else if (selected.size < limit) selected.add(tileId);
  else return state;
  return { selected };
}

export function calculateScore(tiles: readonly PlayableTile[]): ScoreBreakdown {
  const base = tiles.reduce((sum, tile) => sum + tile.value, 0);
  const values = new Map<number, number>();
  const tags = new Map<string, number>();
  for (const tile of tiles) {
    values.set(tile.value, (values.get(tile.value) ?? 0) + 1);
    for (const tag of tile.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
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

export function selectedTiles(
  brief: EncounterBrief,
  state: SelectionState,
): readonly PlayableTile[] {
  return brief.tiles.filter((tile) => state.selected.has(tile.id));
}

export function createEncounterReport(
  brief: EncounterBrief,
  state: SelectionState,
): EncounterReport {
  const chosen = selectedTiles(brief, state);
  const score = calculateScore(chosen);
  return {
    encounterId: brief.id,
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
      cyan: chosen.filter((tile) => tile.tags.includes("cyan")).length,
      amber: chosen.filter((tile) => tile.tags.includes("amber")).length,
      violet: chosen.filter((tile) => tile.tags.includes("violet")).length,
    },
    signals: [],
  };
}
