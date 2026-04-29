/** Framer error → per-feed syncedCount / global-failure flag (pure; covered by unit tests). */

export function countSyncedForFeed(
  releasesFromFeed: { encryptedId: string }[],
  failedEncryptedIds: Set<string>,
): number {
  let n = 0;
  for (const r of releasesFromFeed) {
    if (!failedEncryptedIds.has(r.encryptedId)) n++;
  }
  return n;
}

export function computeGlobalFramerFailure(params: {
  releasesPrepared: number;
  framerSynced: number;
  framerErrorCount: number;
  failedIdsSize: number;
}): boolean {
  return (
    params.releasesPrepared > 0 &&
    params.framerSynced === 0 &&
    params.framerErrorCount > 0 &&
    params.failedIdsSize === 0
  );
}
