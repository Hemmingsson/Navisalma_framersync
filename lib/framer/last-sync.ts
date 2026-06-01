import { connect } from "framer-api";
import type { SyncEnv } from "../env";
import type { SyncResult } from "../rss/types";
import { findManagedCollection } from "./collection";

export const LAST_SYNC_KEY = "lastSync";

export type LastSyncRecord = { at: string } & Omit<SyncResult, "pages">;

export function parseLastSync(raw: string | null | undefined): LastSyncRecord | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as LastSyncRecord;
    if (typeof data.at !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export async function readLastSync(env: SyncEnv): Promise<LastSyncRecord | null> {
  using framer = await connect(env.framerProjectUrl, env.framerApiKey);
  const collection = await findManagedCollection(framer, env.collectionName);
  if (!collection) return null;
  return parseLastSync(await collection.getPluginData(LAST_SYNC_KEY));
}

export function formatLastSync(record: LastSyncRecord): string {
  const when = new Date(record.at).toLocaleString("en-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Last sync ${when} · ${record.fetched} items`;
}
