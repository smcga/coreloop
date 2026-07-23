import { CONTENT_VERSION, type RunState } from "./engine";
import { FrameworkError, requireSafeNumber } from "./errors";
import type { PolicyReference } from "./policies";

export const SAVE_FORMAT_VERSION = 4;
export const FRAMEWORK_VERSION = "1.0.0";
export const DEFAULT_CONTENT = {
  packId: "threshold-lab:default",
  packVersion: CONTENT_VERSION,
} as const;
export const DEFAULT_GAMEPLAY_VERSION = 1;
export const RNG_VERSION = "mulberry32:1";

export interface SaveEnvelope {
  readonly formatVersion: typeof SAVE_FORMAT_VERSION;
  readonly frameworkVersion: string;
  readonly content: { readonly packId: string; readonly packVersion: number };
  readonly gameplay: {
    readonly moduleId: string;
    readonly moduleVersion: number;
  };
  readonly policies: Readonly<Record<string, PolicyReference>>;
  readonly customEffects: readonly PolicyReference[];
  readonly rngVersion: string;
  readonly savedAt: string;
  readonly run: RunState;
  readonly replay?: { readonly id?: string; readonly inputCount: number };
}
export type SaveFile = SaveEnvelope;
export interface SaveCompatibility {
  readonly contentPacks?: ReadonlyMap<string, readonly number[]>;
  readonly gameplayModules?: ReadonlyMap<string, readonly number[]>;
  readonly policies?: ReadonlyMap<string, readonly number[]>;
  readonly customEffects?: ReadonlyMap<string, readonly number[]>;
  readonly definitionCategories?: ReadonlyMap<string, string>;
}

const defaultPolicyReferences = {
  schedule: { id: "core:six-encounters", version: 1 },
  target: { id: "core:linear-target", version: 1 },
  reward: { id: "core:linear-reward", version: 1 },
  shopGeneration: { id: "core:three-offers", version: 1 },
  shopPricing: { id: "core:base-pricing", version: 1 },
  inventory: { id: "core:standard-inventory", version: 1 },
  content: { id: "core:exact-content", version: 1 },
  outcome: { id: "core:six-win-outcome", version: 1 },
} as const;

export function createSaveFile(
  run: RunState,
  savedAt = new Date().toISOString(),
  overrides: Partial<
    Pick<
      SaveEnvelope,
      "content" | "gameplay" | "policies" | "customEffects" | "replay"
    >
  > = {},
): SaveEnvelope {
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    frameworkVersion: FRAMEWORK_VERSION,
    content: overrides.content ?? DEFAULT_CONTENT,
    gameplay: overrides.gameplay ?? {
      moduleId: run.gameplayModuleId,
      moduleVersion:
        run.gameplaySession?.moduleVersion ?? DEFAULT_GAMEPLAY_VERSION,
    },
    policies: overrides.policies ?? defaultPolicyReferences,
    customEffects: overrides.customEffects ?? [],
    rngVersion: RNG_VERSION,
    savedAt,
    run,
    ...(overrides.replay ? { replay: overrides.replay } : {}),
  };
}

export interface SaveMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(value: Readonly<Record<string, unknown>>): Record<string, unknown>;
}
export class SaveMigrationRegistry {
  private readonly edges = new Map<number, SaveMigration>();
  register(migration: SaveMigration): this {
    requireSafeNumber(migration.fromVersion, "migration.fromVersion", {
      integer: true,
      minimum: 1,
    });
    requireSafeNumber(migration.toVersion, "migration.toVersion", {
      integer: true,
      minimum: 2,
    });
    if (migration.toVersion <= migration.fromVersion)
      throw new FrameworkError(
        "migration-failed",
        "A migration must advance the format version",
        { migrationStep: `${migration.fromVersion}->${migration.toVersion}` },
      );
    if (this.edges.has(migration.fromVersion))
      throw new FrameworkError(
        "duplicate-id",
        `Duplicate migration edge from ${migration.fromVersion}`,
        { migrationStep: `${migration.fromVersion}->${migration.toVersion}` },
      );
    // Strictly advancing edges make cycles impossible; reject edges that jump behind an existing destination too.
    this.edges.set(migration.fromVersion, migration);
    return this;
  }
  migrate(
    value: Readonly<Record<string, unknown>>,
    target = SAVE_FORMAT_VERSION,
  ): Record<string, unknown> {
    let current = structuredClone(value);
    const seen = new Set<number>();
    while (current.formatVersion !== target) {
      const version = current.formatVersion;
      if (!Number.isSafeInteger(version) || typeof version !== "number")
        throw new FrameworkError(
          "unsupported-save-version",
          "Save formatVersion must be a safe integer",
          { actual: version },
        );
      if (seen.has(version))
        throw new FrameworkError(
          "migration-failed",
          "Save migration cycle detected",
          { saveVersion: version },
        );
      seen.add(version);
      const edge = this.edges.get(version);
      if (!edge || edge.toVersion > target)
        throw new FrameworkError(
          "migration-path-unavailable",
          `No save migration path from version ${version} to ${target}`,
          { saveVersion: version },
        );
      try {
        const output = edge.migrate(structuredClone(current));
        current = structuredClone(output);
      } catch (cause) {
        throw new FrameworkError(
          "migration-failed",
          `Save migration ${edge.fromVersion}->${edge.toVersion} failed`,
          { migrationStep: `${edge.fromVersion}->${edge.toVersion}` },
          { cause },
        );
      }
      if (current.formatVersion !== edge.toVersion)
        throw new FrameworkError(
          "migration-failed",
          `Migration ${edge.fromVersion}->${edge.toVersion} returned the wrong version`,
          {
            migrationStep: `${edge.fromVersion}->${edge.toVersion}`,
            expected: edge.toVersion,
            actual: current.formatVersion,
          },
        );
    }
    return current;
  }
}

export const defaultSaveMigrations = new SaveMigrationRegistry()
  .register({
    fromVersion: 1,
    toVersion: 2,
    migrate: (old) => ({
      ...old,
      formatVersion: 2,
      content: {
        packId: "threshold-lab:default",
        packVersion: old.contentVersion ?? CONTENT_VERSION,
      },
    }),
  })
  .register({
    fromVersion: 2,
    toVersion: 3,
    migrate: (old) => {
      const run = old.run as RunState;
      return {
        ...old,
        formatVersion: 3,
        gameplay: {
          moduleId: run.gameplayModuleId ?? "threshold-lab:combination-grid",
          moduleVersion: run.gameplaySession?.moduleVersion ?? 1,
        },
      };
    },
  })
  .register({
    fromVersion: 3,
    toVersion: 4,
    migrate: (old) => ({
      ...old,
      formatVersion: 4,
      policies: defaultPolicyReferences,
      customEffects: [],
      rngVersion: RNG_VERSION,
    }),
  });

export function loadSaveFile(
  text: string,
  compatibility?: SaveCompatibility,
  migrations = defaultSaveMigrations,
): { readonly save: SaveEnvelope; readonly migratedFrom: number | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new FrameworkError(
      "malformed-json",
      "Save is not valid JSON",
      { path: "$" },
      { cause },
    );
  }
  if (!isRecord(parsed))
    throw new FrameworkError(
      "unsupported-save-version",
      "Save root must be an object",
      { path: "$", actual: parsed },
    );
  const originalVersion = parsed.formatVersion;
  const migrated =
    originalVersion === SAVE_FORMAT_VERSION
      ? parsed
      : migrations.migrate(parsed);
  validateSave(migrated, compatibility);
  return {
    save: migrated as unknown as SaveEnvelope,
    migratedFrom:
      originalVersion === SAVE_FORMAT_VERSION
        ? null
        : (originalVersion as number),
  };
}
export function parseSaveFile(text: string): SaveEnvelope | null {
  try {
    return loadSaveFile(text).save;
  } catch {
    return null;
  }
}

function validateSave(
  value: Record<string, unknown>,
  compatibility?: SaveCompatibility,
): void {
  if (value.formatVersion !== SAVE_FORMAT_VERSION)
    throw new FrameworkError(
      "unsupported-save-version",
      `Unsupported save version ${String(value.formatVersion)}`,
      {
        ...(typeof value.formatVersion === "number"
          ? { saveVersion: value.formatVersion }
          : {}),
      },
    );
  if (!isRecord(value.content) || typeof value.content.packId !== "string")
    bad("content.packId");
  requireSafeNumber(value.content.packVersion, "content.packVersion", {
    integer: true,
    minimum: 1,
  });
  if (!isRecord(value.gameplay) || typeof value.gameplay.moduleId !== "string")
    bad("gameplay.moduleId");
  requireSafeNumber(value.gameplay.moduleVersion, "gameplay.moduleVersion", {
    integer: true,
    minimum: 1,
  });
  if (
    !isRecord(value.run) ||
    typeof value.run.phase !== "string" ||
    !isRecord(value.run.rng)
  )
    bad("run");
  requireSafeNumber(value.run.rng.value, "run.rng.value", {
    integer: true,
    minimum: 0,
    maximum: 0xffffffff,
  });
  for (const path of [
    "currency",
    "encounterNumber",
    "nextInstanceId",
    "nextOfferId",
  ] as const)
    requireSafeNumber(value.run[path], `run.${path}`, {
      integer: true,
      minimum: 0,
    });
  const content = value.content as { packId: string; packVersion: number };
  const gameplay = value.gameplay as {
    moduleId: string;
    moduleVersion: number;
  };
  if (compatibility?.contentPacks) {
    const versions = compatibility.contentPacks.get(content.packId);
    if (!versions)
      throw new FrameworkError(
        "missing-content-pack",
        `Content pack '${content.packId}' is not installed`,
        { contentPackId: content.packId },
      );
    if (!versions.includes(content.packVersion))
      throw new FrameworkError(
        "incompatible-content-version",
        `Content pack '${content.packId}' version ${content.packVersion} is unsupported`,
        {
          contentPackId: content.packId,
          expected: versions,
          actual: content.packVersion,
        },
      );
  }
  if (compatibility?.gameplayModules) {
    const versions = compatibility.gameplayModules.get(gameplay.moduleId);
    if (!versions)
      throw new FrameworkError(
        "unknown-gameplay-module",
        `Gameplay module '${gameplay.moduleId}' is not installed`,
        { moduleId: gameplay.moduleId },
      );
    if (!versions.includes(gameplay.moduleVersion))
      throw new FrameworkError(
        "incompatible-module-version",
        `Gameplay module '${gameplay.moduleId}' version ${gameplay.moduleVersion} is unsupported`,
        {
          moduleId: gameplay.moduleId,
          expected: versions,
          actual: gameplay.moduleVersion,
        },
      );
  }
}
function bad(path: string): never {
  throw new FrameworkError(
    "unsupported-save-version",
    `Invalid save property '${path}'`,
    { path },
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
