import type { SyncResult } from "../rss/types";

export const LAST_SYNC_KEY = "lastSync";

export type LastSyncRecord = { at: string } & Omit<SyncResult, "pages">;

export function parseLastSync(raw: string | null | undefined): LastSyncRecord | null {
  if (!raw?.trim()) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof d.at === "string" &&
      typeof d.fetched === "number" &&
      typeof d.upserted === "number" &&
      typeof d.removed === "number" &&
      typeof d.changed === "boolean" &&
      typeof d.collection === "string" &&
      typeof d.published === "boolean"
    ) {
      return d as unknown as LastSyncRecord;
    }
    return null;
  } catch {
    return null;
  }
}
