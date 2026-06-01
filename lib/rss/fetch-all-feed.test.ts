import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAllFeedItems, feedPageUrl, stripFeedPaging } from "./fetch-all-feed";

describe("fetch-all-feed", () => {
  it("strips existing paging segments", () => {
    const url =
      "https://rss.globenewswire.com/JsonFeed/organization/abc/content/fulltext/attachments/all/max/20/start/0";
    expect(stripFeedPaging(url)).toBe(
      "https://rss.globenewswire.com/JsonFeed/organization/abc/content/fulltext/attachments/all",
    );
  });

  it("builds paginated URLs with max 100", () => {
    const base =
      "https://rss.globenewswire.com/JsonFeed/organization/abc/content/fulltext/attachments/all";
    expect(feedPageUrl(base, 0)).toBe(`${base}/max/100/start/0`);
    expect(feedPageUrl(base, 100)).toBe(`${base}/max/100/start/100`);
  });

  describe("fetchAllFeedItems pagination", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches multiple pages until a short page", async () => {
      const base =
        "https://rss.globenewswire.com/JsonFeed/organization/abc/content/fulltext/attachments/all";
      const page0 = Array.from({ length: 100 }, (_, index) => ({
        Title: `Item ${index}`,
        Identifier: index,
      }));
      const page1 = [{ Title: "Last", Identifier: 100 }];

      vi.mocked(fetch).mockImplementation(async (url) => {
        const href = String(url);
        const body = href.endsWith("/start/0") ? JSON.stringify(page0) : JSON.stringify(page1);
        return new Response(body, { status: 200 });
      });

      const { items, pages } = await fetchAllFeedItems(base);

      expect(pages).toBe(2);
      expect(items).toHaveLength(101);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(feedPageUrl(base, 0), expect.any(Object));
      expect(fetch).toHaveBeenCalledWith(feedPageUrl(base, 100), expect.any(Object));
    });

    it("throws when a page item is missing Identifier", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([{ Title: "No id" }]), { status: 200 }),
      );

      await expect(
        fetchAllFeedItems(
          "https://rss.globenewswire.com/JsonFeed/organization/abc/content/fulltext/attachments/all",
        ),
      ).rejects.toThrow("Feed item missing Identifier");
    });
  });
});
