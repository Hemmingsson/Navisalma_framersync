export type ContentType = "press" | "financial" | "deck" | "other";

/** Shared copy for HTTP bodies when no feeds resolve (`run-sync`, `/api/test/cision`). */
export const MISSING_CISION_FEED_ENV_MESSAGE =
  "Set at least one CISION_FEED_ID_* variable — see .env.example.";

export type FeedLanguage = "en" | "sv";

export type FeedConfig = {
  feedId: string;
  contentType: ContentType;
  language: FeedLanguage;
  feedLabel: string;
};

type ExplicitRow = {
  /** First match wins (supports EN_PRESS vs PRESS_EN style names). */
  envKeys: string[];
  contentType: ContentType;
  language: FeedLanguage;
  feedLabel: string;
};

/**
 * Deterministic order: combined EN/SV “all” feeds, then press, financial, deck.
 * Each slot accepts alternate env key spellings (see `.env.example`).
 */
const EXPLICIT_FEED_ROWS: ExplicitRow[] = [
  {
    envKeys: ["CISION_FEED_ID_EN_ALL"],
    contentType: "other",
    language: "en",
    feedLabel: "all-en",
  },
  {
    envKeys: ["CISION_FEED_ID_SV_ALL"],
    contentType: "other",
    language: "sv",
    feedLabel: "all-sv",
  },
  {
    envKeys: ["CISION_FEED_ID_PRESS_EN", "CISION_FEED_ID_EN_PRESS"],
    contentType: "press",
    language: "en",
    feedLabel: "press-en",
  },
  {
    envKeys: ["CISION_FEED_ID_PRESS_SV", "CISION_FEED_ID_SV_PRESS"],
    contentType: "press",
    language: "sv",
    feedLabel: "press-sv",
  },
  {
    envKeys: ["CISION_FEED_ID_FINANCIAL_EN", "CISION_FEED_ID_EN_FINANCIAL"],
    contentType: "financial",
    language: "en",
    feedLabel: "financial-en",
  },
  {
    envKeys: ["CISION_FEED_ID_FINANCIAL_SV", "CISION_FEED_ID_SV_FINANCIAL"],
    contentType: "financial",
    language: "sv",
    feedLabel: "financial-sv",
  },
  {
    envKeys: ["CISION_FEED_ID_DECK_EN"],
    contentType: "deck",
    language: "en",
    feedLabel: "deck-en",
  },
  {
    envKeys: ["CISION_FEED_ID_DECK_SV"],
    contentType: "deck",
    language: "sv",
    feedLabel: "deck-sv",
  },
];

/** Env keys used for feeds — clear in tests so `resolveCisionFeeds()` is isolated from `.env`. */
export const CISION_FEED_ENV_KEYS: readonly string[] = Array.from(
  new Set(EXPLICIT_FEED_ROWS.flatMap((r) => r.envKeys)),
);

function trimEnv(key: string): string {
  const v = process.env[key];
  if (typeof v !== "string") return "";
  let s = v.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function firstNonEmptyFeedId(keys: string[]): string {
  for (const key of keys) {
    const id = trimEnv(key);
    if (id) return id;
  }
  return "";
}

/** Configured feeds in deterministic order (see `EXPLICIT_FEED_ROWS`). Empty if nothing set. */
export function resolveCisionFeeds(): FeedConfig[] {
  const out: FeedConfig[] = [];
  for (const row of EXPLICIT_FEED_ROWS) {
    const id = firstNonEmptyFeedId(row.envKeys);
    if (id) {
      out.push({
        feedId: id,
        contentType: row.contentType,
        language: row.language,
        feedLabel: row.feedLabel,
      });
    }
  }
  return out;
}
