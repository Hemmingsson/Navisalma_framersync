# AGENTS.md

Operating manual for **navisalma-framersync**: GlobeNewswire JsonFeed → Framer managed CMS.

Product and vendor documentation lives in the sibling **keeping-up** repo (`docs/NOTIFIED-FEED-SYNC.md`, `docs/NOTIFIED-INTEGRATION.md`, `docs/IFRAMES.md`). This repo contains the sync service and feed explorer only.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm test
npm run lint
npm run build
```

Manual sync:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Feed explorer (local dev only): [http://localhost:3000/feed-demo](http://localhost:3000/feed-demo) — returns 404 in production.

Production public surface: `/` (status dot + last sync), `/api/health`, `/api/sync` (auth).

**Health:** `GET /api/health` is public (shallow env check). `GET /api/health?deep=1` is also public by design — it probes Framer connectivity and validates a JsonFeed page (`max/1`); it does not return API keys or secrets.

CI: `.github/workflows/ci.yml` — lint, build, test on push/PR to `main`.

## Deploy (GitHub → Vercel)

| Step | Action |
|------|--------|
| 1 | Push to `main` on GitHub |
| 2 | Vercel project **navisalma-framersync** builds and deploys |
| 3 | Set Production env vars (see below) |
| 4 | Confirm Cron Jobs shows `/api/sync` running |
| 5 | Hit `GET /api/health` — expect `{ ok: true }` |
| 6 | Hit `GET /api/sync` with Bearer token — expect `{ ok: true, fetched, pages, upserted, removed, changed, published }` |

**Cron:** `vercel.json` → `GET /api/sync` every minute (`* * * * *`). Requires Vercel **Pro** for sub-daily schedules.

**Cron auth:** set `CRON_SECRET` in Vercel. Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations. Manual calls must use the same header (`lib/auth-cron.ts`).

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FRAMER_PROJECT_URL` | yes | — | Framer project URL |
| `FRAMER_API_KEY` | yes | — | Framer Server API key |
| `CRON_SECRET` | yes | — | Protects `/api/sync` |
| `FRAMER_COLLECTION_NAME` | no | `Notified_Feed` | Managed collection name |
| `NOTIFIED_FEED_URL` | no | Einride org JsonFeed URL | Primary GlobeNewswire feed |
| `NOTIFIED_RSS_URL` | no | — | Deprecated alias; `/RssFeed/` auto-rewritten to `/JsonFeed/` |
| `AUTO_PUBLISH` | no | `true` | Publish + deploy Framer when feed fingerprint changes |

Defaults: `lib/config.ts`. Loader: `lib/env.ts` → `loadSyncEnv()`.

Copy `.env.example` → `.env` locally. Never commit `.env`.

## Layout

```
app/page.tsx                       Three-state status dot + last sync
app/api/health/route.ts            Env check; ?deep=1 probes Framer + feed
app/api/sync/route.ts              Cron + manual sync entrypoint
app/api/feed-preview/route.ts      Feed explorer API — dev only
app/feed-demo/                     JsonFeed explorer UI — dev only
middleware.ts                      Blocks feed explorer routes outside dev
lib/config.ts                      Shared defaults (JSON_FEED_BASE, org token)
lib/sync/run-sync.ts               Paginated fetch → Framer sync
lib/rss/fetch-all-feed.ts          JsonFeed pagination (max 100/page)
lib/rss/parse-json-feed.ts         JsonFeed parser
lib/rss/build-feed-url.ts          GlobeNewswire JsonFeed URL builder
lib/framer/collection.ts           Shared managed-collection lookup
lib/framer/sync-press-releases.ts  Upsert, reconcile, auto-publish
lib/framer/schema.ts               CMS field schema + JsonFeed mapping
lib/framer/last-sync.ts            Last sync metadata + status helper
```

## CMS fields (`Notified_Feed`)

Direct 1:1 JsonFeed → Framer mapping (15 fields):

| Framer field | JsonFeed key |
|--------------|--------------|
| Title | `Title` |
| Release Date Time | `ReleaseDateTime` |
| Localized Release Date Time | `LocalizedReleaseDateTime` |
| Modified Date | `ModifiedDate` |
| Subjects | `Subjects` |
| Language | `Language` |
| Keywords | `Keywords` |
| Stock Tickers | `StockTickers` |
| Identifier | `Identifier` (CMS item id) |
| Content | `Content` (HTML formattedText) |
| Content Summary | `ContentSummary` |
| Url | `Url` |
| News Archive Tags | `NewsArchiveTags` |
| PDF Download Url | `PdfDownloadUrl` |
| Widget Attachment | `WidgetAttachment` |

## Sync pipeline

1. Paginate `feedUrl` with `/max/100/start/N` until a page returns fewer than 100 items.
2. Parse JsonFeed → `JsonFeedItem[]` (`String(Identifier)` is the stable id).
3. Fail sync if any item is missing `Identifier`.
4. Ensure managed collection exists; refresh field schema on each sync.
5. **Upsert** when feed fingerprint changes (`addItems`).
6. **Reconcile** — `removeItems()` for CMS ids absent from the full feed snapshot.
7. **Publish** when `AUTO_PUBLISH` is on and content changed or items were removed.

Production URL: `https://navisalma-framersync.vercel.app/api/sync`

## Conventions

- One org feed only. JsonFeed parsing in `lib/rss/`, Framer writes in `lib/framer/`.
- Run `npm test && npm run build` before finishing.
- Do not add test-only API routes under `app/api/test/`.
- Iframe embeds and IR page design are out of scope (see keeping-up docs).
