import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

const mockFramer = {
  getProjectInfo: vi.fn(),
  [Symbol.dispose]: vi.fn(),
};

vi.mock("@/lib/env", () => ({
  loadSyncEnv: vi.fn(() => ({
    framerProjectUrl: "https://example.framer.app",
    framerApiKey: "key",
    cronSecret: "secret",
    collectionName: "Notified_Feed",
    feedUrl: "https://example.com/JsonFeed/org/content/fulltext/attachments/all",
    autoPublish: true,
  })),
}));

vi.mock("framer-api", () => ({
  connect: vi.fn(async () => mockFramer),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFramer.getProjectInfo.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok for shallow check without deep probe", async () => {
    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("validates JsonFeed body on deep check", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ Title: "One", Identifier: 1 }]), { status: 200 })),
    );

    const response = await GET(new Request("http://localhost/api/health?deep=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.feedUrl).toContain("/max/1/start/0");
  });

  it("returns 503 when deep feed body is not a JSON array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"not":"array"}', { status: 200 })),
    );

    const response = await GET(new Request("http://localhost/api/health?deep=1"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("expected JSON array");
  });
});
