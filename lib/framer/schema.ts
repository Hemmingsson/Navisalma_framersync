/** Framer managed collection — field names mirror the GlobeNewswire feed. */

import { createHash } from "node:crypto";
import type { ManagedCollectionFieldInput } from "framer-api";
import type { RssItem } from "../rss/parse-rss-feed";
import { stripTrackingLinks } from "../rss/parse-rss-feed";

export function buildCollectionFields(): ManagedCollectionFieldInput[] {
  return [
    { id: "title", name: "Title", type: "string" },
    { id: "published", name: "Published", type: "date" },
    { id: "modified", name: "Modified", type: "date" },
    { id: "subject", name: "Subject", type: "string" },
    { id: "language", name: "Language", type: "string" },
    { id: "keywords", name: "Keywords", type: "string" },
    { id: "ticker", name: "Ticker", type: "string" },
    { id: "id", name: "ID", type: "string" },
    { id: "summary", name: "Summary", type: "formattedText" },
    { id: "url", name: "URL", type: "link" },
    { id: "coverImage", name: "Cover image", type: "image" },
  ];
}

export function parseRssDate(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

/** Stock ticker from RSS `<category>` (e.g. `…/stock: ERN` → `ERN`). */
export function tickerFromCategory(category: string): string {
  const stockMatch = category.match(/stock:\s*(\S+)/i);
  if (stockMatch?.[1]) return stockMatch[1];
  const suffix = category.match(/:\s*([^:]+)$/);
  return suffix?.[1]?.trim() || category.trim();
}

export function rssItemToFieldData(item: RssItem) {
  const fieldData: Record<
    string,
    | { type: "string"; value: string }
    | { type: "link"; value: string | null }
    | { type: "date"; value: string }
    | { type: "image"; value: string | null; alt?: string }
    | { type: "formattedText"; value: string; contentType: "html" }
  > = {
    title: { type: "string", value: item.title },
    subject: { type: "string", value: item["dc:subject"] ?? "" },
    language: { type: "string", value: item["dc:language"] ?? "" },
    keywords: { type: "string", value: item["dc:keyword"] ?? item.keywords.join(", ") },
    ticker: { type: "string", value: tickerFromCategory(item.category) },
    id: { type: "string", value: item["dc:identifier"] },
    summary: {
      type: "formattedText",
      value: stripTrackingLinks(item.description),
      contentType: "html",
    },
    url: { type: "link", value: item.link || null },
    coverImage: {
      type: "image",
      value: item.images[0] ?? null,
      alt: item.title,
    },
  };

  const published = parseRssDate(item.pubDate);
  if (published) fieldData.published = { type: "date", value: published };

  const modified = parseRssDate(item["dc:modified"]);
  if (modified) fieldData.modified = { type: "date", value: modified };

  return fieldData;
}

/** Item IDs present in CMS but absent from the latest full feed snapshot. */
export function idsToRemove(feedIds: Set<string>, cmsIds: string[]): string[] {
  return cmsIds.filter((id) => !feedIds.has(id));
}

/** Detect feed changes between sync runs. Stored in Framer plugin data (max 2kB). */
export function feedFingerprint(items: RssItem[]): string {
  const payload = items
    .map((item) => {
      const cover = item.images[0] ?? "";
      return `${item["dc:identifier"]}:${item["dc:modified"] ?? item.pubDate}:${item.title}:${item.description}:${cover}:${item["dc:keyword"] ?? ""}:${item.category}`;
    })
    .sort()
    .join("\n");

  return createHash("sha256").update(payload).digest("hex");
}
