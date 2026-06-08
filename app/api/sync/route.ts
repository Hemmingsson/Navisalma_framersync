import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth-cron";
import { loadSyncEnv } from "@/lib/env";
import { runSync } from "@/lib/sync/run-sync";

export const dynamic = "force-dynamic";
/** Schema migrations upsert all items + publish; needs headroom on Vercel Pro. */
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const env = loadSyncEnv();

    if (!isAuthorizedCronRequest(request, env.cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runSync(env);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
