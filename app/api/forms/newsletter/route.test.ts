import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const secret = "s".repeat(32);
const submissionId = "0fbbb90e-564b-4870-ac8b-78f9bc4e44a6";

function framerRequest(payload: unknown, { signWith = secret } = {}): Request {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", signWith).update(body).update(submissionId).digest("hex")}`;
  return new Request("http://localhost/api/forms/newsletter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Framer-Signature": signature,
      "Framer-Webhook-Submission-Id": submissionId,
    },
    body,
  });
}

describe("POST /api/forms/newsletter", () => {
  beforeEach(() => {
    vi.stubEnv("HUBSPOT_PORTAL_ID", "145013763");
    vi.stubEnv("HUBSPOT_FORM_GUID", "5878847b-eb37-4377-9d56-90c215020dba");
    vi.stubEnv("FRAMER_FORM_WEBHOOK_SECRET", secret);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards a signed submission to HubSpot EU", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(framerRequest({ firstname: "Ada", lastname: "L", email: "a@b.co" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      "https://api-eu1.hsforms.com/submissions/v3/integration/submit/145013763/5878847b-eb37-4377-9d56-90c215020dba",
    );
  });

  it("rejects an unsigned or wrongly signed request without calling HubSpot", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(framerRequest({ email: "a@b.co" }, { signWith: "t".repeat(32) }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 200 without retry when HubSpot rejects the input", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("INVALID_EMAIL", { status: 400 })));

    const response = await POST(framerRequest({ email: "not-an-email" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, error: "HubSpot 400" });
  });

  it("returns 502 so Framer retries when HubSpot is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));

    const response = await POST(framerRequest({ email: "a@b.co" }));

    expect(response.status).toBe(502);
  });

  it("returns 200 without calling HubSpot when email is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(framerRequest({ firstname: "Ada" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, error: "Missing email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 when env is missing", async () => {
    vi.stubEnv("HUBSPOT_FORM_GUID", "");

    const response = await POST(framerRequest({ email: "a@b.co" }));

    expect(response.status).toBe(500);
  });
});
