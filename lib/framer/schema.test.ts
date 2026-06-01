import { describe, expect, it } from "vitest";
import {
  buildCollectionFields,
  feedFingerprint,
  idsToRemove,
  JSON_FEED_FIELD_MAP,
  jsonFeedItemToFieldData,
  jsonFeedScalar,
} from "./schema";
import type { JsonFeedItem } from "../rss/types";

const sampleItem: JsonFeedItem = {
  Title: "Einride announces listing",
  Url: "https://www.globenewswire.com/news-release/1",
  ReleaseDateTime: "2026-05-19T06:00:00Z",
  LocalizedReleaseDateTime: "2026-05-19T08:00:00+02:00",
  ModifiedDate: "2026-05-19T07:00:00Z",
  Subjects: "Company Announcement",
  Language: "en",
  Keywords: "Electric, Trucking",
  StockTickers: "ERN",
  Identifier: 12345,
  Content: "<p>Body copy</p>",
  ContentSummary: "Short summary",
  Summary: "Alt summary line",
  NewsArchiveTags: "tag-a",
  PdfDownloadUrl: "https://example.com/report.pdf",
  WidgetAttachment: { type: "embed" },
  ISINs: ["SE0012345678"],
  IsFullTextRss: true,
  Logo: ["https://example.com/logo.png"],
  OrgLogo: { url: "https://example.com/org.png" },
  OrgName: "Einride AB",
  RelatedLinks: [{ url: "https://example.com/related" }],
};

describe("schema", () => {
  it("defines all JsonFeed-backed Framer fields", () => {
    const ids = buildCollectionFields().map((field) => field.id);
    expect(ids).toEqual(JSON_FEED_FIELD_MAP.map((field) => field.id));
    expect(ids).toHaveLength(20);
  });

  it("maps every JsonFeed field into Framer columns", () => {
    const fieldData = jsonFeedItemToFieldData(sampleItem);
    expect(fieldData.title).toEqual({ type: "string", value: sampleItem.Title });
    expect(fieldData.subjects).toEqual({ type: "string", value: "Company Announcement" });
    expect(fieldData.language).toEqual({ type: "string", value: "en" });
    expect(fieldData.keywords).toEqual({ type: "string", value: "Electric, Trucking" });
    expect(fieldData.stockTickers).toEqual({ type: "string", value: "ERN" });
    expect(fieldData.identifier).toEqual({ type: "string", value: "12345" });
    expect(fieldData.content).toMatchObject({
      type: "formattedText",
      contentType: "html",
      value: "<p>Body copy</p>",
    });
    expect(fieldData.contentSummary).toEqual({ type: "string", value: "Short summary" });
    expect(fieldData.summary).toEqual({ type: "string", value: "Alt summary line" });
    expect(fieldData.url).toEqual({ type: "link", value: sampleItem.Url });
    expect(fieldData.newsArchiveTags).toEqual({ type: "string", value: "tag-a" });
    expect(fieldData.pdfDownloadUrl).toEqual({
      type: "link",
      value: "https://example.com/report.pdf",
    });
    expect(fieldData.isins).toEqual({ type: "string", value: "SE0012345678" });
    expect(fieldData.isFullTextRss).toEqual({ type: "boolean", value: true });
    expect(fieldData.logoImage).toEqual({ type: "image", value: "https://example.com/logo.png" });
    expect(fieldData.orgLogoImage).toEqual({ type: "image", value: "https://example.com/org.png" });
    expect(fieldData.orgName).toEqual({ type: "string", value: "Einride AB" });
    expect(fieldData.widgetAttachment).toBeUndefined();
    expect(fieldData.relatedLinks).toBeUndefined();
    expect(fieldData.releaseDateTime?.value).toBe(new Date("2026-05-19T06:00:00Z").toISOString());
    expect(fieldData.modifiedDate?.value).toBe(new Date("2026-05-19T07:00:00Z").toISOString());
  });

  it("throws on an unparseable date", () => {
    expect(() => jsonFeedItemToFieldData({ ...sampleItem, ReleaseDateTime: "not-a-date" })).toThrow(/Invalid date/);
  });

  it("normalizes array Subjects the same as string", () => {
    const stringItem = jsonFeedItemToFieldData({ ...sampleItem, Subjects: "A, B" });
    const arrayItem = jsonFeedItemToFieldData({ ...sampleItem, Subjects: ["A", "B"] });
    expect(stringItem.subjects).toEqual(arrayItem.subjects);
  });

  it("jsonFeedScalar joins arrays and stringifies objects", () => {
    expect(jsonFeedScalar(["A", "B"])).toBe("A, B");
    expect(jsonFeedScalar({ x: 1 })).toBe('{"x":1}');
  });

  it("computes CMS ids to remove during reconcile", () => {
    const feedIds = new Set(["a", "b"]);
    expect(idsToRemove(feedIds, ["a", "b", "c"])).toEqual(["c"]);
    expect(idsToRemove(feedIds, ["a"])).toEqual([]);
  });

  it("builds a stable feed fingerprint", () => {
    const a = feedFingerprint([sampleItem]);
    const b = feedFingerprint([{ ...sampleItem, Title: "Changed title" }]);
    const c = feedFingerprint([{ ...sampleItem, Subjects: "Different subject" }]);
    const d = feedFingerprint([{ ...sampleItem, Url: "https://example.com/changed" }]);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });
});
