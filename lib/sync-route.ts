import { NextResponse } from "next/server";
import { runSync, type RunSyncResult } from "./run-sync";

function syncOkBody(result: RunSyncResult) {
  return {
    ok: true as const,
    hasErrors: result.hasErrors,
    synced: result.synced,
    feedItems: result.feedItems,
    releasesPrepared: result.releasesPrepared,
    duplicateEncryptedIdsDropped: result.duplicateEncryptedIdsDropped,
    feedResults: result.feedResults,
    errors: result.errors,
    framerErrorsUnattributed: result.framerErrorsUnattributed,
  };
}

/** Shared HTTP success/error wrapper for cron + manual sync routes. */
export async function runSyncNextResponse(): Promise<NextResponse> {
  try {
    const result = await runSync();
    return NextResponse.json(syncOkBody(result));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
