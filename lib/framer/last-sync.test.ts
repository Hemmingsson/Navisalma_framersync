import { describe, expect, it } from "vitest";
import { formatLastSync, parseLastSync, syncStatusFromLastSync } from "./last-sync";

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

  it("formats a readable status line", () => {
    const line = formatLastSync({
      at: "2026-06-01T10:00:00.000Z",
      fetched: 20,
      upserted: 0,
      removed: 0,
      changed: false,
      collection: "Notified_Feed",
      published: false,
    });
    expect(line).toContain("Last sync");
    expect(line).toContain("20 items");
  });

  it("marks sync as stale when missing or older than 5 minutes", () => {
    const now = Date.parse("2026-06-01T10:00:00.000Z");
    expect(syncStatusFromLastSync(null, now)).toBe("stale");
    expect(
      syncStatusFromLastSync(
        {
          at: "2026-06-01T09:54:00.000Z",
          fetched: 1,
          upserted: 0,
          removed: 0,
          changed: false,
          collection: "Notified_Feed",
          published: false,
        },
        now,
      ),
    ).toBe("stale");
    expect(
      syncStatusFromLastSync(
        {
          at: "2026-06-01T09:56:00.000Z",
          fetched: 1,
          upserted: 0,
          removed: 0,
          changed: false,
          collection: "Notified_Feed",
          published: false,
        },
        now,
      ),
    ).toBe("ok");
  });
});
