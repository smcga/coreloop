import { CONTENT_VERSION, type RunState } from "./engine";
import { FrameworkError, requireSafeNumber } from "./errors";
import type { PolicyReference } from "./policies";

export const SAVE_FORMAT_VERSION = 8;
export const FRAMEWORK_VERSION = "1.0.0";
export const DEFAULT_CONTENT = {
  packId: "core:unspecified",
  packVersion: 1,
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
  start: { id: "core:standard-start", version: 1 },
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
    policies: overrides.policies ?? run.policyReferences,
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
          moduleId: run.gameplayModuleId,
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
  })
  .register({
    fromVersion: 4,
    toVersion: 5,
    migrate: (old) => {
      const run = old.run as Readonly<Record<string, unknown>>;
      return {
        ...old,
        formatVersion: 5,
        run: { ...run, encounterEffects: run.encounterEffects ?? [] },
      };
    },
  })
  .register({
    fromVersion: 5,
    toVersion: 6,
    migrate: (old) => {
      const run = old.run as Readonly<Record<string, unknown>>;
      const encounterNumber =
        typeof run.encounterNumber === "number" ? run.encounterNumber : 0;
      const schedule = Array.from({ length: 6 }, (_, index) => ({
        id: `encounter-${index + 1}`,
        ordinal: index + 1,
        kind: index === 5 ? "special" : "ordinary",
        rules:
          index + 1 === encounterNumber && isRecord(run.currentEncounter)
            ? (run.currentEncounter.rules ?? [])
            : [],
      }));
      return {
        ...old,
        formatVersion: 6,
        policies: {
          ...defaultPolicyReferences,
          ...(isRecord(old.policies) ? old.policies : {}),
        },
        run: {
          ...run,
          loadoutId: run.loadoutId ?? null,
          schedule,
          schedulePosition: encounterNumber > 0 ? encounterNumber - 1 : -1,
          policyReferences: {
            ...defaultPolicyReferences,
            ...(isRecord(old.policies) ? old.policies : {}),
          },
        },
      };
    },
  })
  .register({
    fromVersion: 6,
    toVersion: 7,
    migrate: (old) => {
      const run = old.run as Readonly<Record<string, unknown>>;
      const inventory = isRecord(run.inventory) ? run.inventory : {};
      const modifiers = Array.isArray(inventory.modifiers)
        ? inventory.modifiers
        : [];
      const consumables = Array.isArray(inventory.consumables)
        ? inventory.consumables
        : [];
      const effects = Array.isArray(run.encounterEffects)
        ? run.encounterEffects
        : [];
      const normalize = (value: unknown) =>
        isRecord(value)
          ? {
              ...value,
              destroyed: value.destroyed ?? false,
              temporaryTags: value.temporaryTags ?? [],
              attachmentIds: value.attachmentIds ?? [],
              transformationHistory: value.transformationHistory ?? [],
            }
          : value;
      return {
        ...old,
        formatVersion: 7,
        run: {
          ...run,
          inventory: {
            instances: [...modifiers, ...consumables].map(normalize),
            capacities: {
              "passive-modifier": inventory.modifierCapacity ?? 4,
              consumable: inventory.consumableCapacity ?? 2,
            },
            upgradeIds: [],
          },
          encounterEffects: effects.map(normalize),
        },
      };
    },
  })
  .register({
    fromVersion: 7,
    toVersion: 8,
    migrate: (old) => {
      const run = old.run as Readonly<Record<string, unknown>>;
      return {
        ...old,
        formatVersion: 8,
        run: {
          ...run,
          effects: {
            priceModifier: 0,
            allowances: {},
            encounterTags: [],
            runTags: [],
            nextSignalSequence: 1,
            nextEventSequence: 1,
            diagnostics: [],
          },
        },
      };
    },
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
  validateLegacyDefinitions(parsed, compatibility);
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

function validateLegacyDefinitions(
  value: Record<string, unknown>,
  compatibility?: SaveCompatibility,
): void {
  if (
    !compatibility?.definitionCategories ||
    typeof value.formatVersion !== "number" ||
    value.formatVersion > 6 ||
    !isRecord(value.run) ||
    !isRecord(value.run.inventory)
  )
    return;
  const check = (items: unknown, expected: string) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!isRecord(item) || typeof item.definitionId !== "string") continue;
      const actual = compatibility.definitionCategories!.get(item.definitionId);
      if (!actual)
        throw new FrameworkError(
          "missing-definition",
          `Definition '${item.definitionId}' is unavailable`,
          { definitionId: item.definitionId },
        );
      if (actual !== expected)
        throw new FrameworkError(
          "incompatible-content-version",
          `Definition '${item.definitionId}' changed category from ${expected} to ${actual}`,
          { definitionId: item.definitionId, expected, actual },
        );
    }
  };
  check(value.run.inventory.modifiers, "passive-modifier");
  check(value.run.inventory.consumables, "consumable");
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
  if (!Array.isArray(value.run.encounterEffects)) bad("run.encounterEffects");
  if (
    !isRecord(value.run.effects) ||
    !isRecord(value.run.effects.allowances) ||
    !Array.isArray(value.run.effects.encounterTags) ||
    !Array.isArray(value.run.effects.runTags) ||
    !Array.isArray(value.run.effects.diagnostics)
  )
    bad("run.effects");
  requireSafeNumber(
    value.run.effects.priceModifier,
    "run.effects.priceModifier",
    { integer: true },
  );
  for (const path of ["nextSignalSequence", "nextEventSequence"] as const)
    requireSafeNumber(value.run.effects[path], `run.effects.${path}`, {
      integer: true,
      minimum: 1,
    });
  if (
    !isRecord(value.run.inventory) ||
    !Array.isArray(value.run.inventory.instances) ||
    !isRecord(value.run.inventory.capacities)
  )
    bad("run.inventory");
  if (
    !Array.isArray(value.run.schedule) ||
    (value.run.phase !== "idle" && value.run.schedule.length === 0)
  )
    bad("run.schedule");
  requireSafeNumber(value.run.schedulePosition, "run.schedulePosition", {
    integer: true,
    minimum: -1,
    maximum: value.run.schedule.length - 1,
  });
  value.run.schedule.forEach((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      entry.ordinal !== index + 1 ||
      typeof entry.kind !== "string" ||
      !Array.isArray(entry.rules)
    )
      bad(`run.schedule.${index}`);
  });
  if (!isRecord(value.policies) || !isRecord(value.run.policyReferences))
    bad("policies");
  if (
    JSON.stringify(value.policies) !==
    JSON.stringify(value.run.policyReferences)
  )
    bad("run.policyReferences");
  for (const [key, reference] of Object.entries(value.policies)) {
    if (!isRecord(reference) || typeof reference.id !== "string")
      bad(`policies.${key}`);
    requireSafeNumber(reference.version, `policies.${key}.version`, {
      integer: true,
      minimum: 1,
    });
    if (compatibility?.policies) {
      const versions = compatibility.policies.get(reference.id);
      if (!versions || !versions.includes(reference.version))
        throw new FrameworkError(
          "invalid-policy",
          `Policy '${reference.id}' version ${reference.version} is unavailable`,
          { policyId: reference.id, actual: reference.version },
        );
    }
  }
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
  if (compatibility?.definitionCategories) {
    for (const [index, instance] of value.run.inventory.instances.entries()) {
      if (!isRecord(instance) || typeof instance.definitionId !== "string")
        bad(`run.inventory.instances.${index}`);
      const category = compatibility.definitionCategories.get(
        instance.definitionId,
      );
      if (!category)
        throw new FrameworkError(
          "missing-definition",
          `Definition '${instance.definitionId}' is unavailable`,
          { definitionId: instance.definitionId },
        );
    }
  }
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
