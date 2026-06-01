import { connect, type ManagedCollection } from "framer-api";
import type { SyncEnv } from "../env";
import type { JsonFeedItem, SyncResult } from "../rss/types";
import { findManagedCollection } from "./collection";
import { LAST_SYNC_KEY, type LastSyncRecord } from "./last-sync";
import {
  buildCollectionFields,
  feedFingerprint,
  idsToRemove,
  jsonFeedItemToFieldData,
  schemaFingerprint,
} from "./schema";

const FINGERPRINT_KEY = "lastFeedFingerprint";
const SCHEMA_FINGERPRINT_KEY = "lastSchemaFingerprint";

export async function syncPressReleasesToFramer(
  env: SyncEnv,
  items: JsonFeedItem[],
): Promise<Omit<SyncResult, "pages">> {
  if (items.length === 0) {
    throw new Error("Empty feed; refusing to reconcile (would wipe collection)");
  }

  using framer = await connect(env.framerProjectUrl, env.framerApiKey);

  const collection = await ensureManagedCollection(framer, env.collectionName);
  const feedIds = new Set(items.map((item) => String(item.Identifier)));
  const cmsIds = await collection.getItemIds();
  const removedIds = idsToRemove(feedIds, cmsIds);
  const fingerprint = feedFingerprint(items);
  const previousFingerprint = await collection.getPluginData(FINGERPRINT_KEY);
  const contentChanged = fingerprint !== previousFingerprint;

  if (contentChanged && items.length > 0) {
    const framerItems = items.map((item) => {
      const id = String(item.Identifier);
      return {
        id,
        slug: id,
        fieldData: jsonFeedItemToFieldData(item),
      };
    });
    await collection.addItems(framerItems);
  }

  if (removedIds.length > 0) {
    await collection.removeItems(removedIds);
  }

  const changed = contentChanged || removedIds.length > 0;
  let published = false;
  if (env.autoPublish && changed) {
    const { deployment } = await framer.publish();
    await framer.deploy(deployment.id);
    published = true;
  }

  await collection.setPluginData(FINGERPRINT_KEY, fingerprint);

  const result = {
    fetched: items.length,
    upserted: contentChanged ? items.length : 0,
    removed: removedIds.length,
    changed,
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
  const current = schemaFingerprint();

  if (found) {
    const stored = await found.getPluginData(SCHEMA_FINGERPRINT_KEY);
    if (stored !== current) {
      await found.setFields(buildCollectionFields());
      await found.setPluginData(SCHEMA_FINGERPRINT_KEY, current);
    }
    return found;
  }

  const collection = await framer.createManagedCollection(name);
  await collection.setFields(buildCollectionFields());
  await collection.setPluginData(SCHEMA_FINGERPRINT_KEY, current);
  return collection;
}
