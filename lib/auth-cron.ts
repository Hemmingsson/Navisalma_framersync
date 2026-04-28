import type { NextRequest } from "next/server";

/** Vercel cron and manual probes use `Authorization: Bearer ${CRON_SECRET}`. */
export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
