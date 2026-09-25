import type { NewsletterEnv } from "./env";

/** HubSpot internal field names; Framer form inputs must use the same names. */
export const NEWSLETTER_FIELDS = ["firstname", "lastname", "email"] as const;

const SUBMIT_TIMEOUT_MS = 10_000;

export type HubSpotSubmission = {
  fields: { name: (typeof NEWSLETTER_FIELDS)[number]; value: string }[];
};

export type SubmitResult =
  | { ok: true }
  | { ok: false; retryable: boolean; status: number; error: string };

/** Map a Framer webhook payload to a HubSpot submission; null when email is missing. */
export function buildHubSpotSubmission(formData: unknown): HubSpotSubmission | null {
  if (typeof formData !== "object" || formData === null) return null;
  const data = formData as Record<string, unknown>;

  const fields = NEWSLETTER_FIELDS.flatMap((name) => {
    const value = data[name];
    return typeof value === "string" && value.trim() ? [{ name, value: value.trim() }] : [];
  });

  return fields.some((field) => field.name === "email") ? { fields } : null;
}

export function hubSpotSubmitUrl(env: NewsletterEnv): string {
  return `${env.submitBase}/${env.portalId}/${env.formGuid}`;
}

export async function submitToHubSpot(
  env: NewsletterEnv,
  submission: HubSpotSubmission,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(hubSpotSubmitUrl(env), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HubSpot request failed";
    return { ok: false, retryable: true, status: 0, error: message };
  }

  if (response.ok) return { ok: true };

  const text = await response.text();
  // 429 and 5xx may succeed later; other 4xx (bad email, wrong form) will not.
  const retryable = response.status === 429 || response.status >= 500;
  return { ok: false, retryable, status: response.status, error: text.slice(0, 1000) };
}
