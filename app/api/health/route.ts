import { NextResponse } from "next/server";
import { loadSyncEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    loadSyncEnv();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
