import type { ContentType } from "./feed-id";

/**
 * Cision News Feed JSON — Delivery document (publish.ne.cision.com):
 * - List: `GET .../papi/NewsFeed/{feedUniqueIdentifier}?format=json` (+ optional params)
 * - Detail (clean HTML): `GET .../papi/Release/{encryptedId}?format=json&isCleanHtml=true`
 * Release JSON: mapped keys come from list/detail responses; absent keys are not invented at runtime.
 */
const CISION_PAPI_BASE = "https://publish.ne.cision.com/papi";

/** Documented optional list params include detailLevel (base | medium | detail), pageSize (default 50, max 100), pageIndex, … */
const NEWS_FEED_QUERY =
  "format=json&detailLevel=detail&pageSize=50" as const;

export type CisionReleaseRaw = {
  EncryptedId?: string;
  Title?: string;
  Intro?: string;
  HtmlBody?: string;
  Body?: string;
  PublishDate?: string;
  LanguageCode?: string;
  Languages?: { Code?: string }[];
  PublicUrl?: string;
  CanonicalUrl?: string;
  CisionWireUrl?: string;
  Images?: { DownloadUrl?: string }[];
};

export type CisionFeedResponse = {
  PageIndex?: number;
  PageSize?: number;
  TotalFoundReleases?: number;
  Releases?: CisionReleaseRaw[];
};

/** Feed metadata attached during normalization (from configured feed, not Cision payload). */
export type FeedNormalizeContext = {
  contentType: ContentType;
  sourceFeedLabel: string;
};

export type CisionRelease = {
  encryptedId: string;
  title: string;
  summary: string;
  bodyHtml: string;
  publishDate: string;
  language: string;
  sourceUrl: string;
  heroImageUrl: string | null;
  contentType: ContentType;
  sourceFeedLabel: string;
};

/** Build normalization context from configured feed metadata (shared shape with `FeedConfig`). */
export function feedNormalizeContext(feed: {
  contentType: ContentType;
  feedLabel: string;
}): FeedNormalizeContext {
  return {
    contentType: feed.contentType,
    sourceFeedLabel: feed.feedLabel,
  };
}

export function normalizeCisionRelease(
  raw: CisionReleaseRaw,
  ctx: FeedNormalizeContext,
): CisionRelease | null {
  const encryptedId = raw.EncryptedId?.trim();
  if (!encryptedId) return null;
  const firstImg = raw.Images?.[0];
  const urlCandidates = [raw.PublicUrl, raw.CanonicalUrl, raw.CisionWireUrl];
  const sourceUrl =
    urlCandidates.find((u) => typeof u === "string" && u.trim())?.trim() ?? "";

  return {
    encryptedId,
    title: (raw.Title ?? "").trim(),
    summary: (raw.Intro ?? "").trim(),
    bodyHtml: (raw.HtmlBody ?? raw.Body ?? "") as string,
    publishDate: raw.PublishDate ?? "",
    language: raw.Languages?.[0]?.Code ?? raw.LanguageCode ?? "",
    sourceUrl,
    heroImageUrl: firstImg?.DownloadUrl?.trim() ?? null,
    contentType: ctx.contentType,
    sourceFeedLabel: ctx.sourceFeedLabel,
  };
}

export async function fetchFeed(feedId: string): Promise<CisionFeedResponse> {
  const url = `${CISION_PAPI_BASE}/NewsFeed/${encodeURIComponent(
    feedId,
  )}?${NEWS_FEED_QUERY}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Cision feed HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as CisionFeedResponse;
}

export async function fetchRelease(
  encryptedId: string,
  ctx: FeedNormalizeContext,
): Promise<CisionRelease | null> {
  const url = `${CISION_PAPI_BASE}/Release/${encodeURIComponent(
    encryptedId,
  )}?format=json&isCleanHtml=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Cision release HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    Release?: CisionReleaseRaw;
  };
  const raw = data.Release;
  if (!raw) return null;
  return normalizeCisionRelease(raw, ctx);
}
