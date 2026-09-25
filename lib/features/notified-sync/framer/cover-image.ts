import legacyImages from "../legacy-images.json";
import type { JsonFeedItem } from "../rss/types";

export type CoverSource = "widget" | "content" | "legacy";
export type CoverImage = { url: string; source: CoverSource };

/** Identifier → image from the pre-Notified "Press releases" CMS, for releases Notified has no image for. */
const LEGACY_IMAGES: Record<string, { image: string }> = legacyImages;

const IMG_TAG = /<img\b[^>]*>/gi;
const RESOURCE_GUID = /\/Resource\/Download\/([0-9a-f-]{36})/i;

function imgSrc(tag: string): string | null {
  return tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || null;
}

/** GlobeNewswire's `/media/…` images are 1×1 tracking pixels, not photos. */
function isTrackingPixel(url: string): boolean {
  return /globenewswire\.com\/media\//i.test(url);
}

/** Drop `?size=N` so GlobeNewswire serves the original resolution. */
function originalSize(url: string): string {
  return url.split("?")[0];
}

function widgetImageUrl(widget: unknown): string | null {
  const attachments = Array.isArray(widget) ? widget : widget ? [widget] : [];
  for (const attachment of attachments) {
    const url = (attachment as { ImageUrl?: unknown } | null)?.ImageUrl;
    if (typeof url === "string" && url.trim() && !isTrackingPixel(url)) return originalSize(url.trim());
  }
  return null;
}

function contentImageUrl(html: unknown): string | null {
  if (typeof html !== "string") return null;
  for (const [tag] of html.matchAll(IMG_TAG)) {
    const src = imgSrc(tag);
    if (src && !isTrackingPixel(src)) return originalSize(src);
  }
  return null;
}

/** Notified attachment → first real `<img>` in Content → legacy CMS image → none. */
export function resolveCoverImage(item: JsonFeedItem): CoverImage | null {
  const widget = widgetImageUrl(item.WidgetAttachment);
  if (widget) return { url: widget, source: "widget" };

  const content = contentImageUrl(item.Content);
  if (content) return { url: content, source: "content" };

  const legacy = LEGACY_IMAGES[String(item.Identifier)]?.image;
  if (legacy) return { url: legacy, source: "legacy" };

  return null;
}

function sameImage(a: string, b: string): boolean {
  const guidA = a.match(RESOURCE_GUID)?.[1]?.toLowerCase();
  const guidB = b.match(RESOURCE_GUID)?.[1]?.toLowerCase();
  return guidA && guidB ? guidA === guidB : originalSize(a) === originalSize(b);
}

const WRAPPER_FILLER = String.raw`(?:\s|<br\s*/?>|</?u>)*`;

/** Remove the cover's `<img>` from the body, plus a `<p>` wrapper left holding nothing else. */
export function contentWithoutCover(html: string, cover: CoverImage | null): string {
  if (!cover || cover.source === "legacy") return html;

  let result = html;
  for (const [tag] of html.matchAll(IMG_TAG)) {
    const src = imgSrc(tag);
    if (!src || !sameImage(src, cover.url)) continue;
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrapper = new RegExp(`<p\\b[^>]*>${WRAPPER_FILLER}${escaped}${WRAPPER_FILLER}</p>`, "i");
    result = wrapper.test(result) ? result.replace(wrapper, "") : result.replace(tag, "");
  }
  return result;
}
