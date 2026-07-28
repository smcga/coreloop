import { FrameworkError, requireSafeNumber } from "./errors";

export const PROFILE_FORMAT_VERSION = 1;
export interface PlayerProfile {
  readonly formatVersion: number;
  readonly frameworkVersion: string;
  readonly content: { readonly packId: string; readonly packVersion: number };
  readonly unlockedIds: readonly string[];
  readonly statistics: Readonly<Record<string, number>>;
}
export interface ProfileRunFacts {
  readonly outcome: "won" | "lost" | "abandoned";
  readonly loadoutId: string | null;
  readonly completedEncounterIds: readonly string[];
}
export interface UnlockPolicy {
  readonly id: string;
  readonly version: number;
  evaluate(
    facts: ProfileRunFacts,
    profile: Readonly<PlayerProfile>,
  ): readonly string[];
}
export const createPlayerProfile = (
  content: PlayerProfile["content"],
): PlayerProfile => ({
  formatVersion: PROFILE_FORMAT_VERSION,
  frameworkVersion: "1.0.0",
  content,
  unlockedIds: [],
  statistics: {},
});
const namespaced = (id: string) => /^[a-z0-9-]+:[a-z0-9-]+$/.test(id);
export function applyUnlockPolicy(
  profile: Readonly<PlayerProfile>,
  facts: ProfileRunFacts,
  policy: UnlockPolicy,
): PlayerProfile {
  if (
    !namespaced(policy.id) ||
    !Number.isSafeInteger(policy.version) ||
    policy.version < 1
  )
    throw new FrameworkError(
      "invalid-policy",
      "Unlock policy identity is invalid",
      { policyId: policy.id },
    );
  const additions = policy.evaluate(facts, profile);
  if (additions.some((id) => !namespaced(id)))
    throw new FrameworkError(
      "invalid-profile",
      "Unlock IDs must be namespaced",
    );
  return {
    ...profile,
    unlockedIds: [...new Set([...profile.unlockedIds, ...additions])].sort(),
  };
}
export interface ProfileMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(value: Readonly<Record<string, unknown>>): Record<string, unknown>;
}
export class ProfileMigrationRegistry {
  private readonly edges = new Map<number, ProfileMigration>();
  register(edge: ProfileMigration): this {
    this.edges.set(edge.fromVersion, edge);
    return this;
  }
  migrate(
    value: Readonly<Record<string, unknown>>,
    target = PROFILE_FORMAT_VERSION,
  ): Record<string, unknown> {
    let current = { ...value };
    while (current.formatVersion !== target) {
      requireSafeNumber(current.formatVersion, "profile.formatVersion", {
        integer: true,
        minimum: 1,
      });
      const edge = this.edges.get(current.formatVersion);
      if (!edge)
        throw new FrameworkError(
          "profile-migration-path-unavailable",
          `No profile migration from version ${current.formatVersion}`,
        );
      current = edge.migrate(current);
    }
    return current;
  }
}
export function loadPlayerProfile(
  text: string,
  expectedContent?: PlayerProfile["content"],
  migrations = new ProfileMigrationRegistry(),
): PlayerProfile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new FrameworkError(
      "malformed-json",
      "Profile is not valid JSON",
      {},
      { cause },
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FrameworkError(
      "invalid-profile",
      "Profile root must be an object",
    );
  const migrated = migrations.migrate(value as Record<string, unknown>);
  const p = migrated as unknown as PlayerProfile;
  if (
    !p.content ||
    typeof p.content.packId !== "string" ||
    !Number.isSafeInteger(p.content.packVersion) ||
    !Array.isArray(p.unlockedIds) ||
    p.unlockedIds.some((id) => typeof id !== "string" || !namespaced(id)) ||
    !p.statistics ||
    typeof p.statistics !== "object"
  )
    throw new FrameworkError(
      "invalid-profile",
      "Profile document is malformed",
    );
  if (
    expectedContent &&
    (p.content.packId !== expectedContent.packId ||
      p.content.packVersion !== expectedContent.packVersion)
  )
    throw new FrameworkError(
      "incompatible-profile-content",
      "Profile content pack is incompatible",
      { contentPackId: p.content.packId },
    );
  return p;
}
