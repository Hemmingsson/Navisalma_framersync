import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Framer form webhook signature: `sha256=` + hex HMAC-SHA256 over the raw body
 * followed by the `Framer-Webhook-Submission-Id` header value.
 */
export function verifyFramerSignature(
  body: Buffer,
  submissionId: string | null,
  signature: string | null,
  secret: string,
): boolean {
  if (!submissionId || !signature) return false;

  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  hmac.update(submissionId);
  const expected = Buffer.from(`sha256=${hmac.digest("hex")}`);
  const actual = Buffer.from(signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
