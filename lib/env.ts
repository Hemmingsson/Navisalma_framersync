import { DEFAULT_COLLECTION_NAME, DEFAULT_RSS_URL } from "./config";

export type SyncEnv = {
  framerProjectUrl: string;
  framerApiKey: string;
  cronSecret: string;
  collectionName: string;
  rssUrl: string;
  autoPublish: boolean;
};

export function loadSyncEnv(): SyncEnv {
  return {
    framerProjectUrl: required("FRAMER_PROJECT_URL"),
    framerApiKey: required("FRAMER_API_KEY"),
    cronSecret: required("CRON_SECRET"),
    collectionName: process.env.FRAMER_COLLECTION_NAME?.trim() || DEFAULT_COLLECTION_NAME,
    rssUrl: process.env.NOTIFIED_RSS_URL?.trim() || DEFAULT_RSS_URL,
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
