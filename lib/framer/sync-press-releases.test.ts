import { describe, expect, it, vi, beforeEach } from "vitest";
import type { JsonFeedItem } from "../rss/types";
import { syncPressReleasesToFramer } from "./sync-press-releases";

const mockCollection = {
  getItemIds: vi.fn(),
  getPluginData: vi.fn(),
  setPluginData: vi.fn(),
  addItems: vi.fn(),
  removeItems: vi.fn(),
  setFields: vi.fn(),
};

const mockFramer = {
  createManagedCollection: vi.fn(),
  publish: vi.fn(),
  deploy: vi.fn(),
  [Symbol.dispose]: vi.fn(),
};

vi.mock("framer-api", () => ({
  connect: vi.fn(async () => mockFramer),
}));

vi.mock("./collection", () => ({
  findManagedCollection: vi.fn(async () => mockCollection),
}));

const env = {
  framerProjectUrl: "https://example.framer.app",
  framerApiKey: "key",
  cronSecret: "secret",
  collectionName: "Notified_Feed",
  feedUrl: "https://example.com/feed",
  autoPublish: false,
};

const sampleItems: JsonFeedItem[] = [
  {
    Title: "Release A",
    Identifier: "id-a",
    Url: "https://example.com/a",
    Content: "<p>A</p>",
  },
  {
    Title: "Release B",
    Identifier: "id-b",
    Url: "https://example.com/b",
    Content: "<p>B</p>",
  },
];

describe("syncPressReleasesToFramer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.getItemIds.mockResolvedValue(["id-a", "id-c"]);
    mockCollection.getPluginData.mockResolvedValue(null);
    mockCollection.setPluginData.mockResolvedValue(undefined);
    mockCollection.addItems.mockResolvedValue(undefined);
    mockCollection.removeItems.mockResolvedValue(undefined);
    mockCollection.setFields.mockResolvedValue(undefined);
    mockFramer.publish.mockResolvedValue({ deployment: { id: "dep-1" } });
    mockFramer.deploy.mockResolvedValue(undefined);
  });

  it("upserts items, removes stale ids, and reports changed", async () => {
    const result = await syncPressReleasesToFramer(env, sampleItems);

    expect(result).toMatchObject({
      fetched: 2,
      upserted: 2,
      removed: 1,
      changed: true,
      collection: "Notified_Feed",
      published: false,
    });
    expect(mockCollection.addItems).toHaveBeenCalledWith([
      expect.objectContaining({ id: "id-a", slug: "id-a" }),
      expect.objectContaining({ id: "id-b", slug: "id-b" }),
    ]);
    expect(mockCollection.removeItems).toHaveBeenCalledWith(["id-c"]);
  });

  it("skips upsert when fingerprint is unchanged", async () => {
    const { feedFingerprint } = await import("./schema");
    mockCollection.getPluginData.mockResolvedValue(feedFingerprint(sampleItems));
    mockCollection.getItemIds.mockResolvedValue(["id-a", "id-b"]);

    const result = await syncPressReleasesToFramer(env, sampleItems);

    expect(result.upserted).toBe(0);
    expect(result.changed).toBe(false);
    expect(mockCollection.addItems).not.toHaveBeenCalled();
    expect(mockCollection.removeItems).not.toHaveBeenCalled();
  });
});
