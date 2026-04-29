import { describe, expect, it } from "vitest";
import type { CisionRelease } from "./cision";
import { dedupeReleasesFirstWin } from "./dedupe-releases";

function rel(id: string, label: string): CisionRelease {
  return {
    encryptedId: id,
    title: "t",
    summary: "",
    bodyHtml: "",
    publishDate: "",
    language: "",
    sourceUrl: "",
    heroImageUrl: null,
    contentType: "press",
    sourceFeedLabel: label,
  };
}

describe("dedupeReleasesFirstWin", () => {
  it("keeps first occurrence per encryptedId", () => {
    const { deduped, duplicateEncryptedIdsDropped } = dedupeReleasesFirstWin([
      rel("A", "feed-a"),
      rel("B", "feed-b"),
      rel("A", "feed-c"),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.sourceFeedLabel).toBe("feed-a");
    expect(duplicateEncryptedIdsDropped).toBe(1);
  });
});
