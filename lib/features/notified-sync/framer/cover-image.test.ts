import { describe, expect, it } from "vitest";
import { contentWithoutCover, resolveCoverImage } from "./cover-image";

const GUID = "967e7af8-18f2-499b-81de-182b68ded31f";
const DOWNLOAD = `https://ml-eu.globenewswire.com/Resource/Download/${GUID}`;
const INLINE_IMG = `<img alt="truck" height="338" src="${DOWNLOAD}/einride-truck.jpg" width="600" />`;
const PIXEL = '<img alt="" src="https://ml-eu.globenewswire.com/media/Mjg2NGNh/tiny/Einride-AB.png" />';

describe("resolveCoverImage", () => {
  it("prefers the Notified attachment at original size", () => {
    expect(
      resolveCoverImage({
        Identifier: 1,
        WidgetAttachment: [{ ImageUrl: `${DOWNLOAD}?size=4`, ImageAlternateText: "x" }],
        Content: `<p>${INLINE_IMG}</p>`,
      }),
    ).toEqual({ url: DOWNLOAD, source: "widget" });
  });

  it("falls back to the first real <img> in Content, skipping tracking pixels", () => {
    expect(resolveCoverImage({ Identifier: 1, Content: `<p>${PIXEL}</p><p>${INLINE_IMG}</p>` })).toEqual({
      url: `${DOWNLOAD}/einride-truck.jpg`,
      source: "content",
    });
  });

  it("falls back to the legacy CMS image when Notified only has a pixel", () => {
    const cover = resolveCoverImage({ Identifier: 3302537, Content: `<p>text</p>${PIXEL}` });
    expect(cover?.source).toBe("legacy");
    expect(cover?.url).toMatch(/^https:\/\/framerusercontent\.com\/images\//);
  });

  it("returns null with no image anywhere", () => {
    expect(resolveCoverImage({ Identifier: 1, Content: `<p>text</p>${PIXEL}`, WidgetAttachment: [] })).toBeNull();
  });
});

describe("contentWithoutCover", () => {
  it("removes the cover <img> and its now-empty <p> wrapper", () => {
    const html = `<p align="center">${INLINE_IMG}<br /></p> <ul><li>Point</li></ul>`;
    const cover = resolveCoverImage({ Identifier: 1, Content: html })!;
    expect(contentWithoutCover(html, cover)).toBe(" <ul><li>Point</li></ul>");
  });

  it("matches a widget cover to the inline copy by GlobeNewswire id", () => {
    const html = `<p>Intro</p><p><u>${INLINE_IMG}<br /></u></p><p>A photo accompanying this announcement is available at …</p>`;
    expect(contentWithoutCover(html, { url: DOWNLOAD, source: "widget" })).toBe(
      "<p>Intro</p><p>A photo accompanying this announcement is available at …</p>",
    );
  });

  it("removes only the tag when the wrapper holds other text", () => {
    const html = `<p>Caption ${INLINE_IMG}</p>`;
    expect(contentWithoutCover(html, { url: DOWNLOAD, source: "widget" })).toBe("<p>Caption </p>");
  });

  it("leaves the body alone for legacy covers, other images and tracking pixels", () => {
    const html = `<p>${INLINE_IMG}</p>${PIXEL}`;
    expect(contentWithoutCover(html, { url: "https://framerusercontent.com/images/a.jpg", source: "legacy" })).toBe(html);
    expect(contentWithoutCover(html, { url: "https://example.com/other.jpg", source: "content" })).toBe(html);
    expect(contentWithoutCover(html, null)).toBe(html);
  });
});
