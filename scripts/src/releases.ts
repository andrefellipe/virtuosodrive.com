/**
 * Which Releases an environment keeps (reliability design R2): at least the
 * ten most recent, and always the running one and the previous one, whatever
 * their age. Everything else may be removed.
 */

export const RELEASES_KEPT = 10;

export interface StoredRelease {
  version: string;
  /** When its package was stored, as ISO 8601 text. */
  storedAt: string;
}

export function releasesToRemove(
  stored: readonly StoredRelease[],
  protectedVersions: readonly string[],
  keep: number = RELEASES_KEPT,
): string[] {
  if (!(keep >= 1)) {
    throw new Error(`At least one Release must be kept, got ${keep}`);
  }
  const newestFirst = [...stored].sort((a, b) =>
    b.storedAt.localeCompare(a.storedAt),
  );
  const kept = new Set([
    ...newestFirst.slice(0, keep).map((release) => release.version),
    ...protectedVersions,
  ]);
  return newestFirst
    .map((release) => release.version)
    .filter((version) => !kept.has(version));
}

/**
 * Reads the listing the pipeline pipes in (JSON: an array of
 * { version, storedAt }) and prints the versions to remove, one per line.
 * The versions to protect are given as arguments.
 */
export function pruneListing(
  listingJson: string,
  protectedVersions: readonly string[],
): string[] {
  const listing: unknown = JSON.parse(listingJson);
  if (!Array.isArray(listing)) {
    throw new Error("The listing of stored Releases must be a JSON array");
  }
  const stored = listing.map((item: unknown): StoredRelease => {
    const { version, storedAt } = (item ?? {}) as Record<string, unknown>;
    if (typeof version !== "string" || typeof storedAt !== "string") {
      throw new Error(
        'Every stored Release needs a "version" and a "storedAt"',
      );
    }
    return { version, storedAt };
  });
  return releasesToRemove(stored, protectedVersions);
}
