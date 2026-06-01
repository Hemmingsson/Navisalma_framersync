export type MediaEntry = {
  url: string;
  type?: string;
  medium?: string;
};

export type RssFile = {
  url: string;
  type?: string;
};

export type ParsedAttachments = {
  images: string[];
  files: RssFile[];
  hasAttachments: boolean;
  attachmentTypes: string;
};

const IMAGE_TYPE_RE = /^image\//i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)/i;
const FILE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|zip)(\?|#|$)/i;

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && value !== null && "#text" in value) {
    return scalar((value as { "#text"?: unknown })["#text"]);
  }
  return undefined;
}

function readMediaEntries(value: unknown): MediaEntry[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const entries: MediaEntry[] = [];

  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const url = scalar(obj["@_url"] ?? obj.url)?.trim();
    if (!url) continue;
    entries.push({
      url,
      type: scalar(obj["@_type"] ?? obj.type),
      medium: scalar(obj["@_medium"] ?? obj.medium),
    });
  }

  return entries;
}

function isImageEntry(url: string, type?: string, medium?: string): boolean {
  if (medium === "image") return true;
  if (type && IMAGE_TYPE_RE.test(type)) return true;
  return IMAGE_EXT_RE.test(url);
}

function isFileEntry(url: string, type?: string, medium?: string): boolean {
  if (isImageEntry(url, type, medium)) return false;
  if (medium === "document") return true;
  if (type?.startsWith("application/")) return true;
  return FILE_EXT_RE.test(url);
}

function addUniqueImage(images: string[], url: string) {
  if (!images.includes(url)) images.push(url);
}

function addUniqueFile(files: RssFile[], entry: RssFile) {
  if (!files.some((file) => file.url === entry.url)) files.push(entry);
}

/** Collect `<img src>` URLs from RSS fulltext HTML. */
export function extractImagesFromHtml(html: string): string[] {
  const images: string[] = [];
  const pattern = /<img[^>]+src=["']([^"']+)["']/gi;
  let match = pattern.exec(html);
  while (match) {
    const url = match[1]?.trim();
    if (url) addUniqueImage(images, url);
    match = pattern.exec(html);
  }
  return images;
}

/** Parse RSS enclosure + media:content nodes and inline HTML images. */
export function parseItemMedia(
  enclosure: unknown,
  mediaContent: unknown,
  descriptionHtml: string,
): ParsedAttachments {
  const entries = [
    ...readMediaEntries(enclosure),
    ...readMediaEntries(mediaContent),
  ];
  const images: string[] = [];
  const files: RssFile[] = [];
  const types = new Set<string>();

  for (const entry of entries) {
    if (entry.type) types.add(entry.type);
    if (entry.medium) types.add(entry.medium);

    if (isImageEntry(entry.url, entry.type, entry.medium)) {
      addUniqueImage(images, entry.url);
      continue;
    }

    if (isFileEntry(entry.url, entry.type, entry.medium)) {
      addUniqueFile(files, { url: entry.url, type: entry.type });
    }
  }

  for (const url of extractImagesFromHtml(descriptionHtml)) {
    addUniqueImage(images, url);
  }

  for (const file of files) {
    if (file.type) types.add(file.type);
    const ext = file.url.split(".").pop()?.split(/[?#]/)[0]?.toUpperCase();
    if (ext && ext.length <= 5) types.add(ext);
  }

  return {
    images,
    files,
    hasAttachments: files.length > 0 || entries.some((entry) => Boolean(entry.url)),
    attachmentTypes: [...types].filter(Boolean).sort().join(", "),
  };
}

/** @deprecated Use parseItemMedia — kept for tests expecting summary-only shape. */
export function summarizeAttachments(enclosure: unknown, mediaContent: unknown) {
  const parsed = parseItemMedia(enclosure, mediaContent, "");
  return {
    hasAttachments: parsed.hasAttachments,
    attachmentTypes: parsed.attachmentTypes,
  };
}
