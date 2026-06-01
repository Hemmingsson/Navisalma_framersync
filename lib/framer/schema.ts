import { createHash } from "node:crypto";
import type { ManagedCollectionFieldInput } from "framer-api";
import { formatJsonFeedValue } from "../rss/parse-json-feed";
import type { JsonFeedItem } from "../rss/types";

/** Canonical JsonFeed key → Framer field mapping (20 vendor keys). */
export const JSON_FEED_FIELD_MAP = [
  { id: "title", name: "Title", framerType: "string", jsonKey: "Title" },
  { id: "releaseDateTime", name: "Release Date Time", framerType: "date", jsonKey: "ReleaseDateTime" },
  { id: "localizedReleaseDateTime", name: "Localized Release Date Time", framerType: "date", jsonKey: "LocalizedReleaseDateTime" },
  { id: "modifiedDate", name: "Modified Date", framerType: "date", jsonKey: "ModifiedDate" },
  { id: "subjects", name: "Subjects", framerType: "string", jsonKey: "Subjects" },
  { id: "language", name: "Language", framerType: "string", jsonKey: "Language" },
  { id: "keywords", name: "Keywords", framerType: "string", jsonKey: "Keywords" },
  { id: "stockTickers", name: "Stock Tickers", framerType: "string", jsonKey: "StockTickers" },
  { id: "identifier", name: "Identifier", framerType: "string", jsonKey: "Identifier" },
  { id: "content", name: "Content", framerType: "formattedText", jsonKey: "Content" },
  { id: "contentSummary", name: "Content Summary", framerType: "string", jsonKey: "ContentSummary" },
  { id: "summary", name: "Summary", framerType: "string", jsonKey: "Summary" },
  { id: "url", name: "Url", framerType: "link", jsonKey: "Url" },
  { id: "newsArchiveTags", name: "News Archive Tags", framerType: "string", jsonKey: "NewsArchiveTags" },
  { id: "pdfDownloadUrl", name: "PDF Download Url", framerType: "link", jsonKey: "PdfDownloadUrl" },
  { id: "isins", name: "ISINs", framerType: "string", jsonKey: "ISINs" },
  { id: "isFullTextRss", name: "Is Full Text Rss", framerType: "boolean", jsonKey: "IsFullTextRss" },
  { id: "logoImage", name: "Logo", framerType: "image", jsonKey: "Logo" },
  { id: "orgLogoImage", name: "Org Logo", framerType: "image", jsonKey: "OrgLogo" },
  { id: "orgName", name: "Org Name", framerType: "string", jsonKey: "OrgName" },
] as const;

export function buildCollectionFields(): ManagedCollectionFieldInput[] {
  return JSON_FEED_FIELD_MAP.map(({ id, name, framerType }) => {
    switch (framerType) {
      case "formattedText":
        return { id, name, type: "formattedText" as const };
      case "image":
        return { id, name, type: "image" as const };
      case "boolean":
        return { id, name, type: "boolean" as const };
      case "date":
        return { id, name, type: "date" as const };
      case "link":
        return { id, name, type: "link" as const };
      default:
        return { id, name, type: "string" as const };
    }
  });
}

export function schemaFingerprint(): string {
  return createHash("sha256").update(JSON.stringify(buildCollectionFields())).digest("hex");
}

function extractImageUrl(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = extractImageUrl(entry);
      if (url) return url;
    }
    return null;
  }
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url: unknown }).url;
    return typeof url === "string" && url.trim() ? url.trim() : null;
  }
  return null;
}

export function parseFeedDate(value: string | undefined, fieldName: string): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value} for field ${fieldName}`);
  }
  return parsed.toISOString();
}

export function jsonFeedScalar(value: unknown): string {
  return formatJsonFeedValue(value, "");
}

function jsonFeedLink(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type FieldDataValue =
  | { type: "string"; value: string }
  | { type: "link"; value: string | null }
  | { type: "date"; value: string }
  | { type: "formattedText"; value: string; contentType: "html" }
  | { type: "boolean"; value: boolean }
  | { type: "image"; value: string | null };

export function jsonFeedItemToFieldData(item: JsonFeedItem) {
  const fieldData: Record<string, FieldDataValue> = {};

  for (const { id, framerType, jsonKey } of JSON_FEED_FIELD_MAP) {
    const raw = item[jsonKey];
    switch (framerType) {
      case "string":
        fieldData[id] =
          id === "identifier"
            ? { type: "string", value: String(item.Identifier ?? "") }
            : { type: "string", value: jsonFeedScalar(raw) };
        break;
      case "link":
        fieldData[id] = { type: "link", value: jsonFeedLink(raw) };
        break;
      case "formattedText":
        fieldData[id] = {
          type: "formattedText",
          value: typeof raw === "string" ? raw : "",
          contentType: "html",
        };
        break;
      case "boolean":
        fieldData[id] = { type: "boolean", value: raw === true };
        break;
      case "image":
        fieldData[id] = { type: "image", value: extractImageUrl(raw) };
        break;
      case "date": {
        const parsed = parseFeedDate(typeof raw === "string" ? raw : undefined, id);
        if (parsed) fieldData[id] = { type: "date", value: parsed };
        break;
      }
    }
  }

  return fieldData;
}

export function idsToRemove(feedIds: Set<string>, cmsIds: string[]): string[] {
  return cmsIds.filter((id) => !feedIds.has(id));
}

function fingerprintValue(fieldData: Record<string, FieldDataValue>): string {
  return Object.keys(fieldData)
    .sort()
    .map((key) => {
      const { type, value } = fieldData[key];
      if (type === "link" || type === "image") return value ?? "";
      if (type === "boolean") return String(value);
      return value;
    })
    .join("|");
}

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
