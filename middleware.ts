import { NextResponse } from "next/server";
import { isDevEnvironment } from "@/lib/dev-only";

export function middleware() {
  if (isDevEnvironment()) return NextResponse.next();
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/feed-demo/:path*", "/api/feed-preview/:path*"],
};
