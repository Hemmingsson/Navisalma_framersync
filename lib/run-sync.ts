import {
  encryptedIdFromRaw,
  fetchAllFeedReleases,
  fetchReleaseRaw,
} from "./cision";
import { rawReleaseToFieldData } from "./cision-framer-schema";
import {
  type CisionSyncRelease,
  dedupeReleasesFirstWin,
} from "./dedupe-releases";
import {
  MISSING_CISION_FEED_ENV_MESSAGE,
  resolveCisionFeeds,
} from "./feed-id";
import { syncReleasesToFramer } from "./framer";
import {
  categorizeSyncError,
  errorMessage,
  isRetryableFetchOrNetworkError,
  withRetry,
  withTimeout,
} from "./retry-utils";
import {
  computeGlobalFramerFailure,
  countSyncedForFeed,
} from "./sync-framer-attribution";
import { encryptedIdFromFramerErrorLine } from "./sync-errors";

export type FeedSyncResult = {
  feedLabel: string;
  /** Rows returned by Cision list API for this feed (all pages). */
  releaseCount: number;
  /** Rows kept for this feed after global dedupe (first-listed feed wins per `encryptedId`). */
  preparedCount: number;
  syncedCount: number;
  errors: string[];
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
  | { ok: true; release: CisionSyncRelease }
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

async function detailRowFromListRelease(
  rawListRow: Record<string, unknown>,
  feedLabel: string,
): Promise<DetailRow> {
  const listId = encryptedIdFromRaw(rawListRow);
  if (!listId) {
    return { ok: false, id: "(no-id)", error: "missing EncryptedId on list row" };
  }

  try {
    let raw: Record<string, unknown> | null;
    try {
      raw = await withRetry(
        () =>
          withTimeout(
            CISION_DETAIL_TIMEOUT_MS,
            fetchReleaseRaw(listId),
            `Cision detail ${feedLabel} ${listId}`,
          ),
        { isRetryable: isRetryableFetchOrNetworkError },
      );
    } catch (e) {
      return { ok: false, id: listId, error: errorMessage(e) };
    }

    if (!raw) {
      return {
        ok: false,
        id: listId,
        error: "detail JSON missing Release object",
      };
    }

    const encryptedId = encryptedIdFromRaw(raw);
    if (!encryptedId) {
      return {
        ok: false,
        id: listId,
        error: "missing EncryptedId on detail Release",
      };
    }

    return {
      ok: true,
      release: {
        encryptedId,
        fieldData: rawReleaseToFieldData(raw),
        sourceFeedLabel: feedLabel,
      },
    };
  } catch (e) {
    return { ok: false, id: listId, error: errorMessage(e) };
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

  const allReleases: CisionSyncRelease[] = [];
  const feedResults: FeedSyncResult[] = [];
  let feedItemsTotal = 0;

  for (const feed of feeds) {
    const feedRow: FeedSyncResult = {
      feedLabel: feed.feedLabel,
      releaseCount: 0,
      preparedCount: 0,
      syncedCount: 0,
      errors: [],
    };

    try {
      const rawItems = await withRetry(
        () =>
          withTimeout(
            CISION_LIST_TIMEOUT_MS,
            fetchAllFeedReleases(feed.feedId),
            `Cision list ${feed.feedLabel}`,
          ),
        { isRetryable: isRetryableFetchOrNetworkError },
      );
      feedRow.releaseCount = rawItems.length;
      feedItemsTotal += rawItems.length;

      const detailResults = await mapWithConcurrency(
        rawItems,
        DETAIL_CONCURRENCY,
        (raw) => detailRowFromListRelease(raw, feed.feedLabel),
      );

      const releasesFromFeed: CisionSyncRelease[] = [];
      for (const r of detailResults) {
        if (r.ok) {
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
        releaseCount: feedRow.releaseCount,
        preparedCount: feedRow.preparedCount,
        feedErrors: feedRow.errors.length,
      }),
    );

    feedResults.push(feedRow);
  }

  const { deduped, duplicateEncryptedIdsDropped } = dedupeReleasesFirstWin(allReleases);

  const preparedByFeed = new Map<string, number>();
  for (const r of deduped) {
    preparedByFeed.set(
      r.sourceFeedLabel,
      (preparedByFeed.get(r.sourceFeedLabel) ?? 0) + 1,
    );
  }
  for (const row of feedResults) {
    row.preparedCount = preparedByFeed.get(row.feedLabel) ?? 0;
  }

  const releasesPrepared = deduped.length;

  const framerSync = await syncReleasesToFramer(deduped);

  const idToFeedLabel = new Map(
    deduped.map((r) => [r.encryptedId, r.sourceFeedLabel] as const),
  );

  const feedRowByLabel = new Map(
    feedResults.map((r) => [r.feedLabel, r] as const),
  );

  const framerErrorsUnattributed: string[] = [];
  const failedIds = new Set<string>();
  for (const line of framerSync.errors) {
    const id = encryptedIdFromFramerErrorLine(line);
    if (id) failedIds.add(id);

    if (!id) {
      framerErrorsUnattributed.push(line);
      continue;
    }
    const label = idToFeedLabel.get(id);
    if (!label) {
      framerErrorsUnattributed.push(line);
      continue;
    }
    const row = feedRowByLabel.get(label);
    if (row) row.errors.push(line);
    else framerErrorsUnattributed.push(line);
  }

  const globalFramerFailure = computeGlobalFramerFailure({
    releasesPrepared,
    framerSynced: framerSync.synced,
    framerErrorCount: framerSync.errors.length,
    failedIdsSize: failedIds.size,
  });

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
