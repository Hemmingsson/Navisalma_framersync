import { NextResponse } from "next/server";
import { loadNewsletterEnv } from "@/lib/features/hubspot-newsletter/env";
import { buildHubSpotSubmission, submitToHubSpot } from "@/lib/features/hubspot-newsletter/submit";
import { verifyFramerSignature } from "@/lib/features/hubspot-newsletter/verify-framer-signature";

export const dynamic = "force-dynamic";

/**
 * Framer form webhook → HubSpot form submission.
 * Framer retries non-2xx up to 5 times, so only return non-2xx when a retry can help.
 */
export async function POST(request: Request) {
  let env;
  try {
    env = loadNewsletterEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration error";
    console.error("[newsletter]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  const isSigned = verifyFramerSignature(
    body,
    request.headers.get("framer-webhook-submission-id"),
    request.headers.get("framer-signature"),
    env.webhookSecret,
  );
  if (!isSigned) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: unknown;
  try {
    formData = JSON.parse(body.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const submission = buildHubSpotSubmission(formData);
  if (!submission) {
    console.error("[newsletter] submission without email", Object.keys(formData ?? {}));
    return NextResponse.json({ ok: false, error: "Missing email" });
  }

  const result = await submitToHubSpot(env, submission);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  console.error("[newsletter] HubSpot rejected submission", result.status, result.error);
  return NextResponse.json(
    { ok: false, error: `HubSpot ${result.status || "request failed"}` },
    { status: result.retryable ? 502 : 200 },
  );
}
