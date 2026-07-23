import {
  definitionCategories,
  terminologyKeys,
  type ContentDefinition,
  type ContentPack,
  type DefinitionCategory,
  type TerminologyKey,
  type TerminologyPack,
} from "./model";
export interface ValidationError {
  readonly packId: string;
  readonly definitionId?: string | undefined;
  readonly category?: string | undefined;
  readonly path: string;
  readonly reason: string;
  readonly value?: unknown | undefined;
}
export class ContentValidationError extends Error {
  constructor(readonly errors: readonly ValidationError[]) {
    super(
      errors
        .map(
          (e) =>
            `${e.packId}${e.definitionId ? `/${e.definitionId}` : ""} [${e.path}]: ${e.reason}`,
        )
        .join("\n"),
    );
    this.name = "ContentValidationError";
  }
}
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tagPattern = /^[a-z0-9]+(?:[-:][a-z0-9]+)*$/;
const validNumber = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
export function validateContentPack(
  pack: ContentPack,
  handlers: ReadonlySet<string> = new Set(),
): readonly ValidationError[] {
  const errors: ValidationError[] = [],
    packId = pack?.id || "<missing-pack-id>";
  const add = (
    path: string,
    reason: string,
    value?: unknown,
    d?: ContentDefinition,
  ) =>
    errors.push({
      packId,
      definitionId: d?.id,
      category: d?.category,
      path,
      reason,
      value,
    });
  if (!pack?.id) add("id", "pack ID is required");
  else if (!idPattern.test(pack.id))
    add("id", "must be a namespaced stable ID", pack.id);
  if (!Number.isInteger(pack?.version) || pack.version < 1)
    add("version", "must be a positive integer", pack?.version);
  if (pack?.schemaVersion !== 1)
    add(
      "schemaVersion",
      "unsupported content schema version",
      pack?.schemaVersion,
    );
  const ids = new Map<string, ContentDefinition>(),
    rarityIds = new Set(pack?.rarities?.map((r) => r.id) ?? []);
  for (const [i, d] of (pack?.definitions ?? []).entries()) {
    if (!definitionCategories.includes(d.category)) {
      add(
        `definitions[${i}].category`,
        "invalid category discriminator",
        d.category,
        d,
      );
      continue;
    }
    if (!idPattern.test(d.id))
      add(`definitions[${i}].id`, "must be a namespaced stable ID", d.id, d);
    if (ids.has(d.id))
      add(
        `definitions[${i}].id`,
        "duplicate globally-scoped definition ID",
        d.id,
        d,
      );
    else ids.set(d.id, d);
    if (
      !Array.isArray(d.tags) ||
      d.tags.some((t) => typeof t !== "string" || !tagPattern.test(t))
    )
      add("tags", "tags must be well-formed stable strings", d.tags, d);
    if (!d.presentation?.name || !d.presentation?.description)
      add(
        "presentation",
        "name and description are required",
        d.presentation,
        d,
      );
    if (d.rarity && !rarityIds.has(d.rarity))
      add("rarity", "references an unknown rarity", d.rarity, d);
    if (d.basePrice !== undefined && !validNumber(d.basePrice))
      add("basePrice", "must be finite and non-negative", d.basePrice, d);
    if (d.weight !== undefined && (!validNumber(d.weight) || d.weight === 0))
      add("weight", "must be finite and positive", d.weight, d);
    if ("triggers" in d)
      for (const [ti, t] of (d.triggers ?? []).entries()) {
        if (!t.id || !t.event || !t.operations?.length)
          add(`triggers[${ti}]`, "requires ID, event and operations", t, d);
        for (const [oi, op] of (t.operations ?? []).entries())
          if (op.type === "custom" && !handlers.has(op.handlerId))
            add(
              `triggers[${ti}].operations[${oi}].handlerId`,
              "unknown custom operation ID",
              op.handlerId,
              d,
            );
      }
  }
  const expect = (
    d: ContentDefinition,
    path: string,
    id: string,
    category?: DefinitionCategory,
  ) => {
    const target = ids.get(id);
    if (!target) add(path, "missing referenced definition", id, d);
    else if (category && target.category !== category)
      add(
        path,
        `reference must target ${category}, found ${target.category}`,
        id,
        d,
      );
  };
  for (const d of pack?.definitions ?? []) {
    if (d.category === "encounter") {
      d.playableObjectIds.forEach((id, i) =>
        expect(d, `playableObjectIds[${i}]`, id, "playable-object"),
      );
      d.specialRuleIds?.forEach((id, i) =>
        expect(d, `specialRuleIds[${i}]`, id, "special-encounter-rule"),
      );
      d.rewardContainerIds.forEach((id, i) =>
        expect(d, `rewardContainerIds[${i}]`, id, "reward-container"),
      );
    }
    if (d.category === "shop-pool") {
      if (!d.entries.length)
        add("entries", "weighted pool must not be empty", d.entries, d);
      d.entries.forEach((e, i) => {
        expect(d, `entries[${i}].definitionId`, e.definitionId);
        if (!validNumber(e.weight) || e.weight === 0)
          add(
            `entries[${i}].weight`,
            "must be finite and positive",
            e.weight,
            d,
          );
      });
    }
    if (d.category === "starting-loadout") {
      d.ownedDefinitionIds.forEach((id, i) =>
        expect(d, `ownedDefinitionIds[${i}]`, id),
      );
      d.upgradeIds?.forEach((id, i) =>
        expect(d, `upgradeIds[${i}]`, id, "run-upgrade"),
      );
    }
    if (d.category === "reward-container" && d.poolId)
      expect(d, "poolId", d.poolId, "shop-pool");
    if (d.category === "consumable")
      d.transformationTargets?.forEach((id, i) =>
        expect(d, `transformationTargets[${i}]`, id),
      );
    if (
      d.category === "attached-modifier" &&
      (!d.hostCategories.length ||
        d.hostCategories.some(
          (c) => c !== "playable-object" && c !== "passive-modifier",
        ))
    )
      add(
        "hostCategories",
        "must contain supported host categories",
        d.hostCategories,
        d,
      );
  }
  const terms = new Set(pack?.terminology?.map((t) => t.id) ?? []);
  if (!terms.has(pack?.defaultTerminologyId))
    add(
      "defaultTerminologyId",
      "references missing terminology pack",
      pack?.defaultTerminologyId,
    );
  for (const term of pack?.terminology ?? [])
    for (const key of terminologyKeys) {
      const value = term.terms?.[key];
      if (!value)
        add(
          `terminology.${term.id}.${key}`,
          "required terminology key is missing",
        );
      else if (!value.singular?.trim() || !value.plural?.trim())
        add(
          `terminology.${term.id}.${key}`,
          "singular and plural must be non-empty",
          value,
        );
    }
  return errors;
}
export class ContentRegistry {
  readonly pack: ContentPack;
  private readonly index: ReadonlyMap<string, ContentDefinition>;
  constructor(pack: ContentPack, handlers?: ReadonlySet<string>) {
    const errors = validateContentPack(pack, handlers);
    if (errors.length) throw new ContentValidationError(errors);
    this.pack = deepFreeze(structuredClone(pack));
    this.index = new Map(this.pack.definitions.map((d) => [d.id, d]));
  }
  get(id: string): ContentDefinition {
    const d = this.index.get(id);
    if (!d)
      throw new Error(
        `Content pack ${this.pack.id}: unknown definition '${id}'`,
      );
    return d;
  }
  getAs<C extends DefinitionCategory>(
    id: string,
    category: C,
  ): Extract<ContentDefinition, { category: C }> {
    const d = this.get(id);
    if (d.category !== category)
      throw new Error(
        `Content pack ${this.pack.id}: '${id}' is ${d.category}, expected ${category}`,
      );
    return d as Extract<ContentDefinition, { category: C }>;
  }
  byCategory<C extends DefinitionCategory>(
    category: C,
  ): readonly Extract<ContentDefinition, { category: C }>[] {
    return this.pack.definitions.filter(
      (d) => d.category === category,
    ) as unknown as readonly Extract<ContentDefinition, { category: C }>[];
  }
  byTag(tag: string): readonly ContentDefinition[] {
    return this.pack.definitions.filter((d) => d.tags.includes(tag));
  }
  terminology(id = this.pack.defaultTerminologyId): TerminologyPack {
    const term = this.pack.terminology.find((t) => t.id === id);
    if (!term)
      throw new Error(
        `Content pack ${this.pack.id}: unknown terminology '${id}'`,
      );
    return term;
  }
}
function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}
export function formatTerm(
  pack: TerminologyPack,
  key: TerminologyKey,
  count = 1,
): string {
  return count === 1 ? pack.terms[key].singular : pack.terms[key].plural;
}
