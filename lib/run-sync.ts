import {
  fetchFeed,
  fetchRelease,
  normalizeCisionRelease,
  type CisionRelease,
  type CisionReleaseRaw,
  type FeedNormalizeContext,
  feedNormalizeContext,
} from "./cision";
import { dedupeReleasesFirstWin } from "./dedupe-releases";
import type { ContentType } from "./feed-id";
import {
  MISSING_CISION_FEED_ENV_MESSAGE,
  resolveCisionFeeds,
} from "./feed-id";
import {
  categorizeSyncError,
  errorMessage,
  isRetryableFetchOrNetworkError,
  withRetry,
  withTimeout,
} from "./retry-utils";
import { encryptedIdFromFramerErrorLine } from "./sync-errors";
import { syncReleasesToFramer } from "./framer";

export type FeedSyncResult = {
  feedLabel: string;
  contentType: ContentType;
  /** Rows returned by Cision list API for this feed. */
  releaseCount: number;
  /** Rows kept for this feed after global dedupe (most specific content type wins per `encryptedId`; see `dedupe-releases.ts`). */
  preparedCount: number;
  syncedCount: number;
  errors: string[];
  /** Detail API unavailable or empty — list row used instead (per row). */
  listFallbackCount: number;
};

export type RunSyncResult = {
  ok: boolean;
  hasErrors: boolean;
  synced: number;
  errors: string[];
  feedItems: number;
  /** Distinct releases passed to Framer after dedupe. */
  releasesPrepared: number;
  duplicateEncryptedIdsDropped: number;
  feedResults: FeedSyncResult[];
  /** Framer error lines that could not be mapped to a feed label. */
  framerErrorsUnattributed: string[];
};

const DETAIL_CONCURRENCY = 4;
const CISION_LIST_TIMEOUT_MS = 60_000;
const CISION_DETAIL_TIMEOUT_MS = 60_000;

type DetailRow =
  | { ok: true; release: CisionRelease; listFallback: boolean }
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

function countSyncedForFeed(
  releasesFromFeed: CisionRelease[],
  failedEncryptedIds: Set<string>,
): number {
  let n = 0;
  for (const r of releasesFromFeed) {
    if (!failedEncryptedIds.has(r.encryptedId)) n++;
  }
  return n;
}

async function detailRowFromListRelease(
  raw: CisionReleaseRaw,
  ctx: FeedNormalizeContext,
  feedLabel: string,
): Promise<DetailRow> {
  const id = raw.EncryptedId?.trim();
  if (!id) {
    return { ok: false, id: "(no-id)", error: "missing EncryptedId" };
  }
  try {
    const detail = await withRetry(
      () =>
        withTimeout(
          CISION_DETAIL_TIMEOUT_MS,
          fetchRelease(id, ctx),
          `Cision detail ${feedLabel} ${id}`,
        ),
      { isRetryable: isRetryableFetchOrNetworkError },
    ).catch(() => null);

    if (detail) {
      return { ok: true, release: detail, listFallback: false };
    }

    const rel = normalizeCisionRelease(raw, ctx);
    if (!rel) return { ok: false, id, error: "normalize failed" };
    return { ok: true, release: rel, listFallback: true };
  } catch (e) {
    const fallback = normalizeCisionRelease(raw, ctx);
    if (fallback) return { ok: true, release: fallback, listFallback: true };
    return { ok: false, id, error: errorMessage(e) };
  }
}

export async function runSync(): Promise<RunSyncResult> {
  const feeds = resolveCisionFeeds();

  if (feeds.length === 0) {
    const msg = categorizeSyncError("config", MISSING_CISION_FEED_ENV_MESSAGE);
    console.log(
      JSON.stringify({
        event: "cision_sync_run",
        feedCount: 0,
        synced: 0,
        hasErrors: true,
        errors: [msg],
      }),
    );
    return {
      ok: true,
      hasErrors: true,
      synced: 0,
      errors: [msg],
      feedItems: 0,
      releasesPrepared: 0,
      duplicateEncryptedIdsDropped: 0,
      feedResults: [],
      framerErrorsUnattributed: [],
    };
  }

  const allReleases: CisionRelease[] = [];
  const feedResults: FeedSyncResult[] = [];
  let feedItemsTotal = 0;

  for (const feed of feeds) {
    const ctx = feedNormalizeContext(feed);

    const feedRow: FeedSyncResult = {
      feedLabel: feed.feedLabel,
      contentType: feed.contentType,
      releaseCount: 0,
      preparedCount: 0,
      syncedCount: 0,
      errors: [],
      listFallbackCount: 0,
    };

    try {
      const feedResponse = await withRetry(
        () =>
          withTimeout(
            CISION_LIST_TIMEOUT_MS,
            fetchFeed(feed.feedId),
            `Cision list ${feed.feedLabel}`,
          ),
        { isRetryable: isRetryableFetchOrNetworkError },
      );
      const rawItems = feedResponse.Releases ?? [];
      feedRow.releaseCount = rawItems.length;
      feedItemsTotal += rawItems.length;

      const detailResults = await mapWithConcurrency(
        rawItems,
        DETAIL_CONCURRENCY,
        (raw) => detailRowFromListRelease(raw, ctx, feed.feedLabel),
      );

      const releasesFromFeed: CisionRelease[] = [];
      for (const r of detailResults) {
        if (r.ok) {
          if (r.listFallback) feedRow.listFallbackCount++;
          releasesFromFeed.push(r.release);
          allReleases.push(r.release);
        } else {
          feedRow.errors.push(
            categorizeSyncError(
              "cision_detail_failed",
              `${feed.feedLabel} ${r.id}: ${r.error}`,
            ),
          );
        }
      }
      feedRow.preparedCount = releasesFromFeed.length;
    } catch (e) {
      const msg =
        e instanceof Error && /timed out/i.test(e.message)
          ? categorizeSyncError(
              "timeout",
              `${feed.feedLabel}: ${e.message}`,
            )
          : categorizeSyncError(
              "cision_fetch_failed",
              `${feed.feedLabel}: ${errorMessage(e)}`,
            );
      feedRow.errors.push(msg);
    }

    console.log(
      JSON.stringify({
        event: "cision_feed_complete",
        feedLabel: feed.feedLabel,
        contentType: feed.contentType,
        releaseCount: feedRow.releaseCount,
        preparedCount: feedRow.preparedCount,
        listFallbackCount: feedRow.listFallbackCount,
        feedErrors: feedRow.errors.length,
      }),
    );

    feedResults.push(feedRow);
  }

  const { deduped, duplicateEncryptedIdsDropped } =
    dedupeReleasesFirstWin(allReleases);

  for (const row of feedResults) {
    row.preparedCount = deduped.filter(
      (r) => r.sourceFeedLabel === row.feedLabel,
    ).length;
  }

  const releasesPrepared = deduped.length;

  const framerSync = await syncReleasesToFramer(deduped);

  const idToFeedLabel = new Map(
    deduped.map((r) => [r.encryptedId, r.sourceFeedLabel] as const),
  );

  const framerErrorsUnattributed: string[] = [];
  for (const line of framerSync.errors) {
    const id = encryptedIdFromFramerErrorLine(line);
    if (!id) {
      framerErrorsUnattributed.push(line);
      continue;
    }
    const label = idToFeedLabel.get(id);
    if (!label) {
      framerErrorsUnattributed.push(line);
      continue;
    }
    const row = feedResults.find((f) => f.feedLabel === label);
    if (row) row.errors.push(line);
    else framerErrorsUnattributed.push(line);
  }

  const failedIds = new Set<string>();
  for (const errLine of framerSync.errors) {
    const id = encryptedIdFromFramerErrorLine(errLine);
    if (id) failedIds.add(id);
  }

  const globalFramerFailure =
    releasesPrepared > 0 &&
    framerSync.synced === 0 &&
    framerSync.errors.length > 0 &&
    failedIds.size === 0;

  for (const feedRow of feedResults) {
    if (globalFramerFailure) {
      feedRow.syncedCount = 0;
      continue;
    }
    const fromFeed = deduped.filter(
      (r) => r.sourceFeedLabel === feedRow.feedLabel,
    );
    feedRow.syncedCount = countSyncedForFeed(fromFeed, failedIds);
  }

  const flatErrors: string[] = [];
  for (const row of feedResults) flatErrors.push(...row.errors);
  flatErrors.push(...framerErrorsUnattributed);
  const hasErrors = flatErrors.length > 0;

  console.log(
    JSON.stringify({
      event: "cision_sync_summary",
      feedCount: feeds.length,
      feedItems: feedItemsTotal,
      releasesMergedBeforeDedupe: allReleases.length,
      duplicateEncryptedIdsDropped,
      releasesPrepared,
      synced: framerSync.synced,
      hasErrors,
      errorCount: flatErrors.length,
      framerErrorsUnattributed: framerErrorsUnattributed.length,
    }),
  );

  return {
    ok: true,
    hasErrors,
    synced: framerSync.synced,
    errors: flatErrors,
    feedItems: feedItemsTotal,
    releasesPrepared,
    duplicateEncryptedIdsDropped,
    feedResults,
    framerErrorsUnattributed,
  };
}
