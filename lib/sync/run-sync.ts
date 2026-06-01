import type { SyncEnv } from "../env";
import { fetchAllFeedItems } from "../rss/fetch-all-feed";
import type { SyncResult } from "../rss/types";
import { syncPressReleasesToFramer } from "../framer/sync-press-releases";

export async function runSync(env: SyncEnv): Promise<SyncResult> {
  const { items, pages } = await fetchAllFeedItems(env.feedUrl);
  const result = await syncPressReleasesToFramer(env, items);
  return { ...result, pages };
}
