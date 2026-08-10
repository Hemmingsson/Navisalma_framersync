import { NextResponse } from "next/server";
import { connect } from "framer-api";
import { loadSyncEnv } from "@/lib/env";
import { FEED_FETCH_HEADERS, feedPageUrl } from "@/lib/rss/fetch-all-feed";
import { parseJsonFeed } from "@/lib/rss/parse-json-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const env = loadSyncEnv();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("deep") !== "1") {
      return NextResponse.json({ ok: true });
    }

    using framer = await connect(env.framerProjectUrl, env.framerApiKey);
    await framer.getProjectInfo();

    const probeUrl = feedPageUrl(env.feedUrl, 0, 1);
    const feedResponse = await fetch(probeUrl, {
      headers: FEED_FETCH_HEADERS,
      cache: "no-store",
    });

    if (!feedResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Feed fetch failed: ${feedResponse.status} ${feedResponse.statusText}`,
          feedUrl: probeUrl,
        },
        { status: 503 },
      );
    }

    const body = await feedResponse.text();
    parseJsonFeed(body);

    return NextResponse.json({ ok: true, feedUrl: probeUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
