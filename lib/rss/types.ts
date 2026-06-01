export type { RssItem, RssChannel, RssFeedDocument } from "./parse-rss-feed";

export type SyncResult = {
  fetched: number;
  pages: number;
  upserted: number;
  removed: number;
  collection: string;
  published: boolean;
};
