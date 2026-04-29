import { describe, expect, it } from "vitest";
import {
  CISION_RELEASE_FIELD_KEYS,
  COVER_IMAGE_FIELD_ID,
  primaryImageUrlFromCision,
  rawReleaseToFieldData,
} from "./cision-framer-schema";

describe("rawReleaseToFieldData", () => {
  it("uses formattedText+html for Html* / Intro / Body", () => {
    const fd = rawReleaseToFieldData({
      Title: "T",
      Intro: "<p>i</p>",
      HtmlBody: "<div>b</div>",
    } as Record<string, unknown>);
    expect(fd.Intro).toEqual({
      type: "formattedText",
      value: "<p>i</p>",
      contentType: "html",
    });
    expect(fd.HtmlBody).toEqual({
      type: "formattedText",
      value: "<div>b</div>",
      contentType: "html",
    });
    expect(fd.Title).toEqual({ type: "string", value: "T" });
  });

  it("adds CoverImage from first Images[] entry", () => {
    const fd = rawReleaseToFieldData({
      Title: "Hello",
      Images: [{ DownloadUrl: "https://cdn.test/photo.jpg" }],
    } as Record<string, unknown>);
    expect(fd[COVER_IMAGE_FIELD_ID]).toEqual({
      type: "image",
      value: "https://cdn.test/photo.jpg",
      alt: "Hello",
    });
    expect(fd.Title).toEqual({ type: "string", value: "Hello" });
  });

  it("falls back to Url on image object", () => {
    const fd = rawReleaseToFieldData({
      Images: [{ Url: "https://x.test/b.png" }],
    } as Record<string, unknown>);
    expect(fd[COVER_IMAGE_FIELD_ID]).toEqual({
      type: "image",
      value: "https://x.test/b.png",
    });
  });

  it("stringifies nested objects and arrays for string fields", () => {
    const fd = rawReleaseToFieldData({
      Title: "Hello",
      Images: [{ DownloadUrl: "https://x.test/a.jpg" }],
      Categories: [],
      IsRegulatory: true,
      UnknownKey: "ignored",
    } as Record<string, unknown>);
    expect(fd.Title).toEqual({ type: "string", value: "Hello" });
    expect(fd.Images?.type).toBe("string");
    expect(fd.Images?.value).toBe(
      '[{"DownloadUrl":"https://x.test/a.jpg"}]',
    );
    expect(fd.Categories?.value).toBe("[]");
    expect(fd.IsRegulatory?.value).toBe("true");
    expect(fd.UnknownKey).toBeUndefined();
  });

  it("omits keys not present on raw object", () => {
    const fd = rawReleaseToFieldData({ EncryptedId: "abc" });
    expect(fd.EncryptedId).toEqual({ type: "string", value: "abc" });
    expect(fd.Title).toBeUndefined();
    expect(fd[COVER_IMAGE_FIELD_ID]).toBeUndefined();
  });
});

describe("primaryImageUrlFromCision", () => {
  it("returns null when Images missing", () => {
    expect(primaryImageUrlFromCision({})).toBeNull();
  });
});

describe("CISION_RELEASE_FIELD_KEYS", () => {
  it("includes EncryptedId once", () => {
    expect(CISION_RELEASE_FIELD_KEYS.filter((k) => k === "EncryptedId")).toEqual(
      ["EncryptedId"],
    );
  });
});
