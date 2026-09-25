import { describe, expect, it, vi, beforeEach } from "vitest";
import type { JsonFeedItem } from "../rss/types";
import { syncPressReleasesToFramer } from "./sync-press-releases";

const mockCollection = {
  getItemIds: vi.fn(),
  getPluginData: vi.fn(),
  setPluginData: vi.fn(),
  addItems: vi.fn(),
  removeItems: vi.fn(),
  setItemOrder: vi.fn(),
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
    mockCollection.getPluginData.mockImplementation(async (key: string) =>
      key === "coverImageSyncVersion" ? "2" : null,
    );
    mockFramer.createManagedCollection.mockResolvedValue(mockCollection);
    mockCollection.setPluginData.mockResolvedValue(undefined);
    mockCollection.addItems.mockResolvedValue(undefined);
    mockCollection.removeItems.mockResolvedValue(undefined);
    mockCollection.setItemOrder.mockResolvedValue(undefined);
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
    expect(mockCollection.addItems).toHaveBeenCalledTimes(1);
    expect(mockCollection.addItems).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "id-a",
        slug: "id-a",
        fieldData: expect.objectContaining({ title: expect.any(Object) }),
      }),
      expect.objectContaining({ id: "id-b", slug: "id-b" }),
    ]);
    expect(mockCollection.removeItems).toHaveBeenCalledWith(["id-c"]);
    expect(mockCollection.setItemOrder).toHaveBeenCalledWith(["id-a", "id-b"]);
    expect(mockCollection.setFields).toHaveBeenCalled();
  });

  it("skips upsert when fingerprint is unchanged", async () => {
    const { feedFingerprint } = await import("./schema");
    const feedFp = feedFingerprint(sampleItems);
    mockCollection.getPluginData.mockImplementation(async (key: string) => {
      if (key === "lastFeedFingerprint") return feedFp;
      if (key === "coverImageSyncVersion") return "2";
      return null;
    });
    mockCollection.getItemIds.mockResolvedValue(["id-a", "id-b"]);

    const result = await syncPressReleasesToFramer(env, sampleItems);

    expect(result.upserted).toBe(0);
    expect(result.changed).toBe(false);
    expect(mockCollection.addItems).not.toHaveBeenCalled();
    expect(mockCollection.removeItems).not.toHaveBeenCalled();
    expect(mockCollection.setItemOrder).not.toHaveBeenCalled();
  });

  it("reorders the collection when feed content is unchanged", async () => {
    const { feedFingerprint } = await import("./schema");
    const feedFp = feedFingerprint(sampleItems);
    mockCollection.getPluginData.mockImplementation(async (key: string) => {
      if (key === "lastFeedFingerprint") return feedFp;
      if (key === "coverImageSyncVersion") return "2";
      return null;
    });
    mockCollection.getItemIds.mockResolvedValue(["id-b", "id-a"]);

    const result = await syncPressReleasesToFramer(env, sampleItems);

    expect(result.upserted).toBe(0);
    expect(result.changed).toBe(true);
    expect(mockCollection.addItems).not.toHaveBeenCalled();
    expect(mockCollection.setItemOrder).toHaveBeenCalledWith(["id-a", "id-b"]);
  });

  it("refuses to reconcile an empty feed", async () => {
    mockCollection.getItemIds.mockResolvedValue(["id-x"]);

    await expect(syncPressReleasesToFramer(env, [])).rejects.toThrow(/Empty feed/);
    expect(mockCollection.removeItems).not.toHaveBeenCalled();
  });

  it("skips when another sync holds the lock", async () => {
    mockCollection.getPluginData.mockImplementation(async (key: string) => {
      if (key === "syncInProgress") {
        return JSON.stringify({ startedAt: new Date().toISOString() });
      }
      return null;
    });

    const result = await syncPressReleasesToFramer(env, sampleItems);

    expect(result).toMatchObject({ skipped: true, upserted: 0, changed: false });
    expect(mockCollection.addItems).not.toHaveBeenCalled();
  });

  it("skips setFields when schema fingerprint is unchanged", async () => {
    const { feedFingerprint, schemaFingerprint } = await import("./schema");
    const feedFp = feedFingerprint(sampleItems);
    const schemaFp = schemaFingerprint();
    mockCollection.getPluginData.mockImplementation(async (key: string) => {
      if (key === "lastSchemaFingerprint") return schemaFp;
      if (key === "lastFeedFingerprint") return feedFp;
      if (key === "coverImageSyncVersion") return "2";
      return null;
    });
    mockCollection.getItemIds.mockResolvedValue(["id-a", "id-b"]);

    await syncPressReleasesToFramer(env, sampleItems);

    expect(mockCollection.setFields).not.toHaveBeenCalled();
  });
});
