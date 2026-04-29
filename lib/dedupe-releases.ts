import type { ContentType } from "./feed-id";
import type { CisionRelease } from "./cision";

/**
 * When the same release appears in overlapping Cision feeds (e.g. “all” vs “press”),
 * prefer the most specific category so Framer’s Content Type matches intent.
 * Tie-break: earlier row in `releases` wins (stable feed merge order).
 */
const CONTENT_TYPE_PRIORITY: Record<ContentType, number> = {
  deck: 4,
  financial: 3,
  press: 2,
  other: 1,
};

function pickWinner(a: CisionRelease, b: CisionRelease): CisionRelease {
  const pa = CONTENT_TYPE_PRIORITY[a.contentType];
  const pb = CONTENT_TYPE_PRIORITY[b.contentType];
  if (pb > pa) return b;
  if (pa > pb) return a;
  return a;
}

/**
 * One release per `encryptedId`. Overlapping feeds: winner is the **most specific**
 * `contentType` (deck → financial → press → other), not merely first listed feed.
 */
export function dedupeReleasesFirstWin(releases: CisionRelease[]): {
  deduped: CisionRelease[];
  duplicateEncryptedIdsDropped: number;
} {
  const winnerById = new Map<string, CisionRelease>();
  const firstIndex = new Map<string, number>();
  for (let i = 0; i < releases.length; i++) {
    const r = releases[i]!;
    if (!firstIndex.has(r.encryptedId)) firstIndex.set(r.encryptedId, i);
    const prev = winnerById.get(r.encryptedId);
    if (!prev) winnerById.set(r.encryptedId, r);
    else winnerById.set(r.encryptedId, pickWinner(prev, r));
  }

  const deduped = Array.from(winnerById.entries())
    .sort((a, b) => firstIndex.get(a[0])! - firstIndex.get(b[0])!)
    .map(([, r]) => r);

  return {
    deduped,
    duplicateEncryptedIdsDropped: releases.length - deduped.length,
  };
}
