import type { FieldDataInput } from "framer-api";

export type CisionSyncRelease = {
  encryptedId: string;
  fieldData: FieldDataInput;
  sourceFeedLabel: string;
};

/**
 * When the same release appears in overlapping Cision feeds, keep the **first**
 * occurrence in merge order (see `resolveCisionFeeds` order).
 */
export function dedupeReleasesFirstWin(
  releases: CisionSyncRelease[],
): {
  deduped: CisionSyncRelease[];
  duplicateEncryptedIdsDropped: number;
} {
  const winnerById = new Map<string, CisionSyncRelease>();
  const firstIndex = new Map<string, number>();
  for (let i = 0; i < releases.length; i++) {
    const r = releases[i]!;
    if (!firstIndex.has(r.encryptedId)) firstIndex.set(r.encryptedId, i);
    if (!winnerById.has(r.encryptedId)) winnerById.set(r.encryptedId, r);
  }

  const deduped = Array.from(winnerById.entries())
    .sort(
      (a, b) =>
        (firstIndex.get(a[0]) ?? 0) - (firstIndex.get(b[0]) ?? 0),
    )
    .map(([, r]) => r);

  return {
    deduped,
    duplicateEncryptedIdsDropped: releases.length - deduped.length,
  };
}
