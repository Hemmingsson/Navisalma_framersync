import { NextResponse } from "next/server";
import { buildFeedUrl } from "@/lib/rss/build-feed-url";
import { settingsFromSearchParams } from "@/lib/rss/feed-settings";
import { parseJsonFeedFromParsed } from "@/lib/rss/parse-json-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settings = settingsFromSearchParams(searchParams);
  const feedUrl = buildFeedUrl(settings);

  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const body = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          feedUrl,
          settings,
          error: `Feed returned ${response.status} ${response.statusText}`,
          raw: body.slice(0, 4000),
        },
        { status: response.status },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { ok: false, feedUrl, settings, error: "Feed parse failed: invalid JSON", raw: body.slice(0, 4000) },
        { status: 502 },
      );
    }

    try {
      const jsonItems = parseJsonFeedFromParsed(parsed);
      return NextResponse.json({
        ok: true,
        feedUrl,
        settings,
        jsonItems,
        itemCount: jsonItems.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Feed parse failed";
      return NextResponse.json(
        { ok: false, feedUrl, settings, error: message, raw: body.slice(0, 4000) },
        { status: 502 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed fetch failed";
    return NextResponse.json({ ok: false, feedUrl, settings, error: message }, { status: 500 });
  }
}
