export const MAX_RUN_SEED = 0xffff_ffff;

export interface SeedLinkSelection {
  readonly seed: number;
  readonly moduleId: string;
  readonly loadoutId?: string;
  readonly policyId?: string;
}

export type SeedLinkResult =
  | { readonly ok: true; readonly selection: SeedLinkSelection }
  | { readonly ok: false; readonly reason: string };

/** Parses a seed link without touching run state or RNG. */
export function parseSeedLink(
  input: string | URL,
  knownModules: ReadonlySet<string>,
  knownLoadouts: ReadonlySet<string>,
): SeedLinkResult | null {
  const url =
    typeof input === "string" ? new URL(input, "https://local.invalid") : input;
  if (!url.searchParams.has("seed")) return null;
  const rawSeed = url.searchParams.get("seed") ?? "";
  if (!/^(0|[1-9]\d{0,9})$/.test(rawSeed))
    return { ok: false, reason: "Seed must be an unsigned 32-bit integer." };
  const seed = Number(rawSeed);
  if (!Number.isSafeInteger(seed) || seed > MAX_RUN_SEED)
    return { ok: false, reason: `Seed must be between 0 and ${MAX_RUN_SEED}.` };
  const moduleId = url.searchParams.get("module") ?? "";
  if (!knownModules.has(moduleId))
    return {
      ok: false,
      reason: `Unknown gameplay module: ${moduleId || "(missing)"}.`,
    };
  const loadoutId = url.searchParams.get("loadout") ?? undefined;
  if (loadoutId && !knownLoadouts.has(loadoutId))
    return {
      ok: false,
      reason: `Unknown or incompatible loadout: ${loadoutId}.`,
    };
  const policyId = url.searchParams.get("policy") ?? undefined;
  return {
    ok: true,
    selection: {
      seed,
      moduleId,
      ...(loadoutId ? { loadoutId } : {}),
      ...(policyId ? { policyId } : {}),
    },
  };
}

export function createSeedLink(
  base: string | URL,
  selection: SeedLinkSelection,
): string {
  const url = new URL(base.toString());
  url.search = "";
  url.searchParams.set("seed", String(selection.seed));
  url.searchParams.set("module", selection.moduleId);
  if (selection.loadoutId) url.searchParams.set("loadout", selection.loadoutId);
  if (selection.policyId) url.searchParams.set("policy", selection.policyId);
  return url.toString();
}
