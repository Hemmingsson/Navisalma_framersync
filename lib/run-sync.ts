import {
  fetchFeed,
  fetchRelease,
  normalizeCisionRelease,
  type CisionRelease,
} from "./cision";
import { resolveCisionFeedId } from "./feed-id";
import { syncReleasesToFramer } from "./framer";

export type RunSyncResult = {
  synced: number;
  errors: string[];
  feedItems: number;
  releasesPrepared: number;
};

const DETAIL_CONCURRENCY = 4;

type DetailRow =
  | { ok: true; release: CisionRelease }
  | { ok: false; id: string; error: string };

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export async function runSync(): Promise<RunSyncResult> {
  const feedId = resolveCisionFeedId();
  if (!feedId) {
    return {
      synced: 0,
      errors: ["Set CISION_FEED_ID or CISION_FEED_ID_EN_PRESS in environment."],
      feedItems: 0,
      releasesPrepared: 0,
    };
  }

  const feed = await fetchFeed(feedId);
  const rawItems = feed.Releases ?? [];

  const detailResults = await mapWithConcurrency(
    rawItems,
    DETAIL_CONCURRENCY,
    async (raw): Promise<DetailRow> => {
      const id = raw.EncryptedId?.trim();
      if (!id) {
        return { ok: false, id: "(no-id)", error: "missing EncryptedId" };
      }
      try {
        const detail = await fetchRelease(id).catch(() => null);
        const rel = detail ?? normalizeCisionRelease(raw);
        if (!rel) return { ok: false, id, error: "normalize failed" };
        return { ok: true, release: rel };
      } catch (e) {
        return {
          ok: false,
          id,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
  );

  const releases: CisionRelease[] = [];
  const errors: string[] = [];
  for (const r of detailResults) {
    if (r.ok) releases.push(r.release);
    else errors.push(`Cision ${r.id}: ${r.error}`);
  }

  const fr = await syncReleasesToFramer(releases);
  return {
    synced: fr.synced,
    errors: [...errors, ...fr.errors],
    feedItems: rawItems.length,
    releasesPrepared: releases.length,
  };
}
