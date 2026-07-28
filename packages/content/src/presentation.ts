import {
  terminologyKeys,
  type CurrencyPresentation,
  type LocalePresentationPack,
  type Presentation,
  type Term,
  type TerminologyKey,
} from "./model";
import type { ValidationError } from "./registry";

export interface PresentationDiagnostic {
  readonly packId: string;
  readonly locale: string;
  readonly kind: "content" | "module" | "rule" | "track";
  readonly id: string;
}
export interface PresentationSelection {
  readonly selected: LocalePresentationPack;
  readonly fallback: LocalePresentationPack;
  readonly diagnostics: PresentationDiagnostic[];
}

const localeIsValid = (locale: string) => {
  try {
    return Intl.getCanonicalLocales(locale).length === 1;
  } catch {
    return false;
  }
};

export function validatePresentationPacks(
  ownerId: string,
  packs: readonly LocalePresentationPack[],
  defaultId: string,
  references: {
    readonly content?: readonly string[];
    readonly modules?: readonly string[];
    readonly rules?: readonly string[];
  } = {},
): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  const add = (
    pack: LocalePresentationPack | undefined,
    path: string,
    reason: string,
    value?: unknown,
  ) => errors.push({ packId: pack?.id ?? ownerId, path, reason, value });
  const ids = new Set<string>();
  for (const pack of packs) {
    if (ids.has(pack.id))
      add(pack, "id", "duplicate locale presentation ID", pack.id);
    ids.add(pack.id);
    if (!localeIsValid(pack.locale))
      add(pack, "locale", "must be a valid BCP 47 locale", pack.locale);
    for (const key of terminologyKeys) {
      const term = pack.terminology[key];
      if (!term?.singular.trim() || !term.plural.trim())
        add(
          pack,
          `terminology.${key}`,
          "singular and plural must be non-empty",
          term,
        );
    }
    for (const [key, value] of Object.entries(pack.actions))
      if (!value.trim())
        add(pack, `actions.${key}`, "must be non-empty", value);
    for (const [group, required] of Object.entries(references))
      for (const id of required ?? []) {
        const entries = pack[group as "content" | "modules" | "rules"];
        if (!entries[id])
          add(pack, `${group}.${id}`, "missing referenced presentation", id);
      }
    const currency = pack.currency;
    if (currency.display === "code" && !currency.code)
      add(pack, "currency.code", "is required for code display");
    if (currency.display === "symbol" && !currency.symbol)
      add(pack, "currency.symbol", "is required for symbol display");
    if (currency.display === "name" && !currency.nameKey)
      add(pack, "currency.nameKey", "is required for name display");
    if (
      currency.minimumFractionDigits !== undefined &&
      currency.maximumFractionDigits !== undefined &&
      currency.minimumFractionDigits > currency.maximumFractionDigits
    )
      add(
        pack,
        "currency",
        "minimumFractionDigits must not exceed maximumFractionDigits",
        currency,
      );
  }
  if (!ids.has(defaultId))
    add(
      undefined,
      "defaultLocaleId",
      "references missing locale presentation pack",
      defaultId,
    );
  return errors;
}

export function selectPresentation(
  packs: readonly LocalePresentationPack[],
  defaultId: string,
  requestedId: string,
): PresentationSelection {
  const fallback = packs.find((pack) => pack.id === defaultId);
  if (!fallback)
    throw new Error(`Missing default presentation pack '${defaultId}'`);
  return {
    selected: packs.find((pack) => pack.id === requestedId) ?? fallback,
    fallback,
    diagnostics: [],
  };
}

export function resolvePresentation(
  selection: PresentationSelection,
  kind: "content" | "module" | "rule",
  id: string,
): Presentation {
  const collection =
    kind === "module" ? "modules" : kind === "rule" ? "rules" : "content";
  const selected = selection.selected[collection];
  const fallback = selection.fallback[collection];
  const found = selected[id] ?? fallback[id];
  if (found) return found;
  selection.diagnostics.push({
    packId: selection.selected.id,
    locale: selection.selected.locale,
    kind,
    id,
  });
  return {
    name: `[${id}]`,
    description: `Missing ${kind} presentation: ${id}`,
  };
}

export function formatLocalisedTerm(
  pack: LocalePresentationPack,
  key: TerminologyKey,
  count: number,
): string {
  const term: Term = pack.terminology[key];
  return new Intl.PluralRules(pack.locale).select(count) === "one"
    ? term.singular
    : term.plural;
}

export function formatCurrency(
  pack: LocalePresentationPack,
  value: number,
): string {
  const currency: CurrencyPresentation = pack.currency;
  const options = {
    minimumFractionDigits: currency.minimumFractionDigits,
    maximumFractionDigits: currency.maximumFractionDigits,
  };
  if (currency.display === "code")
    return new Intl.NumberFormat(pack.locale, {
      ...options,
      style: "currency",
      currency: currency.code!,
      currencyDisplay: "symbol",
    }).format(value);
  const number = new Intl.NumberFormat(pack.locale, options).format(value);
  if (currency.display === "symbol") return `${currency.symbol}${number}`;
  return `${number} ${formatLocalisedTerm(pack, currency.nameKey!, value)}`;
}

export interface RunProgressViewModel {
  readonly label: string;
  readonly current: number;
  readonly total: number;
  readonly text: string;
}
export const createRunProgressViewModel = (
  pack: LocalePresentationPack,
  current: number,
  total: number,
): RunProgressViewModel => ({
  label: pack.terminology.run.singular,
  current,
  total,
  text: `${pack.terminology.run.singular} ${current}/${total}`,
});
export const createEncounterHeaderViewModel = (
  pack: LocalePresentationPack,
  input: {
    readonly current: number;
    readonly total: number;
    readonly target: number;
    readonly score: number;
    readonly currency: number;
  },
) => ({
  progress: createRunProgressViewModel(pack, input.current, input.total),
  target: `${pack.terminology.target.singular} ${input.target}`,
  score: `${pack.terminology.score.singular} ${input.score}`,
  currency: formatCurrency(pack, input.currency),
});
export const createShopOfferViewModel = (
  selection: PresentationSelection,
  offer: { readonly definitionId: string; readonly price: number },
) => ({
  ...resolvePresentation(selection, "content", offer.definitionId),
  price: formatCurrency(selection.selected, offer.price),
});

export const createInventoryViewModel = (
  selection: PresentationSelection,
  instances: readonly {
    readonly instanceId: string;
    readonly definitionId: string;
    readonly attachmentIds: readonly string[];
    readonly storedValues: Readonly<Record<string, number>>;
  }[],
  capacity?: number,
) => ({
  label: selection.selected.terminology.inventory.singular,
  capacity,
  items: instances.map((instance) => ({
    instanceId: instance.instanceId,
    ...resolvePresentation(selection, "content", instance.definitionId),
    attachmentCount: instance.attachmentIds.length,
    storedValues: instance.storedValues,
  })),
});

export const createAcquisitionTargetViewModel = (
  selection: PresentationSelection,
  pending: {
    readonly definitionId: string;
    readonly targetInstanceIds: readonly string[];
  },
) => ({
  ...resolvePresentation(selection, "content", pending.definitionId),
  targetInstanceIds: pending.targetInstanceIds,
  requiresTarget: pending.targetInstanceIds.length > 0,
});
