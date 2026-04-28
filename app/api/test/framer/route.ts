import { type NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth-cron";
import { inspectFramerReadOnly } from "@/lib/framer-readonly";

export const dynamic = "force-dynamic";

/** Read-only: project + CMS field layout. No writes. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized (use Authorization: Bearer + CRON_SECRET from env)" },
      { status: 401 },
    );
  }

  const result = await inspectFramerReadOnly();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result.data });
}
