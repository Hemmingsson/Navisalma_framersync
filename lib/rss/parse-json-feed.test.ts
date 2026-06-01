import { describe, expect, it } from "vitest";
import { formatJsonCell, jsonFeedSummary, parseJsonFeed } from "./parse-json-feed";

const SAMPLE = `[{"Title":"Test release","Url":"https://example.com/1","ReleaseDateTime":"2026-05-19T06:00:00Z","Subjects":"Company Announcement","Language":"en","Identifier":123,"ContentSummary":"Short summary."}]`;

describe("parseJsonFeed", () => {
  it("parses a JsonFeed array", () => {
    const items = parseJsonFeed(SAMPLE);
    expect(items).toHaveLength(1);
    expect(items[0]?.Title).toBe("Test release");
    expect(items[0]?.Subjects).toBe("Company Announcement");
  });

  it("summarizes content for table display", () => {
    expect(jsonFeedSummary({ ContentSummary: "Hello world" })).toBe("Hello world");
    expect(jsonFeedSummary({ Content: "<p>HTML body</p>" })).toBe("HTML body");
  });

  it("formats array fields for table cells", () => {
    expect(formatJsonCell(["Company Announcement"])).toBe("Company Announcement");
    expect(formatJsonCell([])).toBe("—");
  });
});
