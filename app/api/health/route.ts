import { NextResponse } from "next/server";
import { connect } from "framer-api";
import { featureEnvStatus } from "@/lib/features/env-status";
import { loadSyncEnv } from "@/lib/features/notified-sync/env";
import { FEED_FETCH_HEADERS, feedPageUrl } from "@/lib/features/notified-sync/rss/fetch-all-feed";
import { parseJsonFeed } from "@/lib/features/notified-sync/rss/parse-json-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const status = featureEnvStatus();
  const { searchParams } = new URL(request.url);

  if (searchParams.get("deep") !== "1" || status.features.notifiedSync !== "ok") {
    return NextResponse.json(status, { status: status.ok ? 200 : 503 });
  }

  try {
    const env = loadSyncEnv();
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
          ...status,
          ok: false,
          error: `Feed fetch failed: ${feedResponse.status} ${feedResponse.statusText}`,
          feedUrl: probeUrl,
        },
        { status: 503 },
      );
    }

    const body = await feedResponse.text();
    parseJsonFeed(body);

    return NextResponse.json({ ...status, feedUrl: probeUrl }, { status: status.ok ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return NextResponse.json({ ...status, ok: false, error: message }, { status: 503 });
  }
}
