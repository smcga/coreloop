export const TILE_VALUES = Object.freeze(
  Array.from({ length: 12 }, (_, index) => index + 1),
);
export const SELECTION_LIMIT = 5;

export interface SelectionState {
  readonly selected: ReadonlySet<number>;
  readonly result: number | null;
}

export function initialSelection(): SelectionState {
  return { selected: new Set(), result: null };
}

export function toggleTile(
  state: SelectionState,
  value: number,
): SelectionState {
  const selected = new Set(state.selected);
  if (selected.has(value)) selected.delete(value);
  else if (selected.size < SELECTION_LIMIT) selected.add(value);
  else return state;
  return { selected, result: null };
}

export function selectionSum(state: SelectionState): number {
  return [...state.selected].reduce((sum, value) => sum + value, 0);
}

export function submitSelection(state: SelectionState): SelectionState {
  return { ...state, result: selectionSum(state) };
}

export function resetSelection(): SelectionState {
  return initialSelection();
}
