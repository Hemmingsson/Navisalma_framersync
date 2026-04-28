import { type NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth-cron";
import { runSync } from "@/lib/run-sync";

export const dynamic = "force-dynamic";
/** Vercel / Fluid: raise if sync exceeds default (often 10s on Hobby). */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      feedItems: result.feedItems,
      releasesPrepared: result.releasesPrepared,
      errors: result.errors,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
