/** GlobeNewswire JsonFeed item shape (PascalCase keys from vendor API). */
export type JsonFeedItem = {
  Title?: string;
  Url?: string;
  ReleaseDateTime?: string;
  LocalizedReleaseDateTime?: string;
  ModifiedDate?: string;
  Content?: string;
  ContentSummary?: string;
  Subjects?: string;
  Language?: string;
  Keywords?: string;
  Identifier?: string | number;
  StockTickers?: string;
  NewsArchiveTags?: string;
  PdfDownloadUrl?: string;
  WidgetAttachment?: unknown;
  [key: string]: unknown;
};

export function parseJsonFeed(body: string): JsonFeedItem[] {
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry) => entry && typeof entry === "object") as JsonFeedItem[];
}

export function jsonFeedItemId(item: JsonFeedItem, index: number): string {
  return String(item.Identifier ?? item.Url ?? index);
}

export function formatJsonCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((entry) => formatJsonCell(entry)).join(", ");
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Short text for table cells — prefer ContentSummary, fall back to stripped Content. */
export function jsonFeedSummary(item: JsonFeedItem, maxLength = 160): string {
  const raw = item.ContentSummary?.trim() || (item.Content ? stripHtml(item.Content) : "");
  if (!raw) return "—";
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}…`;
}
