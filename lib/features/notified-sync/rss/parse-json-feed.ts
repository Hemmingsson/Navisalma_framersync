import type { JsonFeedItem } from "./types";

export function parseJsonFeedFromParsed(parsed: unknown): JsonFeedItem[] {
  if (!Array.isArray(parsed)) {
    throw new Error("Feed parse failed: expected JSON array");
  }
  return parsed.filter((entry) => entry && typeof entry === "object") as JsonFeedItem[];
}

export function parseJsonFeed(body: string): JsonFeedItem[] {
  return parseJsonFeedFromParsed(JSON.parse(body));
}

export function jsonFeedItemId(item: JsonFeedItem, index: number): string {
  return String(item.Identifier ?? item.Url ?? index);
}

/** Normalize JsonFeed scalar values (string, array, or object). */
export function formatJsonFeedValue(value: unknown, empty = ""): string {
  if (value === undefined || value === null || value === "") return empty;
  if (Array.isArray(value)) {
    if (value.length === 0) return empty;
    return value.map((entry) => formatJsonFeedValue(entry, empty)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatJsonCell(value: unknown): string {
  return formatJsonFeedValue(value, "—");
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
