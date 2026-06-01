import { describe, expect, it } from "vitest";
import { formatLastSync, parseLastSync } from "./last-sync";

describe("last-sync", () => {
  it("round-trips sync metadata", () => {
    const record = {
      at: "2026-06-01T10:00:00.000Z",
      fetched: 20,
      upserted: 20,
      removed: 0,
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
      collection: "Notified_Feed",
      published: false,
    });
    expect(line).toContain("Last sync");
    expect(line).toContain("20 items");
  });
});
