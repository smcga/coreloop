export type FrameworkErrorCode =
  | "malformed-json"
  | "unsupported-save-version"
  | "migration-path-unavailable"
  | "migration-failed"
  | "missing-content-pack"
  | "incompatible-content-version"
  | "missing-definition"
  | "duplicate-id"
  | "invalid-policy"
  | "unknown-policy"
  | "unknown-custom-handler"
  | "unknown-gameplay-module"
  | "incompatible-module-version"
  | "invalid-numeric-value"
  | "invalid-replay"
  | "invalid-replay-action"
  | "replay-divergence"
  | "canonicalisation-failure";

export interface FrameworkErrorDetails {
  readonly path?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly contentPackId?: string;
  readonly definitionId?: string;
  readonly policyId?: string;
  readonly moduleId?: string;
  readonly saveVersion?: number;
  readonly replayVersion?: number;
  readonly migrationStep?: string;
  readonly inputSequence?: number;
}

/** Machine-readable error. Presentation owns localisation and recovery copy. */
export class FrameworkError extends Error {
  constructor(
    readonly code: FrameworkErrorCode,
    message: string,
    readonly details: FrameworkErrorDetails = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FrameworkError";
  }
}

export function requireSafeNumber(
  value: unknown,
  path: string,
  options: { integer?: boolean; minimum?: number; maximum?: number } = {},
): asserts value is number {
  const valid =
    typeof value === "number" &&
    Number.isFinite(value) &&
    (!options.integer || Number.isSafeInteger(value)) &&
    (options.minimum === undefined || value >= options.minimum) &&
    (options.maximum === undefined || value <= options.maximum);
  if (!valid)
    throw new FrameworkError(
      "invalid-numeric-value",
      `Invalid numeric value at ${path}`,
      { path, expected: options, actual: value },
    );
}
