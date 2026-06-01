export type { JsonFeedItem } from "./parse-json-feed";

export type SyncResult = {
  fetched: number;
  pages: number;
  upserted: number;
  removed: number;
  changed: boolean;
  collection: string;
  published: boolean;
};
