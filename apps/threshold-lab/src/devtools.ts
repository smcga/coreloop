import { canonicalJson, type RunState } from "@core-loop/core";
import {
  isDefinitionCompatible,
  thresholdLabContentPack,
  validateContentPack,
  type ContentDefinition,
} from "@core-loop/content";
import { gameplayModules } from "./gameplay/modules";

export interface ContentFilters {
  readonly text?: string;
  readonly category?: string;
  readonly rarity?: string;
  readonly tag?: string;
  readonly moduleId?: string;
  readonly capability?: string;
  readonly availability?: "all" | "available" | "restricted";
  readonly validation?: "all" | "valid" | "invalid";
  readonly customHandler?: boolean;
}
export interface ContentBrowserRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly rarity: string;
  readonly price: number | null;
  readonly tags: readonly string[];
  readonly compatibleModules: readonly string[];
  readonly valid: boolean;
}
const usesCustomHandler = (definition: ContentDefinition) =>
  "triggers" in definition &&
  Boolean(
    definition.triggers?.some((trigger) =>
      trigger.operations.some((operation) => operation.type === "custom"),
    ),
  );
export function contentBrowserRows(
  filters: ContentFilters = {},
): readonly ContentBrowserRow[] {
  const text = filters.text?.trim().toLowerCase();
  const errors = validateContentPack(thresholdLabContentPack);
  return thresholdLabContentPack.definitions
    .map((definition) => {
      const compatibleModules = gameplayModules
        .list()
        .filter((module) => isDefinitionCompatible(definition, module))
        .map((module) => module.id);
      return {
        id: definition.id,
        name: definition.presentation.name,
        category: definition.category,
        rarity: definition.rarity ?? "—",
        price: definition.basePrice ?? null,
        tags: definition.tags,
        compatibleModules,
        valid: !errors.some((error) => error.definitionId === definition.id),
      };
    })
    .filter((row) => {
      const definition = thresholdLabContentPack.definitions.find(
        (item) => item.id === row.id,
      )!;
      return (
        (!text ||
          `${row.name} ${row.id} ${definition.presentation.description}`
            .toLowerCase()
            .includes(text)) &&
        (!filters.category || row.category === filters.category) &&
        (!filters.rarity || row.rarity === filters.rarity) &&
        (!filters.tag || row.tags.includes(filters.tag)) &&
        (!filters.moduleId ||
          row.compatibleModules.includes(filters.moduleId)) &&
        (!filters.capability ||
          definition.availability?.requiredCapabilities?.includes(
            filters.capability,
          )) &&
        (!filters.availability ||
          filters.availability === "all" ||
          (filters.availability === "restricted") ===
            Boolean(definition.availability)) &&
        (!filters.validation ||
          filters.validation === "all" ||
          (filters.validation === "valid") === row.valid) &&
        (filters.customHandler === undefined ||
          filters.customHandler === usesCustomHandler(definition))
      );
    })
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.id.localeCompare(b.id),
    );
}

export function definitionDetail(id: string) {
  const definition = thresholdLabContentPack.definitions.find(
    (item) => item.id === id,
  );
  if (!definition) throw new Error(`Unknown content definition '${id}'`);
  const poolMembership = thresholdLabContentPack.definitions
    .filter(
      (item) =>
        item.category === "shop-pool" &&
        item.entries.some((entry) => entry.definitionId === id),
    )
    .map((item) => item.id);
  const loadoutInclusion = thresholdLabContentPack.definitions
    .filter(
      (item) =>
        item.category === "starting-loadout" &&
        item.ownedDefinitionIds.includes(id),
    )
    .map((item) => item.id);
  return {
    pack: `${thresholdLabContentPack.id}@${thresholdLabContentPack.version}`,
    definition,
    poolMembership,
    loadoutInclusion,
    validationWarnings: validateContentPack(thresholdLabContentPack).filter(
      (error) => error.definitionId === id,
    ),
    formattedJson: canonicalJson(JSON.parse(JSON.stringify(definition))),
  };
}

export function inspectorViewModel(run: RunState) {
  return {
    identity: {
      seed: run.seed,
      rng: { algorithm: "mulberry32", version: 1, state: run.rng.value },
      phase: run.phase,
      encounter: run.encounterNumber,
      module: run.gameplayModuleId,
      content: `${thresholdLabContentPack.id}@${thresholdLabContentPack.version}`,
      saveFormat: 4,
    },
    encounter: run.currentEncounter,
    moduleState: run.gameplaySession?.data ?? null,
    inventory: [...run.inventory.modifiers, ...run.inventory.consumables].map(
      (item) => ({
        ...item,
        name:
          thresholdLabContentPack.definitions.find((definition) =>
            definition.id.endsWith(item.definitionId),
          )?.presentation.name ?? item.definitionId,
      }),
    ),
    shop: run.shop,
    recent: { report: run.lastReport, ledger: run.scoreLedger },
    canonicalState: canonicalJson(run),
  };
}

export const developmentToolsEnabled = (
  viteDevelopment: boolean,
  query: string,
): boolean => viteDevelopment && new URLSearchParams(query).get("dev") === "1";
