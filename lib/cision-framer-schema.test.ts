import { describe, expect, it } from "vitest";
import {
  CISION_RELEASE_FIELD_KEYS,
  rawReleaseToFieldData,
} from "./cision-framer-schema";

describe("rawReleaseToFieldData", () => {
  it("stringifies nested objects and arrays", () => {
    const fd = rawReleaseToFieldData({
      Title: "Hello",
      Images: [{ DownloadUrl: "https://x.test/a.jpg" }],
      Categories: [],
      IsRegulatory: true,
      UnknownKey: "ignored",
    } as Record<string, unknown>);
    expect(fd.Title).toEqual({ type: "string", value: "Hello" });
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
  });
});

describe("CISION_RELEASE_FIELD_KEYS", () => {
  it("includes EncryptedId once", () => {
    expect(CISION_RELEASE_FIELD_KEYS.filter((k) => k === "EncryptedId")).toEqual(
      ["EncryptedId"],
    );
  });
});
