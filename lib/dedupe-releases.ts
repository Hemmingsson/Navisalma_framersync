import type { CisionRelease } from "./cision";

/**
 * Keep first occurrence per `encryptedId` (feed order in `resolveCisionFeeds` determines winner).
 */
export function dedupeReleasesFirstWin(releases: CisionRelease[]): {
  deduped: CisionRelease[];
  duplicateEncryptedIdsDropped: number;
} {
  const seen = new Set<string>();
  const deduped: CisionRelease[] = [];
  for (const r of releases) {
    if (seen.has(r.encryptedId)) continue;
    seen.add(r.encryptedId);
    deduped.push(r);
  }
  return {
    deduped,
    duplicateEncryptedIdsDropped: releases.length - deduped.length,
  };
}
