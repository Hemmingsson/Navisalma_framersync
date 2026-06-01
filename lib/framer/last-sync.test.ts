import { describe, expect, it } from "vitest";
import { parseLastSync } from "./last-sync";

describe("last-sync", () => {
  it("round-trips sync metadata", () => {
    const record = {
      at: "2026-06-01T10:00:00.000Z",
      fetched: 20,
      upserted: 20,
      removed: 0,
      changed: true,
      collection: "Notified_Feed",
      published: true,
    };
    expect(parseLastSync(JSON.stringify(record))).toEqual(record);
  });

  it("returns null for malformed or legacy records", () => {
    const missingPublished = {
      at: "2026-06-01T10:00:00.000Z",
      fetched: 20,
      upserted: 20,
      removed: 0,
      changed: true,
      collection: "Notified_Feed",
    };
    expect(parseLastSync(JSON.stringify(missingPublished))).toBeNull();

    const wrongType = {
      at: "2026-06-01T10:00:00.000Z",
      fetched: "20",
      upserted: 20,
      removed: 0,
      changed: true,
      collection: "Notified_Feed",
      published: true,
    };
    expect(parseLastSync(JSON.stringify(wrongType))).toBeNull();
  });
});
