import { type NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth-cron";
import { fetchFeed, fetchRelease, normalizeCisionRelease } from "@/lib/cision";
import { resolveCisionFeedId } from "@/lib/feed-id";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized (use Authorization: Bearer + value of CRON_SECRET from env)" },
      { status: 401 },
    );
  }

  const feedId = resolveCisionFeedId();
  if (!feedId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Set CISION_FEED_ID or CISION_FEED_ID_EN_PRESS in env (not in source files).",
      },
      { status: 400 },
    );
  }

  try {
    const feed = await fetchFeed(feedId);
    const raw = feed.Releases?.[0];
    const firstId = raw?.EncryptedId?.trim();
    let detailSample: ReturnType<typeof normalizeCisionRelease> | null = null;
    if (firstId) {
      detailSample = await fetchRelease(firstId).catch(() =>
        raw ? normalizeCisionRelease(raw) : null,
      );
    }

    return NextResponse.json({
      ok: true,
      feedId,
      totalFound: feed.TotalFoundReleases ?? null,
      pageSize: feed.PageSize ?? null,
      releaseCount: feed.Releases?.length ?? 0,
      firstEncryptedId: firstId ?? null,
      detailKeys:
        detailSample &&
        (Object.keys(detailSample) as (keyof typeof detailSample)[]),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
