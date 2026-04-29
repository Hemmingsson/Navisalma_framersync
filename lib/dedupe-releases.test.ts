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

function relTyped(
  id: string,
  label: string,
  contentType: CisionRelease["contentType"],
): CisionRelease {
  return { ...rel(id, label), contentType };
}

describe("dedupeReleasesFirstWin", () => {
  it("keeps first occurrence when content types tie", () => {
    const { deduped, duplicateEncryptedIdsDropped } = dedupeReleasesFirstWin([
      rel("A", "feed-a"),
      rel("B", "feed-b"),
      rel("A", "feed-c"),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.sourceFeedLabel).toBe("feed-a");
    expect(duplicateEncryptedIdsDropped).toBe(1);
  });

  it("prefers press over other when same encryptedId appears in overlap feeds", () => {
    const { deduped } = dedupeReleasesFirstWin([
      relTyped("X", "all-en", "other"),
      relTyped("X", "press-en", "press"),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.contentType).toBe("press");
    expect(deduped[0]?.sourceFeedLabel).toBe("press-en");
  });

  it("prefers financial over press", () => {
    const { deduped } = dedupeReleasesFirstWin([
      relTyped("X", "press-en", "press"),
      relTyped("X", "financial-en", "financial"),
    ]);
    expect(deduped[0]?.contentType).toBe("financial");
  });

  it("prefers deck over financial", () => {
    const { deduped } = dedupeReleasesFirstWin([
      relTyped("X", "financial-en", "financial"),
      relTyped("X", "deck-en", "deck"),
    ]);
    expect(deduped[0]?.contentType).toBe("deck");
  });
});
