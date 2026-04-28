import { type NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth-cron";
import { runSync } from "@/lib/run-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function allowManualTrigger(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return isCronAuthorized(request);
}

export async function POST(request: NextRequest) {
  if (!allowManualTrigger(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Forbidden: use dev server without auth, or Authorization: Bearer CRON_SECRET in production.",
      },
      { status: 403 },
    );
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
