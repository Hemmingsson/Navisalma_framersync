import { type NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth-cron";
import { encryptedIdFromRaw, fetchFeedPage, fetchReleaseRaw } from "@/lib/cision";
import {
  MISSING_CISION_FEED_ENV_MESSAGE,
  resolveCisionFeeds,
} from "@/lib/feed-id";
import { errorMessage } from "@/lib/retry-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized (use Authorization: Bearer + value of CRON_SECRET from env)",
      },
      { status: 401 },
    );
  }

  const feeds = resolveCisionFeeds();
  if (feeds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: MISSING_CISION_FEED_ENV_MESSAGE,
      },
      { status: 400 },
    );
  }

  const feedDiagnostics: Record<string, unknown>[] = [];

  for (const feed of feeds) {
    try {
      const feedResponse = await fetchFeedPage(feed.feedId, 1);
      const raw = feedResponse.Releases?.[0];
      const firstId = raw ? encryptedIdFromRaw(raw as Record<string, unknown>) : null;
      let detailKeys: string[] | null = null;
      if (firstId) {
        const detail = await fetchReleaseRaw(firstId).catch(() => null);
        if (detail) detailKeys = Object.keys(detail).sort();
      }

      feedDiagnostics.push({
        feedLabel: feed.feedLabel,
        language: feed.language,
        feedId: feed.feedId,
        totalFound: feedResponse.TotalFoundReleases ?? null,
        pageSize: feedResponse.PageSize ?? null,
        firstPageReleaseCount: feedResponse.Releases?.length ?? 0,
        firstEncryptedId: firstId ?? null,
        detailKeys,
      });
    } catch (e) {
      feedDiagnostics.push({
        feedLabel: feed.feedLabel,
        language: feed.language,
        feedId: feed.feedId,
        error: errorMessage(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    feedsConfigured: feeds.length,
    feeds: feedDiagnostics,
  });
}
