import { XMLParser } from "fast-xml-parser";
import { parseItemMedia, type RssFile } from "./attachments";

/** RSS 2.0 + Dublin Core + Media RSS — field names match the feed XML exactly. */
export type RssItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
  /** Comma-joined categories for display and legacy filters. */
  category: string;
  categories: string[];
  keywords: string[];
  images: string[];
  files: RssFile[];
  "dc:identifier": string;
  "dc:language"?: string;
  "dc:publisher"?: string;
  "dc:contributor"?: string;
  "dc:modified"?: string;
  "dc:subject"?: string;
  "dc:keyword"?: string;
  "dc:references"?: string;
  hasAttachments: boolean;
  attachmentTypes: string;
  enclosure?: unknown;
  "media:content"?: unknown;
};

export type RssChannel = {
  title?: string;
  link?: string;
  description?: string;
  copyright?: string;
  managingEditor?: string;
  lastBuildDate?: string;
  webMaster?: string;
  language?: string;
};

export type RssFeedDocument = {
  channel: RssChannel;
  /** Items with all feed keys preserved (including attributes on guid). */
  items: Record<string, unknown>[];
};

const RSS_ARRAY_TAGS = new Set(["item", "category", "enclosure", "media:content"]);

export function parseRssFeed(xml: string): RssFeedDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) => RSS_ARRAY_TAGS.has(name),
  });

  const doc = parser.parse(xml) as {
    rss?: { channel?: Record<string, unknown> & { item?: Record<string, unknown> | Record<string, unknown>[] } };
  };

  const channelRaw = doc.rss?.channel ?? {};
  const { item: rawItems, ...channelFields } = channelRaw;
  const items = !rawItems ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

  const channel: RssChannel = {};
  for (const [key, value] of Object.entries(channelFields)) {
    if (key.startsWith("@_")) continue;
    const text = scalar(value);
    if (text !== undefined) (channel as Record<string, string>)[key] = text;
  }

  return { channel, items };
}

/** Normalize a parsed RSS item for sync — values only, keys match the feed. */
export function toRssItem(raw: Record<string, unknown>): RssItem | null {
  const title = scalar(raw.title)?.trim();
  const link = scalar(raw.link)?.trim() ?? "";
  const id = scalar(raw["dc:identifier"])?.trim() || readGuid(raw.guid) || link;

  if (!title || !id) return null;

  const description = scalar(raw.description) ?? "";
  const categories = readCategories(raw.category);
  const media = parseItemMedia(raw.enclosure, raw["media:content"], description);

  const item: RssItem = {
    title,
    link,
    guid: readGuid(raw.guid) ?? link,
    pubDate: scalar(raw.pubDate) ?? "",
    description,
    category: categories.join(", "),
    categories,
    keywords: [],
    images: media.images,
    files: media.files,
    "dc:identifier": id,
    hasAttachments: media.hasAttachments,
    attachmentTypes: media.attachmentTypes,
  };

  const optionalDc = [
    "dc:language",
    "dc:publisher",
    "dc:contributor",
    "dc:modified",
    "dc:subject",
    "dc:keyword",
    "dc:references",
  ] as const;

  for (const key of optionalDc) {
    const value = scalar(raw[key]);
    if (value) item[key] = value;
  }

  if (item["dc:keyword"]) {
    item.keywords = parseKeywordList(item["dc:keyword"]);
  }

  if (raw.enclosure) item.enclosure = raw.enclosure;
  if (raw["media:content"]) item["media:content"] = raw["media:content"];

  return item;
}

export function parseRssItems(xml: string): RssItem[] {
  const { items } = parseRssFeed(xml);
  const parsed: RssItem[] = [];
  for (const raw of items) {
    const item = toRssItem(raw);
    if (item) parsed.push(item);
  }
  return parsed;
}

/** Display order matching GlobeNewswire RSS spec (vendor PDF). */
export const RSS_ITEM_FIELD_ORDER = [
  "title",
  "link",
  "guid",
  "pubDate",
  "description",
  "category",
  "dc:identifier",
  "dc:language",
  "dc:publisher",
  "dc:contributor",
  "dc:modified",
  "dc:subject",
  "dc:keyword",
  "dc:references",
  "enclosure",
  "media:content",
] as const;

export const RSS_CHANNEL_FIELD_ORDER = [
  "title",
  "link",
  "description",
  "copyright",
  "managingEditor",
  "webMaster",
  "lastBuildDate",
  "language",
] as const;

export function formatRssValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function readGuid(guid: unknown): string | undefined {
  if (!guid) return undefined;
  if (typeof guid === "string") return guid.trim();
  if (typeof guid === "object" && guid !== null) {
    const obj = guid as { "#text"?: unknown; "@_isPermaLink"?: string };
    const text = scalar(obj["#text"] ?? guid);
    return text?.trim();
  }
  return scalar(guid)?.trim();
}

function readCategories(category: unknown): string[] {
  if (!category) return [];
  const list = Array.isArray(category) ? category : [category];
  const parts = list.map((entry) => {
    if (typeof entry === "object" && entry !== null) {
      const obj = entry as { "#text"?: unknown; "@_domain"?: string };
      const text = scalar(obj["#text"] ?? entry) ?? "";
      return obj["@_domain"] ? `${obj["@_domain"]}: ${text}` : text;
    }
    return scalar(entry) ?? String(entry);
  });
  return parts.filter(Boolean);
}

function parseKeywordList(value: string): string[] {
  return [...new Set(value.split(/[,;]/).map((part) => part.trim()).filter(Boolean))];
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && value !== null && "#text" in value) {
    return scalar((value as { "#text"?: unknown })["#text"]);
  }
  return undefined;
}

/** Strip GlobeNewswire tracker redirects from HTML bodies. */
export function stripTrackingLinks(html: string): string {
  return html.replace(
    /<a[^>]*href="https:\/\/(?:www\.)?globenewswire\.com\/Tracker[^"]*"[^>]*>(.*?)<\/a>/gi,
    "$1",
  );
}
