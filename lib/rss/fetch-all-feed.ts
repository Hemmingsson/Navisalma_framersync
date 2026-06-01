import { parseJsonFeed } from "./parse-json-feed";
import type { JsonFeedItem } from "./types";

export const FEED_PAGE_SIZE = 100;
const MAX_PAGES = 200;

/** Remove paging segments so we can append our own /max and /start. */
export function stripFeedPaging(url: string): string {
  return url
    .replace(/\/start\/\d+/gi, "")
    .replace(/\/max\/\d+/gi, "")
    .replace(/\/$/, "");
}

export function feedPageUrl(baseUrl: string, start: number, pageSize = FEED_PAGE_SIZE): string {
  const root = stripFeedPaging(baseUrl);
  return `${root}/max/${pageSize}/start/${start}`;
}

async function fetchFeedPage(url: string): Promise<JsonFeedItem[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status} ${response.statusText} (${url})`);
  }

  return parseJsonFeed(await response.text());
}

/** Fetch every page until a page returns fewer than pageSize items. */
export async function fetchAllFeedItems(
  feedUrl: string,
  pageSize = FEED_PAGE_SIZE,
): Promise<{ items: JsonFeedItem[]; pages: number }> {
  const seen = new Map<string, JsonFeedItem>();
  let start = 0;
  let pages = 0;

  while (true) {
    const pageUrl = feedPageUrl(feedUrl, start, pageSize);
    const pageItems = await fetchFeedPage(pageUrl);
    pages += 1;

    if (pages > MAX_PAGES) {
      throw new Error(`Feed pagination exceeded ${MAX_PAGES} pages — refusing to continue`);
    }

    for (const item of pageItems) {
      if (item.Identifier == null || item.Identifier === "") {
        throw new Error("Feed item missing Identifier");
      }
      seen.set(String(item.Identifier), item);
    }

    if (pageItems.length < pageSize) break;
    start += pageSize;
  }

  return { items: [...seen.values()], pages };
}
