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
    { id: "categories", name: "Categories", type: "string" },
    { id: "id", name: "ID", type: "string" },
    { id: "guid", name: "GUID", type: "string" },
    { id: "body", name: "Body", type: "formattedText" },
    { id: "url", name: "URL", type: "link" },
    { id: "publisher", name: "Publisher", type: "string" },
    { id: "contributor", name: "Contributor", type: "string" },
    { id: "references", name: "References", type: "string" },
    { id: "hasAttachments", name: "Has attachments", type: "boolean" },
    { id: "attachmentTypes", name: "Attachment types", type: "string" },
    { id: "attachmentUrls", name: "Attachment URLs", type: "string" },
    { id: "coverImage", name: "Cover image", type: "image" },
    { id: "images", name: "Images", type: "string" },
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

type FieldDataValue =
  | { type: "string"; value: string }
  | { type: "link"; value: string | null }
  | { type: "date"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "image"; value: string | null; alt?: string }
  | { type: "formattedText"; value: string; contentType: "html" };

export function rssItemToFieldData(item: RssItem) {
  const bodyHtml = stripTrackingLinks(item.description);
  const fieldData: Record<string, FieldDataValue> = {
    title: { type: "string", value: item.title },
    subject: { type: "string", value: item["dc:subject"] ?? "" },
    language: { type: "string", value: item["dc:language"] ?? "" },
    keywords: { type: "string", value: item["dc:keyword"] ?? item.keywords.join(", ") },
    ticker: { type: "string", value: tickerFromCategory(item.category) },
    categories: { type: "string", value: item.categories.join(", ") || item.category },
    id: { type: "string", value: item["dc:identifier"] },
    guid: { type: "string", value: item.guid },
    body: { type: "formattedText", value: bodyHtml, contentType: "html" },
    url: { type: "link", value: item.link || null },
    publisher: { type: "string", value: item["dc:publisher"] ?? "" },
    contributor: { type: "string", value: item["dc:contributor"] ?? "" },
    references: { type: "string", value: item["dc:references"] ?? "" },
    hasAttachments: { type: "boolean", value: item.hasAttachments },
    attachmentTypes: { type: "string", value: item.attachmentTypes },
    attachmentUrls: { type: "string", value: item.files.map((file) => file.url).join(", ") },
    coverImage: {
      type: "image",
      value: item.images[0] ?? null,
      alt: item.title,
    },
    images: { type: "string", value: item.images.join(", ") },
  };

  const published = parseRssDate(item.pubDate);
  if (published) fieldData.published = { type: "date", value: published };

  const modified = parseRssDate(item["dc:modified"]);
  if (modified) fieldData.modified = { type: "date", value: modified };

  return fieldData;
}

/** Item IDs in CMS but not in the latest full feed snapshot. */
export function idsToRemove(feedIds: Set<string>, cmsIds: string[]): string[] {
  return cmsIds.filter((id) => !feedIds.has(id));
}

/** Detect feed changes between sync runs. Stored in Framer plugin data (max 2kB). */
export function feedFingerprint(items: RssItem[]): string {
  const payload = items
    .map((item) => {
      const cover = item.images[0] ?? "";
      const files = item.files.map((file) => file.url).join("|");
      return [
        item["dc:identifier"],
        item["dc:modified"] ?? item.pubDate,
        item.title,
        item.description,
        item.guid,
        item.categories.join(","),
        item["dc:publisher"] ?? "",
        item["dc:contributor"] ?? "",
        item["dc:references"] ?? "",
        String(item.hasAttachments),
        item.attachmentTypes,
        files,
        cover,
        item.images.join(","),
        item["dc:keyword"] ?? "",
        item.category,
      ].join(":");
    })
    .sort()
    .join("\n");

  return createHash("sha256").update(payload).digest("hex");
}
