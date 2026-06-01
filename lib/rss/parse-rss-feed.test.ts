import { describe, expect, it } from "vitest";
import { parseRssItems, parseRssFeed, stripTrackingLinks } from "./parse-rss-feed";

const SAMPLE_XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Einride AB</title>
    <description>Contains the last 20 releases</description>
    <lastBuildDate>Tue, 19 May 2026 06:00:00 GMT</lastBuildDate>
    <item>
      <title>Einride announces listing</title>
      <link>https://www.globenewswire.com/news-release/1</link>
      <guid isPermaLink="true">https://www.globenewswire.com/news-release/1</guid>
      <pubDate>Wed, 21 May 2025 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>Body copy</p>]]></description>
      <category domain="http://www.globenewswire.com/rss/stock">ERN</category>
      <dc:identifier>abc-123</dc:identifier>
      <dc:subject>Company Announcement</dc:subject>
      <dc:language>en</dc:language>
    </item>
  </channel>
</rss>`;

describe("parseRssFeed", () => {
  it("returns channel fields with RSS element names", () => {
    const feed = parseRssFeed(SAMPLE_XML);
    expect(feed.channel.title).toBe("Einride AB");
    expect(feed.channel.description).toBe("Contains the last 20 releases");
    expect(feed.channel.lastBuildDate).toBe("Tue, 19 May 2026 06:00:00 GMT");
  });

  it("preserves raw item keys from the feed", () => {
    const feed = parseRssFeed(SAMPLE_XML);
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].title).toBe("Einride announces listing");
    expect(feed.items[0]["dc:identifier"]).toBe("abc-123");
    expect(feed.items[0]["dc:subject"]).toBe("Company Announcement");
  });
});

describe("parseRssItems", () => {
  it("maps items using RSS field names", () => {
    const items = parseRssItems(SAMPLE_XML);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Einride announces listing",
      link: "https://www.globenewswire.com/news-release/1",
      guid: "https://www.globenewswire.com/news-release/1",
      pubDate: "Wed, 21 May 2025 10:00:00 GMT",
      description: "<p>Body copy</p>",
      "dc:identifier": "abc-123",
      "dc:subject": "Company Announcement",
      "dc:language": "en",
      hasAttachments: false,
      attachmentTypes: "",
      categories: expect.arrayContaining([expect.stringContaining("ERN")]),
      keywords: [],
      images: [],
      files: [],
    });
    expect(items[0].category).toContain("ERN");
  });

  it("handles numeric dc:identifier values from GlobeNewswire", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>Numeric id release</title>
      <link>https://example.com/release</link>
      <dc:identifier>3302829</dc:identifier>
    </item>
  </channel>
</rss>`;

    const items = parseRssItems(xml);
    expect(items[0]?.["dc:identifier"]).toBe("3302829");
  });

  it("returns empty array for invalid feed", () => {
    expect(parseRssItems("<rss></rss>")).toEqual([]);
  });
});

describe("stripTrackingLinks", () => {
  it("unwraps GlobeNewswire tracker anchors", () => {
    const html =
      'Read <a href="https://www.globenewswire.com/Tracker?u=abc">more</a> here';
    expect(stripTrackingLinks(html)).toBe("Read more here");
  });
});
