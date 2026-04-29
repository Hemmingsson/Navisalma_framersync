import { describe, expect, it } from "vitest";
import { canonicalCisionEncryptedId, encryptedIdFromRaw } from "./cision";

describe("canonicalCisionEncryptedId", () => {
  it("uppercases hex-only 32-char ids", () => {
    expect(canonicalCisionEncryptedId("aabbccddeeff00112233445566778899")).toBe(
      "AABBCCDDEEFF00112233445566778899",
    );
  });

  it("returns non-hex ids unchanged", () => {
    expect(canonicalCisionEncryptedId("not-hex-id")).toBe("not-hex-id");
  });
});

describe("encryptedIdFromRaw", () => {
  it("normalizes EncryptedId casing from detail JSON", () => {
    const raw = { EncryptedId: "aabbccddeeff00112233445566778899" };
    expect(encryptedIdFromRaw(raw)).toBe("AABBCCDDEEFF00112233445566778899");
  });
});
