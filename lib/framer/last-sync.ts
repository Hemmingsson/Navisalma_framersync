import { connect } from "framer-api";
import type { SyncEnv } from "../env";
import type { SyncResult } from "../rss/types";
import { findManagedCollection } from "./collection";

export const LAST_SYNC_KEY = "lastSync";

export const STALE_SYNC_MS = 5 * 60 * 1000;

export type LastSyncRecord = { at: string } & Omit<SyncResult, "pages">;

export type SyncStatus = "ok" | "stale" | "error";

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

export function syncStatusFromLastSync(
  lastSync: LastSyncRecord | null,
  now = Date.now(),
): Exclude<SyncStatus, "error"> {
  if (!lastSync) return "stale";
  const age = now - new Date(lastSync.at).getTime();
  if (Number.isNaN(age) || age > STALE_SYNC_MS) return "stale";
  return "ok";
}

export function formatLastSync(record: LastSyncRecord): string {
  const when = new Date(record.at).toLocaleString("en-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Last sync ${when} · ${record.fetched} items`;
}

export async function readSyncStatus(env: SyncEnv): Promise<{
  status: SyncStatus;
  lastSync: LastSyncRecord | null;
  syncLine: string;
}> {
  try {
    const lastSync = await readLastSync(env);
    const status = syncStatusFromLastSync(lastSync);
    const syncLine = lastSync ? formatLastSync(lastSync) : "No sync recorded yet";
    return { status, lastSync, syncLine };
  } catch {
    return { status: "error", lastSync: null, syncLine: "Configuration error" };
  }
}

export const STATUS_DOT_COLORS: Record<SyncStatus, string> = {
  ok: "#22c55e",
  stale: "#f59e0b",
  error: "#ef4444",
};
