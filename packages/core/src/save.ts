import { CONTENT_VERSION, type RunState } from "./engine";

export const SAVE_FORMAT_VERSION = 1;
export const FRAMEWORK_VERSION = "0.1.0";

export interface SaveFile {
  readonly formatVersion: typeof SAVE_FORMAT_VERSION;
  readonly frameworkVersion: string;
  readonly contentVersion: number;
  readonly savedAt: string;
  readonly run: RunState;
}

export function createSaveFile(
  run: RunState,
  savedAt = new Date().toISOString(),
): SaveFile {
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    frameworkVersion: FRAMEWORK_VERSION,
    contentVersion: CONTENT_VERSION,
    savedAt,
    run,
  };
}

export function parseSaveFile(value: string): SaveFile | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      parsed.formatVersion !== SAVE_FORMAT_VERSION ||
      parsed.contentVersion !== CONTENT_VERSION ||
      typeof parsed.savedAt !== "string" ||
      typeof parsed.frameworkVersion !== "string" ||
      !isRunState(parsed.run)
    )
      return null;
    return parsed as unknown as SaveFile;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isRunState(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.phase !== "string" ||
    typeof value.currency !== "number" ||
    typeof value.encounterNumber !== "number" ||
    typeof value.gameplayModuleId !== "string" ||
    !(
      value.gameplaySession === null || isGameplaySession(value.gameplaySession)
    ) ||
    !isRecord(value.rng) ||
    value.rng.algorithm !== "mulberry32" ||
    typeof value.rng.value !== "number" ||
    !isRecord(value.inventory)
  )
    return false;
  const inventory = value.inventory;
  return (
    Array.isArray(inventory.modifiers) &&
    Array.isArray(inventory.consumables) &&
    typeof inventory.modifierCapacity === "number" &&
    typeof inventory.consumableCapacity === "number"
  );
}
function isGameplaySession(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.moduleId === "string" &&
    Number.isSafeInteger(value.moduleVersion) &&
    typeof value.encounterId === "string" &&
    "data" in value
  );
}
