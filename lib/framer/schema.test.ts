import { describe, expect, it } from "vitest";
import {
  buildCollectionFields,
  feedFingerprint,
  idsToRemove,
  rssItemToFieldData,
  tickerFromCategory,
} from "./schema";
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
  files: [{ url: "https://example.com/report.pdf", type: "application/pdf" }],
  "dc:identifier": "abc-123",
  "dc:subject": "Company Announcement",
  "dc:language": "en",
  "dc:publisher": "GlobeNewswire Inc.",
  "dc:contributor": "Einride AB",
  "dc:modified": "Wed, 21 May 2025 11:00:00 GMT",
  "dc:keyword": "Electric, Trucking",
  "dc:references": "ref-001",
  hasAttachments: true,
  attachmentTypes: "application/pdf",
};

describe("schema", () => {
  it("defines all RSS-backed Framer fields", () => {
    const ids = buildCollectionFields().map((field) => field.id);
    expect(ids).toEqual([
      "title",
      "published",
      "modified",
      "subject",
      "language",
      "keywords",
      "ticker",
      "categories",
      "id",
      "guid",
      "body",
      "url",
      "publisher",
      "contributor",
      "references",
      "hasAttachments",
      "attachmentTypes",
      "attachmentUrls",
      "coverImage",
      "images",
    ]);
  });

  it("maps every parsed RSS field into Framer columns", () => {
    const fieldData = rssItemToFieldData(sampleItem);
    expect(fieldData.title).toEqual({ type: "string", value: sampleItem.title });
    expect(fieldData.subject).toEqual({ type: "string", value: "Company Announcement" });
    expect(fieldData.language).toEqual({ type: "string", value: "en" });
    expect(fieldData.keywords).toEqual({ type: "string", value: "Electric, Trucking" });
    expect(fieldData.ticker).toEqual({ type: "string", value: "ERN" });
    expect(fieldData.categories).toEqual({
      type: "string",
      value: "http://www.globenewswire.com/rss/stock: ERN",
    });
    expect(fieldData.id).toEqual({ type: "string", value: "abc-123" });
    expect(fieldData.guid).toEqual({ type: "string", value: sampleItem.guid });
    expect(fieldData.body).toMatchObject({
      type: "formattedText",
      contentType: "html",
      value: expect.stringContaining("Body copy"),
    });
    expect(fieldData.url).toEqual({ type: "link", value: sampleItem.link });
    expect(fieldData.publisher).toEqual({ type: "string", value: "GlobeNewswire Inc." });
    expect(fieldData.contributor).toEqual({ type: "string", value: "Einride AB" });
    expect(fieldData.references).toEqual({ type: "string", value: "ref-001" });
    expect(fieldData.hasAttachments).toEqual({ type: "boolean", value: true });
    expect(fieldData.attachmentTypes).toEqual({ type: "string", value: "application/pdf" });
    expect(fieldData.attachmentUrls).toEqual({
      type: "string",
      value: "https://example.com/report.pdf",
    });
    expect(fieldData.coverImage).toEqual({
      type: "image",
      value: "https://example.com/hero.png",
      alt: sampleItem.title,
    });
    expect(fieldData.images).toEqual({
      type: "string",
      value: "https://example.com/hero.png",
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
