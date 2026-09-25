import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHubSpotSubmission, hubSpotSubmitUrl, submitToHubSpot } from "./submit";

const env = {
  portalId: "145013763",
  formGuid: "5878847b-eb37-4377-9d56-90c215020dba",
  submitBase: "https://api-eu1.hsforms.com/submissions/v3/integration/submit",
  webhookSecret: "x".repeat(32),
};

describe("buildHubSpotSubmission", () => {
  it("maps known Framer inputs to HubSpot fields and drops the rest", () => {
    expect(
      buildHubSpotSubmission({
        firstname: " Ada ",
        lastname: "Lovelace",
        email: "ada@example.com",
        extra: "ignored",
      }),
    ).toEqual({
      fields: [
        { name: "firstname", value: "Ada" },
        { name: "lastname", value: "Lovelace" },
        { name: "email", value: "ada@example.com" },
      ],
    });
  });

  it("omits empty optional fields", () => {
    expect(buildHubSpotSubmission({ email: "a@b.co", lastname: "  " })).toEqual({
      fields: [{ name: "email", value: "a@b.co" }],
    });
  });

  it("returns null without an email", () => {
    expect(buildHubSpotSubmission({ firstname: "Ada" })).toBeNull();
    expect(buildHubSpotSubmission(null)).toBeNull();
    expect(buildHubSpotSubmission("email")).toBeNull();
  });
});

describe("submitToHubSpot", () => {
  afterEach(() => vi.unstubAllGlobals());

  const submission = { fields: [{ name: "email" as const, value: "a@b.co" }] };

  it("posts to the portal/form URL", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await submitToHubSpot(env, submission)).toEqual({ ok: true });
    expect(hubSpotSubmitUrl(env)).toBe(
      "https://api-eu1.hsforms.com/submissions/v3/integration/submit/145013763/5878847b-eb37-4377-9d56-90c215020dba",
    );
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(hubSpotSubmitUrl(env));
    expect(JSON.parse(init.body as string)).toEqual(submission);
  });

  it.each([
    [400, false],
    [404, false],
    [429, true],
    [503, true],
  ])("HubSpot %i → retryable %s", async (status, retryable) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status })));
    expect(await submitToHubSpot(env, submission)).toEqual({
      ok: false,
      retryable,
      status,
      error: "nope",
    });
  });

  it("treats network errors as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNRESET"))));
    expect(await submitToHubSpot(env, submission)).toMatchObject({ ok: false, retryable: true });
  });
});
