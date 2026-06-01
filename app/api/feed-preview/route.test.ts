import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

describe("GET /api/feed-preview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok false when feed body is not a JSON array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"not":"array"}', { status: 200 }),
    );

    const response = await GET(new Request("http://localhost/api/feed-preview"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("expected JSON array");
  });

  it("returns items when feed body is a valid JsonFeed array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ Title: "Release", Identifier: 1 }]), { status: 200 }),
    );

    const response = await GET(new Request("http://localhost/api/feed-preview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.itemCount).toBe(1);
    expect(body.jsonItems[0]?.Title).toBe("Release");
    expect(body.parsed).toBeUndefined();
    expect(body.raw).toBeUndefined();
  });
});
