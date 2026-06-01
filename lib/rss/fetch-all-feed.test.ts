import { describe, expect, it } from "vitest";
import { feedPageUrl, stripFeedPaging } from "./fetch-all-feed";

describe("fetch-all-feed", () => {
  it("strips existing paging segments", () => {
    const url =
      "https://rss.globenewswire.com/RssFeed/organization/abc/content/fulltext/attachments/all/max/20/start/0";
    expect(stripFeedPaging(url)).toBe(
      "https://rss.globenewswire.com/RssFeed/organization/abc/content/fulltext/attachments/all",
    );
  });

  it("builds paginated URLs with max 100", () => {
    const base =
      "https://rss.globenewswire.com/RssFeed/organization/abc/content/fulltext/attachments/all";
    expect(feedPageUrl(base, 0)).toBe(`${base}/max/100/start/0`);
    expect(feedPageUrl(base, 100)).toBe(`${base}/max/100/start/100`);
  });
});
