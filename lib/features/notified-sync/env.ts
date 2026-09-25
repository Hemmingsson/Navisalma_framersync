import { requiredEnv } from "@/lib/shared/env";
import { DEFAULT_COLLECTION_NAME } from "./config";
import { buildFeedUrl } from "./rss/build-feed-url";
import { DEFAULT_FEED_SETTINGS } from "./rss/feed-settings";

export type SyncEnv = {
  framerProjectUrl: string;
  framerApiKey: string;
  cronSecret: string;
  collectionName: string;
  feedUrl: string;
  autoPublish: boolean;
};

function normalizeFeedUrl(url: string): string {
  return url.replace(/\/RssFeed\//gi, "/JsonFeed/");
}

export function loadSyncEnv(): SyncEnv {
  return {
    framerProjectUrl: requiredEnv("FRAMER_PROJECT_URL"),
    framerApiKey: requiredEnv("FRAMER_API_KEY"),
    cronSecret: requiredEnv("CRON_SECRET"),
    collectionName: process.env.FRAMER_COLLECTION_NAME?.trim() || DEFAULT_COLLECTION_NAME,
    feedUrl: normalizeFeedUrl(
      process.env.NOTIFIED_FEED_URL?.trim() ||
        process.env.NOTIFIED_RSS_URL?.trim() ||
        buildFeedUrl(DEFAULT_FEED_SETTINGS),
    ),
    autoPublish: process.env.AUTO_PUBLISH?.trim().toLowerCase() !== "false",
  };
}
