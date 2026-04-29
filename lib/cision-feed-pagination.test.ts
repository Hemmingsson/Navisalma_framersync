import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_FEED_LIST_PAGES,
  fetchAllFeedReleases,
} from "./cision";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pageIndexFromFetchInput(input: RequestInfo | URL): number {
  let url: string;
  if (typeof input === "string") url = input;
  else if (input instanceof URL) url = input.href;
  else url = input.url;
  const raw = new URL(url).searchParams.get("pageIndex");
  return raw ? Number(raw) : 1;
}

describe("fetchAllFeedReleases", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty when first page has no releases", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ Releases: [] }));
    await expect(fetchAllFeedReleases("fid")).resolves.toEqual([]);
  });

  it("stops after a full page then a short final page", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const idx = pageIndexFromFetchInput(input);
      if (idx === 1) {
        return Promise.resolve(
          jsonResponse({
            Releases: Array.from({ length: 100 }, (_, i) => ({
              EncryptedId: `a${i}`,
            })),
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          Releases: Array.from({ length: 50 }, (_, i) => ({
            EncryptedId: `b${i}`,
          })),
        }),
      );
    });
    const rows = await fetchAllFeedReleases("fid");
    expect(rows.length).toBe(150);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aggregates multiple full pages until a short page", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const idx = pageIndexFromFetchInput(input);
      if (idx === 1 || idx === 2) {
        return Promise.resolve(
          jsonResponse({
            Releases: Array.from({ length: 100 }, (_, i) => ({
              EncryptedId: `${idx}-${i}`,
            })),
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          Releases: Array.from({ length: 30 }, (_, i) => ({
            EncryptedId: `3-${i}`,
          })),
        }),
      );
    });
    const rows = await fetchAllFeedReleases("fid");
    expect(rows.length).toBe(230);
  });

  it("throws when pagination would exceed MAX_FEED_LIST_PAGES", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          Releases: Array.from({ length: 100 }, () => ({ EncryptedId: "x" })),
        }),
      ),
    );
    await expect(fetchAllFeedReleases("fid")).rejects.toThrow(
      /MAX_FEED_LIST_PAGES/,
    );
  });

  it("issues MAX_FEED_LIST_PAGES feed list requests when every page is full", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          Releases: Array.from({ length: 100 }, () => ({ EncryptedId: "x" })),
        }),
      ),
    );
    await expect(fetchAllFeedReleases("fid")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(MAX_FEED_LIST_PAGES);
  });

  it("stops when accumulated rows reach TotalFoundReleases", async () => {
    let calls = 0;
    vi.mocked(fetch).mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve(
          jsonResponse({
            TotalFoundReleases: 150,
            Releases: Array.from({ length: 100 }, (_, i) => ({
              EncryptedId: `p1-${i}`,
            })),
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          TotalFoundReleases: 150,
          Releases: Array.from({ length: 100 }, (_, i) => ({
            EncryptedId: `p2-${i}`,
          })),
        }),
      );
    });
    const rows = await fetchAllFeedReleases("fid");
    expect(rows.length).toBe(200);
    expect(calls).toBe(2);
  });
});
