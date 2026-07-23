export interface TimingMarkerMotion {
  readonly position: number;
  readonly direction: number;
}

export function advanceTimingMarker(
  position: number,
  direction: number,
  speedTicks: number,
  steps: number,
): TimingMarkerMotion {
  let nextPosition = position + direction * speedTicks * steps;
  let nextDirection = direction;

  while (nextPosition > 1000 || nextPosition < 0) {
    if (nextPosition > 1000) nextPosition = 2000 - nextPosition;
    else nextPosition = -nextPosition;
    nextDirection *= -1;
  }

  return { position: nextPosition, direction: nextDirection };
}
