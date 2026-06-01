import { describe, expect, it } from "vitest";
import { feedFingerprint, idsToRemove, rssItemToFieldData, tickerFromCategory } from "./schema";
import type { RssItem } from "../rss/parse-rss-feed";

const sampleItem: RssItem = {
  title: "Einride announces listing",
  link: "https://www.globenewswire.com/news-release/1",
  guid: "https://www.globenewswire.com/news-release/1",
  pubDate: "Wed, 21 May 2025 10:00:00 GMT",
  description: '<p>Body copy</p><img src="https://example.com/hero.png" alt="" />',
  category: "http://www.globenewswire.com/rss/stock: ERN",
  categories: ["http://www.globenewswire.com/rss/stock: ERN"],
  keywords: ["Electric", "Trucking"],
  images: ["https://example.com/hero.png"],
  files: [],
  "dc:identifier": "abc-123",
  "dc:subject": "Company Announcement",
  "dc:language": "en",
  "dc:keyword": "Electric, Trucking",
  hasAttachments: false,
  attachmentTypes: "",
};

describe("schema", () => {
  it("maps feed fields to Framer columns without remapping names", () => {
    const fieldData = rssItemToFieldData(sampleItem);
    expect(fieldData.title).toEqual({ type: "string", value: sampleItem.title });
    expect(fieldData.subject).toEqual({ type: "string", value: "Company Announcement" });
    expect(fieldData.language).toEqual({ type: "string", value: "en" });
    expect(fieldData.keywords).toEqual({ type: "string", value: "Electric, Trucking" });
    expect(fieldData.ticker).toEqual({ type: "string", value: "ERN" });
    expect(fieldData.id).toEqual({ type: "string", value: "abc-123" });
    expect(fieldData.url).toEqual({ type: "link", value: sampleItem.link });
    expect(fieldData.summary).toMatchObject({ type: "formattedText", contentType: "html" });
    expect(fieldData.coverImage).toEqual({
      type: "image",
      value: "https://example.com/hero.png",
      alt: sampleItem.title,
    });
  });

  it("extracts ticker from stock category", () => {
    expect(tickerFromCategory("http://www.globenewswire.com/rss/stock: ERN")).toBe("ERN");
  });

  it("computes CMS ids to remove during reconcile", () => {
    const feedIds = new Set(["a", "b"]);
    expect(idsToRemove(feedIds, ["a", "b", "c"])).toEqual(["c"]);
    expect(idsToRemove(feedIds, ["a"])).toEqual([]);
  });

  it("builds a stable feed fingerprint", () => {
    const a = feedFingerprint([sampleItem]);
    const b = feedFingerprint([{ ...sampleItem, title: "Changed title" }]);
    expect(a).not.toBe(b);
  });
});
