import { describe, expect, it } from "vitest";
import { encryptedIdFromFramerErrorLine } from "./sync-errors";

describe("encryptedIdFromFramerErrorLine", () => {
  const hex32 = "5975F5BD2369419398C52C786EBC44F9";

  it("parses 32-char hex prefix before colon", () => {
    expect(
      encryptedIdFromFramerErrorLine(`${hex32}: boom`),
    ).toBe(hex32);
  });

  it("returns null for categorized config lines", () => {
    expect(
      encryptedIdFromFramerErrorLine("config: Missing FRAMER_API_KEY"),
    ).toBeNull();
  });

  it("falls back to first colon split for non-hex ids", () => {
    expect(
      encryptedIdFromFramerErrorLine("SomeOtherId: msg"),
    ).toBe("SomeOtherId");
  });
});
