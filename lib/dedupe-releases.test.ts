import { describe, expect, it } from "vitest";
import type { CisionSyncRelease } from "./dedupe-releases";
import { dedupeReleasesFirstWin } from "./dedupe-releases";

function rel(id: string, label: string): CisionSyncRelease {
  return {
    encryptedId: id,
    fieldData: { Title: { type: "string", value: "t" } },
    sourceFeedLabel: label,
  };
}

describe("dedupeReleasesFirstWin", () => {
  it("keeps first occurrence when duplicate encryptedId", () => {
    const { deduped, duplicateEncryptedIdsDropped } = dedupeReleasesFirstWin([
      rel("A", "feed-a"),
      rel("B", "feed-b"),
      rel("A", "feed-c"),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.sourceFeedLabel).toBe("feed-a");
    expect(duplicateEncryptedIdsDropped).toBe(1);
  });

  it("ignores later feed for same encryptedId", () => {
    const { deduped } = dedupeReleasesFirstWin([
      rel("X", "all-en"),
      rel("X", "press-en"),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.sourceFeedLabel).toBe("all-en");
  });
});
