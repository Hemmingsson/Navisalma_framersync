/**
 * Cision News Feed JSON — Delivery document (publish.ne.cision.com):
 * - List: `GET .../papi/NewsFeed/{feedUniqueIdentifier}?format=json` (+ optional params)
 * - Detail: `GET .../papi/Release/{encryptedId}?format=json&isCleanHtml=true`
 */
const CISION_PAPI_BASE = "https://publish.ne.cision.com/papi";

const LIST_PAGE_SIZE = 100 as const;

/** Hard cap on list pages per feed — guards runaway pagination if the API never returns a short page. */
export const MAX_FEED_LIST_PAGES = 500;

export type CisionReleaseRaw = Record<string, unknown>;

export type CisionFeedResponse = {
  PageIndex?: number;
  PageSize?: number;
  TotalFoundReleases?: number;
  Releases?: CisionReleaseRaw[];
};

function newsFeedUrl(feedId: string, pageIndex: number): string {
  const q = new URLSearchParams({
    format: "json",
    detailLevel: "detail",
    pageSize: String(LIST_PAGE_SIZE),
    pageIndex: String(pageIndex),
  });
  return `${CISION_PAPI_BASE}/NewsFeed/${encodeURIComponent(feedId)}?${q}`;
}

/** One page of list results (for tests / rare direct use). */
export async function fetchFeedPage(
  feedId: string,
  pageIndex: number,
): Promise<CisionFeedResponse> {
  const url = newsFeedUrl(feedId, pageIndex);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Cision feed HTTP ${res.status}: ${await res.text()}`);
  }
  const body: unknown = await res.json();
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Cision feed JSON: expected object root");
  }
  const page = body as CisionFeedResponse;
  if (page.Releases !== undefined && !Array.isArray(page.Releases)) {
    throw new Error("Cision feed JSON: Releases must be an array when present");
  }
  return page;
}

/** All releases from the feed (paginated until a short page or empty). */
export async function fetchAllFeedReleases(
  feedId: string,
): Promise<CisionReleaseRaw[]> {
  const all: CisionReleaseRaw[] = [];
  let pageIndex = 1;
  let totalFound: number | undefined;
  // Stops on short page, TotalFoundReleases alignment, or MAX_FEED_LIST_PAGES (hard cap).
  for (;;) {
    const page = await fetchFeedPage(feedId, pageIndex);
    if (typeof page.TotalFoundReleases === "number") {
      totalFound = page.TotalFoundReleases;
    }
    const batch = page.Releases ?? [];
    all.push(...batch);
    if (typeof totalFound === "number" && all.length >= totalFound) break;
    if (batch.length === 0 || batch.length < LIST_PAGE_SIZE) break;
    pageIndex += 1;
    if (pageIndex > MAX_FEED_LIST_PAGES) {
      throw new Error(
        `Cision feed pagination: exceeded MAX_FEED_LIST_PAGES (${MAX_FEED_LIST_PAGES}) for feed ${feedId}`,
      );
    }
  }
  return all;
}

/** Inner release JSON from the detail endpoint, or null if missing. */
export async function fetchReleaseRaw(
  encryptedId: string,
): Promise<Record<string, unknown> | null> {
  const url = `${CISION_PAPI_BASE}/Release/${encodeURIComponent(
    encryptedId,
  )}?format=json&isCleanHtml=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Cision release HTTP ${res.status}: ${await res.text()}`);
  }
  const data: unknown = await res.json();
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Cision release JSON: expected object root");
  }
  const rec = data as Record<string, unknown>;
  const rel = rec.Release;
  if (rel === undefined || rel === null) return null;
  if (typeof rel !== "object" || Array.isArray(rel)) {
    throw new Error(
      "Cision release JSON: Release must be a plain object when present",
    );
  }
  return rel as Record<string, unknown>;
}

export function encryptedIdFromRaw(
  raw: Record<string, unknown>,
): string | null {
  const id = raw.EncryptedId;
  if (typeof id !== "string") return null;
  const t = id.trim();
  return t || null;
}
