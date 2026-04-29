import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CISION_FEED_ENV_KEYS,
  resolveCisionFeeds,
} from "./feed-id";

describe("resolveCisionFeeds", () => {
  beforeEach(() => {
    for (const k of CISION_FEED_ENV_KEYS) {
      vi.stubEnv(k, "");
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns feeds in fixed order when multiple vars are set", () => {
    vi.stubEnv("CISION_FEED_ID_PRESS_EN", "P1");
    vi.stubEnv("CISION_FEED_ID_EN_FINANCIAL", "F1");
    expect(resolveCisionFeeds().map((f) => f.feedLabel)).toEqual([
      "press-en",
      "financial-en",
    ]);
  });

  it("trims quotes from env values", () => {
    vi.stubEnv(
      "CISION_FEED_ID_EN_PRESS",
      '"ABCDEF0123456789ABCDEF01234567890"',
    );
    expect(resolveCisionFeeds()[0]?.feedId).toBe(
      "ABCDEF0123456789ABCDEF01234567890",
    );
  });

  it("returns empty when every feed env is unset", () => {
    expect(resolveCisionFeeds()).toEqual([]);
  });
});
