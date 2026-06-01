import { connect, type ManagedCollection } from "framer-api";
import type { SyncEnv } from "../env";
import type { RssItem, SyncResult } from "../rss/types";
import { findManagedCollection } from "./collection";
import { LAST_SYNC_KEY, type LastSyncRecord } from "./last-sync";
import { buildCollectionFields, feedFingerprint, idsToRemove, rssItemToFieldData } from "./schema";

const FINGERPRINT_KEY = "lastFeedFingerprint";

export async function syncPressReleasesToFramer(
  env: SyncEnv,
  items: RssItem[],
): Promise<Omit<SyncResult, "pages">> {
  using framer = await connect(env.framerProjectUrl, env.framerApiKey);

  const collection = await ensureManagedCollection(framer, env.collectionName);
  const feedIds = new Set(items.map((item) => item["dc:identifier"]));
  const cmsIds = await collection.getItemIds();
  const removedIds = idsToRemove(feedIds, cmsIds);
  const fingerprint = feedFingerprint(items);
  const previousFingerprint = await collection.getPluginData(FINGERPRINT_KEY);
  const contentChanged = fingerprint !== previousFingerprint;

  if (contentChanged && items.length > 0) {
    const framerItems = items.map((item) => ({
      id: item["dc:identifier"],
      slug: item["dc:identifier"],
      fieldData: rssItemToFieldData(item),
    }));
    await collection.addItems(framerItems);
  }

  if (removedIds.length > 0) {
    await collection.removeItems(removedIds);
  }

  await collection.setPluginData(FINGERPRINT_KEY, fingerprint);

  const changed = contentChanged || removedIds.length > 0;
  let published = false;
  if (env.autoPublish && changed) {
    const { deployment } = await framer.publish();
    await framer.deploy(deployment.id);
    published = true;
  }

  const result = {
    fetched: items.length,
    upserted: contentChanged ? items.length : 0,
    removed: removedIds.length,
    collection: env.collectionName,
    published,
  };

  await collection.setPluginData(
    LAST_SYNC_KEY,
    JSON.stringify({ at: new Date().toISOString(), ...result } satisfies LastSyncRecord),
  );

  return result;
}

async function ensureManagedCollection(
  framer: Awaited<ReturnType<typeof connect>>,
  name: string,
): Promise<ManagedCollection> {
  const found = await findManagedCollection(framer, name);

  if (found) {
    await found.setFields(buildCollectionFields());
    return found;
  }

  const collection = await framer.createManagedCollection(name);
  await collection.setFields(buildCollectionFields());
  return collection;
}
