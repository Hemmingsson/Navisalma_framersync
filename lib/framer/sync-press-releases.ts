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
const SYNC_LOCK_KEY = "syncInProgress";
const COVER_IMAGE_SYNC_VERSION_KEY = "coverImageSyncVersion";
/** Bump when cover-image field handling changes to force one full re-upsert. */
const COVER_IMAGE_SYNC_VERSION = "2";
const SYNC_LOCK_TTL_MS = 5 * 60 * 1000;
const UPSERT_BATCH_SIZE = 5;

async function acquireSyncLock(collection: ManagedCollection): Promise<boolean> {
  const raw = await collection.getPluginData(SYNC_LOCK_KEY);
  if (raw) {
    try {
      const { startedAt } = JSON.parse(raw) as { startedAt: string };
      if (Date.now() - new Date(startedAt).getTime() < SYNC_LOCK_TTL_MS) return false;
    } catch {
      // Stale or corrupt lock — overwrite below.
    }
  }
  await collection.setPluginData(
    SYNC_LOCK_KEY,
    JSON.stringify({ startedAt: new Date().toISOString() }),
  );
  return true;
}

async function releaseSyncLock(collection: ManagedCollection): Promise<void> {
  await collection.setPluginData(SYNC_LOCK_KEY, "");
}

async function upsertItemsInBatches(
  collection: ManagedCollection,
  items: JsonFeedItem[],
): Promise<void> {
  for (let i = 0; i < items.length; i += UPSERT_BATCH_SIZE) {
    const batch = items.slice(i, i + UPSERT_BATCH_SIZE);
    const framerItems = batch.map((item) => {
      const id = String(item.Identifier);
      return {
        id,
        slug: id,
        fieldData: jsonFeedItemToFieldData(item),
      };
    });
    await collection.addItems(framerItems);
  }
}

export async function syncPressReleasesToFramer(
  env: SyncEnv,
  items: JsonFeedItem[],
): Promise<Omit<SyncResult, "pages">> {
  if (items.length === 0) {
    throw new Error("Empty feed; refusing to reconcile (would wipe collection)");
  }

  using framer = await connect(env.framerProjectUrl, env.framerApiKey);

  const collection = await ensureManagedCollection(framer, env.collectionName);

  if (!(await acquireSyncLock(collection))) {
    return {
      fetched: items.length,
      upserted: 0,
      removed: 0,
      changed: false,
      collection: env.collectionName,
      published: false,
      skipped: true,
    };
  }

  try {
    const feedIds = new Set(items.map((item) => String(item.Identifier)));
    const cmsIds = await collection.getItemIds();
    const removedIds = idsToRemove(feedIds, cmsIds);
    const fingerprint = feedFingerprint(items);
    const previousFingerprint = await collection.getPluginData(FINGERPRINT_KEY);
    const coverSyncVersion = await collection.getPluginData(COVER_IMAGE_SYNC_VERSION_KEY);
    const needsCoverMigration = coverSyncVersion !== COVER_IMAGE_SYNC_VERSION;
    const contentChanged = fingerprint !== previousFingerprint || needsCoverMigration;

    if (contentChanged) {
      await upsertItemsInBatches(collection, items);
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
    if (needsCoverMigration) {
      await collection.setPluginData(COVER_IMAGE_SYNC_VERSION_KEY, COVER_IMAGE_SYNC_VERSION);
    }

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
  } finally {
    await releaseSyncLock(collection);
  }
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
