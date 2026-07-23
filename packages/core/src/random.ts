/** Serialisable state for the Mulberry32 32-bit pseudo-random generator. */
export interface RandomState {
  readonly algorithm: "mulberry32";
  readonly value: number;
}

export interface RandomResult {
  readonly state: RandomState;
  /** An unsigned 32-bit integer. */
  readonly value: number;
}

export function createRandom(seed: number): RandomState {
  return { algorithm: "mulberry32", value: seed >>> 0 };
}

/**
 * Advances Mulberry32 once. Keeping this implementation explicit and covered by
 * vectors makes seeded runs stable across runtime and dependency changes.
 */
export function nextUint32(state: Readonly<RandomState>): RandomResult {
  const next = (state.value + 0x6d2b79f5) >>> 0;
  let mixed = next;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return {
    state: { algorithm: "mulberry32", value: next },
    value: (mixed ^ (mixed >>> 14)) >>> 0,
  };
}

export function randomInteger(
  state: Readonly<RandomState>,
  minimum: number,
  maximum: number,
): RandomResult {
  if (!Number.isInteger(minimum) || maximum < minimum) {
    throw new RangeError("Random integer bounds must be ordered integers");
  }
  const next = nextUint32(state);
  return {
    state: next.state,
    value: minimum + (next.value % (maximum - minimum + 1)),
  };
}
