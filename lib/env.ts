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
    framerProjectUrl: required("FRAMER_PROJECT_URL"),
    framerApiKey: required("FRAMER_API_KEY"),
    cronSecret: required("CRON_SECRET"),
    collectionName: process.env.FRAMER_COLLECTION_NAME?.trim() || DEFAULT_COLLECTION_NAME,
    feedUrl: normalizeFeedUrl(
      process.env.NOTIFIED_FEED_URL?.trim() ||
        process.env.NOTIFIED_RSS_URL?.trim() ||
        buildFeedUrl(DEFAULT_FEED_SETTINGS),
    ),
    autoPublish: process.env.AUTO_PUBLISH?.trim().toLowerCase() !== "false",
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
