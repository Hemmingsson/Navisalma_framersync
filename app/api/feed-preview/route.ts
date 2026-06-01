import { NextResponse } from "next/server";
import { buildFeedUrl } from "@/lib/rss/build-feed-url";
import { settingsFromSearchParams } from "@/lib/rss/feed-settings";
import { parseJsonFeed } from "@/lib/rss/parse-json-feed";
import { parseRssFeed } from "@/lib/rss/parse-rss-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settings = settingsFromSearchParams(searchParams);
  const feedUrl = buildFeedUrl(settings);

  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: "application/rss+xml, application/json, application/xml, text/xml" },
      cache: "no-store",
    });

    const body = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          feedUrl,
          settings,
          format: settings.format,
          error: `Feed returned ${response.status} ${response.statusText}`,
          raw: body.slice(0, 4000),
        },
        { status: response.status },
      );
    }

    if (settings.format === "json") {
      let parsed: unknown = null;
      let jsonItems = [] as ReturnType<typeof parseJsonFeed>;

      try {
        parsed = JSON.parse(body);
        jsonItems = parseJsonFeed(body);
      } catch {
        parsed = null;
      }

      return NextResponse.json({
        ok: true,
        feedUrl,
        settings,
        format: "json",
        parsed,
        jsonItems,
        raw: body,
        itemCount: jsonItems.length,
      });
    }

    const parsed = parseRssFeed(body);

    return NextResponse.json({
      ok: true,
      feedUrl,
      settings,
      format: "rss",
      channel: parsed.channel,
      items: parsed.items,
      itemCount: parsed.items.length,
      raw: body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed fetch failed";
    return NextResponse.json({ ok: false, feedUrl, settings, format: settings.format, error: message }, { status: 500 });
  }
}
