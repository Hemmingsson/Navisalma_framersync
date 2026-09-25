import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyFramerSignature } from "./verify-framer-signature";

const secret = "s".repeat(32);
const body = Buffer.from('{"email":"a@b.co"}');
const submissionId = "0fbbb90e-564b-4870-ac8b-78f9bc4e44a6";

function sign(payload: Buffer, id: string, key = secret): string {
  return `sha256=${createHmac("sha256", key).update(payload).update(id).digest("hex")}`;
}

describe("verifyFramerSignature", () => {
  it("accepts a valid signature over body + submission id", () => {
    expect(verifyFramerSignature(body, submissionId, sign(body, submissionId), secret)).toBe(true);
  });

  it("rejects a wrong secret, tampered body, or other submission id", () => {
    expect(verifyFramerSignature(body, submissionId, sign(body, submissionId, "t".repeat(32)), secret)).toBe(false);
    expect(verifyFramerSignature(Buffer.from("{}"), submissionId, sign(body, submissionId), secret)).toBe(false);
    expect(verifyFramerSignature(body, "other", sign(body, submissionId), secret)).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(verifyFramerSignature(body, null, sign(body, submissionId), secret)).toBe(false);
    expect(verifyFramerSignature(body, submissionId, null, secret)).toBe(false);
    expect(verifyFramerSignature(body, submissionId, "sha256=short", secret)).toBe(false);
  });
});
