import { createHash } from "node:crypto";
import type { ManagedCollectionFieldInput } from "framer-api";
import { formatJsonFeedValue } from "../rss/parse-json-feed";
import type { JsonFeedItem } from "../rss/types";

export function buildCollectionFields(): ManagedCollectionFieldInput[] {
  return [
    { id: "title", name: "Title", type: "string" },
    { id: "releaseDateTime", name: "Release Date Time", type: "date" },
    { id: "localizedReleaseDateTime", name: "Localized Release Date Time", type: "date" },
    { id: "modifiedDate", name: "Modified Date", type: "date" },
    { id: "subjects", name: "Subjects", type: "string" },
    { id: "language", name: "Language", type: "string" },
    { id: "keywords", name: "Keywords", type: "string" },
    { id: "stockTickers", name: "Stock Tickers", type: "string" },
    { id: "identifier", name: "Identifier", type: "string" },
    { id: "content", name: "Content", type: "formattedText" },
    { id: "contentSummary", name: "Content Summary", type: "string" },
    { id: "url", name: "Url", type: "link" },
    { id: "newsArchiveTags", name: "News Archive Tags", type: "string" },
    { id: "pdfDownloadUrl", name: "PDF Download Url", type: "link" },
    { id: "widgetAttachment", name: "Widget Attachment", type: "string" },
  ];
}

export function parseFeedDate(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function jsonFeedScalar(value: unknown): string {
  return formatJsonFeedValue(value, "");
}

type FieldDataValue =
  | { type: "string"; value: string }
  | { type: "link"; value: string | null }
  | { type: "date"; value: string }
  | { type: "formattedText"; value: string; contentType: "html" };

export function jsonFeedItemToFieldData(item: JsonFeedItem) {
  const fieldData: Record<string, FieldDataValue> = {
    title: { type: "string", value: jsonFeedScalar(item.Title) },
    subjects: { type: "string", value: jsonFeedScalar(item.Subjects) },
    language: { type: "string", value: jsonFeedScalar(item.Language) },
    keywords: { type: "string", value: jsonFeedScalar(item.Keywords) },
    stockTickers: { type: "string", value: jsonFeedScalar(item.StockTickers) },
    identifier: { type: "string", value: String(item.Identifier ?? "") },
    content: {
      type: "formattedText",
      value: item.Content ?? "",
      contentType: "html",
    },
    contentSummary: { type: "string", value: jsonFeedScalar(item.ContentSummary) },
    url: { type: "link", value: typeof item.Url === "string" && item.Url.trim() ? item.Url.trim() : null },
    newsArchiveTags: { type: "string", value: jsonFeedScalar(item.NewsArchiveTags) },
    pdfDownloadUrl: {
      type: "link",
      value: typeof item.PdfDownloadUrl === "string" && item.PdfDownloadUrl.trim() ? item.PdfDownloadUrl.trim() : null,
    },
    widgetAttachment: { type: "string", value: jsonFeedScalar(item.WidgetAttachment) },
  };

  for (const [key, raw] of [
    ["releaseDateTime", item.ReleaseDateTime],
    ["localizedReleaseDateTime", item.LocalizedReleaseDateTime],
    ["modifiedDate", item.ModifiedDate],
  ] as const) {
    const parsed = parseFeedDate(raw);
    if (parsed) fieldData[key] = { type: "date", value: parsed };
  }

  return fieldData;
}

/** Item IDs in CMS but not in the latest full feed snapshot. */
export function idsToRemove(feedIds: Set<string>, cmsIds: string[]): string[] {
  return cmsIds.filter((id) => !feedIds.has(id));
}

function fingerprintValue(fieldData: Record<string, FieldDataValue>): string {
  return Object.keys(fieldData)
    .sort()
    .map((key) => {
      const { type, value } = fieldData[key];
      return type === "link" ? (value ?? "") : value;
    })
    .join("|");
}

/** Detect feed changes between sync runs. Stored in Framer plugin data (max 2kB). */
export function feedFingerprint(items: JsonFeedItem[]): string {
  const payload = items
    .map((item) => {
      const id = String(item.Identifier);
      const fieldData = jsonFeedItemToFieldData(item);
      return `${id}:${fingerprintValue(fieldData)}`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join("\n");

  return createHash("sha256").update(payload).digest("hex");
}
