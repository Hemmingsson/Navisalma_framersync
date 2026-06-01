import { parseRssItems } from "./parse-rss-feed";
import type { RssItem } from "./parse-rss-feed";

export const FEED_PAGE_SIZE = 100;

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

async function fetchFeedPage(url: string): Promise<RssItem[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status} ${response.statusText} (${url})`);
  }

  return parseRssItems(await response.text());
}

/** Fetch every page until a page returns fewer than pageSize items. */
export async function fetchAllPressReleases(
  feedUrl: string,
  pageSize = FEED_PAGE_SIZE,
): Promise<{ items: RssItem[]; pages: number }> {
  const seen = new Map<string, RssItem>();
  let start = 0;
  let pages = 0;

  while (true) {
    const pageUrl = feedPageUrl(feedUrl, start, pageSize);
    const pageItems = await fetchFeedPage(pageUrl);
    pages += 1;

    for (const item of pageItems) {
      seen.set(item["dc:identifier"], item);
    }

    if (pageItems.length < pageSize) break;
    start += pageSize;
  }

  return { items: [...seen.values()], pages };
}
