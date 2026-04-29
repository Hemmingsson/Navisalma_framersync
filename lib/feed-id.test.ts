import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCisionFeeds } from "./feed-id";

function captureCisionEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("CISION_")) snap[k] = process.env[k];
  }
  return snap;
}

function clearCisionEnv() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("CISION_")) delete process.env[k];
  }
}

function restoreCisionEnv(snap: Record<string, string | undefined>) {
  clearCisionEnv();
  for (const [k, v] of Object.entries(snap)) {
    if (v !== undefined) process.env[k] = v;
  }
}

describe("resolveCisionFeeds", () => {
  let baseline: Record<string, string | undefined>;

  beforeEach(() => {
    baseline = captureCisionEnv();
    clearCisionEnv();
  });

  afterEach(() => {
    restoreCisionEnv(baseline);
  });

  it("returns legacy single feed when only CISION_FEED_ID is set", () => {
    process.env.CISION_FEED_ID = "LEGACYFEED";
    const feeds = resolveCisionFeeds();
    expect(feeds).toHaveLength(1);
    expect(feeds[0]?.feedLabel).toBe("legacy");
    expect(feeds[0]?.feedId).toBe("LEGACYFEED");
  });

  it("uses explicit feeds in deterministic order when set", () => {
    process.env.CISION_FEED_ID_PRESS_EN = "P1";
    process.env.CISION_FEED_ID_EN_FINANCIAL = "F1";
    const feeds = resolveCisionFeeds();
    expect(feeds.map((f) => f.feedLabel)).toEqual(["press-en", "financial-en"]);
  });

  it("trims quotes from env values", () => {
    process.env.CISION_FEED_ID = '"ABCDEF0123456789ABCDEF01234567890"';
    const feeds = resolveCisionFeeds();
    expect(feeds[0]?.feedId).toBe("ABCDEF0123456789ABCDEF01234567890");
  });
});
