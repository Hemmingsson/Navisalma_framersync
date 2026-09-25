import { NextResponse, type NextRequest } from "next/server";

/** A browser GET on the webhook URL shows the status page; Framer's POST passes through. */
export function middleware(request: NextRequest) {
  if (request.method === "GET") {
    return NextResponse.rewrite(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/forms/newsletter" };
