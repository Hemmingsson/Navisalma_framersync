import { JSON_FEED_BASE } from "../config";
import type { FeedSettings } from "./feed-settings";

function appendList(segments: string[], prefix: string, value: string) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const item of items) {
    segments.push(`${prefix}/${item}`);
  }
}

export function buildFeedUrl(settings: FeedSettings): string {
  const segments: string[] = [];

  const token = settings.organizationToken.trim();
  if (token) {
    segments.push(`organization/${token}`);
  }

  if (settings.search.trim()) {
    segments.push(`search/${encodeURIComponent(settings.search.trim())}`);
  }

  appendList(segments, "subject", settings.subjects);
  appendList(segments, "subjectcode", settings.subjectCodes);

  if (settings.language.trim()) segments.push(`language/${settings.language.trim()}`);
  if (settings.keyword.trim()) segments.push(`keyword/${settings.keyword.trim()}`);

  if (settings.newsTags.trim()) {
    segments.push(`newstag/${settings.newsTags.trim()}`);
  }

  if (settings.contentType) segments.push(`content/${settings.contentType}`);
  if (settings.attachments) segments.push(`attachments/${settings.attachments}`);

  if (settings.attachmentTypes.trim()) {
    segments.push(`atttyp/${settings.attachmentTypes.trim()}`);
  }

  if (settings.pdf) segments.push("pdf/true");
  if (settings.noLinks) segments.push("nolinks/true");

  if (settings.startDate.trim()) segments.push(`startdate/${settings.startDate.trim()}`);
  if (settings.endDate.trim()) segments.push(`enddate/${settings.endDate.trim()}`);
  if (settings.lastModDays.trim()) segments.push(`lastmod/${settings.lastModDays.trim()}`);

  if (settings.sort && settings.sort !== "desc") segments.push(`sort/${settings.sort}`);

  if (settings.start.trim()) segments.push(`start/${settings.start.trim()}`);
  if (settings.max.trim() && settings.max.trim() !== "20") segments.push(`max/${settings.max.trim()}`);

  if (settings.count) segments.push("count/true");

  if (settings.feedTitle.trim()) {
    segments.push(`feedtitle/${encodeURIComponent(settings.feedTitle.trim())}`);
  }
  if (settings.showLogo) segments.push("showlogo/true");
  if (settings.secure) segments.push("secure/true");
  if (settings.targetLink.trim()) segments.push(`targetlink/${settings.targetLink.trim()}`);
  if (settings.timezone.trim()) {
    segments.push(`timezone/${encodeURIComponent(settings.timezone.trim())}`);
  }

  let url = JSON_FEED_BASE + segments.join("/");

  if (settings.dateFormat.trim()) {
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}dateFormat=${encodeURIComponent(settings.dateFormat.trim())}`;
  }

  return url;
}
