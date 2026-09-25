import { describe, expect, it } from "vitest";
import { buildFeedUrl } from "./build-feed-url";
import { DEFAULT_FEED_SETTINGS } from "./feed-settings";

describe("buildFeedUrl", () => {
  it("builds the Einride production feed URL (JsonFeed default)", () => {
    const url = buildFeedUrl(DEFAULT_FEED_SETTINGS);
    expect(url).toBe(
      "https://rss.globenewswire.com/JsonFeed/organization/KRP8MKO23XlKmlSLWzS2WA==/content/fulltext/attachments/all",
    );
  });

  it("supports paging and count", () => {
    const url = buildFeedUrl({
      ...DEFAULT_FEED_SETTINGS,
      start: "20",
      max: "50",
      count: true,
    });
    expect(url).toContain("/start/20/max/50/count/true");
  });

  it("supports dateFormat query", () => {
    const url = buildFeedUrl({
      ...DEFAULT_FEED_SETTINGS,
      dateFormat: "MMM+dd,+yyyy",
    });
    expect(url.startsWith("https://rss.globenewswire.com/JsonFeed/")).toBe(true);
    expect(url).toContain("?dateFormat=MMM%2Bdd%2C%2Byyyy");
  });
});
