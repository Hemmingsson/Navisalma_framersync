export type ContentType = "press" | "financial" | "deck" | "other";

/** Shared copy for HTTP bodies when no feeds resolve (`run-sync`, `/api/test/cision`). */
export const MISSING_CISION_FEED_ENV_MESSAGE =
  "Set CISION_FEED_ID (legacy) or explicit CISION_FEED_ID_* variables — see .env.example.";

export type FeedLanguage = "en" | "sv" | "unknown";

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

/**
 * Returns configured feeds in deterministic order.
 * - If any explicit multi-feed key is non-empty, only those feeds are returned (legacy ids ignored).
 * - Else if `CISION_FEED_ID` or legacy `CISION_FEED_ID_EN_PRESS` is set: single feed (press, unknown language).
 * - Else empty (caller treats as missing feed configuration).
 */
export function resolveCisionFeeds(): FeedConfig[] {
  const explicit: FeedConfig[] = [];
  for (const row of EXPLICIT_FEED_ROWS) {
    const id = firstNonEmptyFeedId(row.envKeys);
    if (id) {
      explicit.push({
        feedId: id,
        contentType: row.contentType,
        language: row.language,
        feedLabel: row.feedLabel,
      });
    }
  }

  if (explicit.length > 0) return explicit;

  const legacy =
    trimEnv("CISION_FEED_ID") || trimEnv("CISION_FEED_ID_EN_PRESS");
  if (legacy) {
    return [
      {
        feedId: legacy,
        contentType: "press",
        language: "unknown",
        feedLabel: "legacy",
      },
    ];
  }

  return [];
}

/** Prefer resolveCisionFeeds(); kept for backward compatibility — returns first feed id or "". */
export function resolveCisionFeedId(): string {
  const feeds = resolveCisionFeeds();
  return feeds[0]?.feedId ?? "";
}
