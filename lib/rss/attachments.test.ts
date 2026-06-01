import { describe, expect, it } from "vitest";
import { extractImagesFromHtml, parseItemMedia, summarizeAttachments } from "./attachments";

describe("parseItemMedia", () => {
  it("detects media:content PDF attachments", () => {
    const result = parseItemMedia(undefined, {
      "@_url": "https://example.com/report.pdf",
      "@_type": "application/pdf",
      "@_medium": "document",
    }, "");
    expect(result.hasAttachments).toBe(true);
    expect(result.attachmentTypes).toContain("application/pdf");
    expect(result.files).toEqual([
      { url: "https://example.com/report.pdf", type: "application/pdf" },
    ]);
    expect(result.images).toEqual([]);
  });

  it("collects inline HTML images from fulltext bodies", () => {
    const html =
      '<p>Release</p><img alt="" src="https://ml-eu.globenewswire.com/media/logo.png" />';
    const result = parseItemMedia(undefined, undefined, html);
    expect(result.images).toEqual(["https://ml-eu.globenewswire.com/media/logo.png"]);
  });

  it("separates image media from file attachments", () => {
    const result = parseItemMedia(
      { "@_url": "https://example.com/chart.png", "@_type": "image/png" },
      { "@_url": "https://example.com/report.pdf", "@_type": "application/pdf" },
      "",
    );
    expect(result.images).toEqual(["https://example.com/chart.png"]);
    expect(result.files).toEqual([
      { url: "https://example.com/report.pdf", type: "application/pdf" },
    ]);
  });

  it("returns empty summary when no attachments exist", () => {
    expect(parseItemMedia(undefined, undefined, "<p>No media</p>")).toEqual({
      images: [],
      files: [],
      hasAttachments: false,
      attachmentTypes: "",
    });
  });
});

describe("extractImagesFromHtml", () => {
  it("deduplicates repeated image URLs", () => {
    const html =
      '<img src="https://example.com/a.png" /><img src="https://example.com/a.png" />';
    expect(extractImagesFromHtml(html)).toEqual(["https://example.com/a.png"]);
  });
});

describe("summarizeAttachments", () => {
  it("keeps legacy summary shape", () => {
    const result = summarizeAttachments(undefined, {
      "@_url": "https://example.com/report.pdf",
      "@_type": "application/pdf",
    });
    expect(result.hasAttachments).toBe(true);
    expect(result.attachmentTypes).toContain("application/pdf");
  });
});
