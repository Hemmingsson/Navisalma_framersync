# AGENTS.md

Operating manual for **navisalma-framersync**: GlobeNewswire RSS → Framer managed CMS.

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

Feed explorer (dev UI): [http://localhost:3000/feed-demo](http://localhost:3000/feed-demo)

CI: `.github/workflows/ci.yml` — lint, build, test on push/PR to `main`.

## Deploy (GitHub → Vercel)

| Step | Action |
|------|--------|
| 1 | Push to `main` on GitHub |
| 2 | Vercel project **navisalma-framersync** builds and deploys |
| 3 | Set Production env vars (see below) |
| 4 | Confirm Cron Jobs shows `/api/sync` running |
| 5 | Hit `GET /api/health` — expect `{ ok: true }` |
| 6 | Hit `GET /api/sync` with Bearer token — expect `{ ok: true, fetched, pages, upserted, removed, published }` |

**Cron:** `vercel.json` → `GET /api/sync` every minute (`* * * * *`). Requires Vercel **Pro** for sub-daily schedules.

**Cron auth:** set `CRON_SECRET` in Vercel. Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations. Manual calls must use the same header (`lib/auth-cron.ts`).

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FRAMER_PROJECT_URL` | yes | — | Framer project URL |
| `FRAMER_API_KEY` | yes | — | Framer Server API key |
| `CRON_SECRET` | yes | — | Protects `/api/sync` |
| `FRAMER_COLLECTION_NAME` | no | `Notified_Feed` | Managed collection name |
| `NOTIFIED_RSS_URL` | no | Einride org RSS URL | Single GlobeNewswire feed |
| `AUTO_PUBLISH` | no | `true` | Publish + deploy Framer when feed fingerprint changes |

Defaults: `lib/config.ts`. Loader: `lib/env.ts` → `loadSyncEnv()`.

Copy `.env.example` → `.env` locally. Never commit `.env`.

## Layout

```
app/api/sync/route.ts              Cron + manual sync entrypoint
app/api/feed-preview/route.ts      Feed explorer API (JsonFeed/RSS proxy)
app/feed-demo/                     Feed explorer UI
lib/config.ts                      Shared defaults
lib/sync/run-sync.ts               Paginated fetch → Framer sync
lib/rss/fetch-all-feed.ts          RSS pagination (max 100/page)
lib/rss/parse-rss-feed.ts          RSS 2.0 + Dublin Core parser
lib/rss/parse-json-feed.ts         JsonFeed parser (feed explorer)
lib/rss/build-feed-url.ts          GlobeNewswire URL builder
lib/framer/sync-press-releases.ts  Upsert, reconcile, auto-publish
lib/framer/schema.ts               CMS field schema + RSS mapping
```

## Sync pipeline

1. Paginate `NOTIFIED_RSS_URL` with `/max/100/start/N` until a page returns fewer than 100 items.
2. Parse RSS → `RssItem[]` (`dc:identifier` is the stable id).
3. Ensure managed collection exists; refresh enum fields (Subject, Language).
4. **Upsert** when feed fingerprint changes (`addItems`).
5. **Reconcile** — `removeItems()` for CMS ids absent from the full feed snapshot.
6. **Publish** when `AUTO_PUBLISH` is on and fingerprint changed or items were removed.

Production URL: `https://navisalma-framersync.vercel.app/api/sync`

## Conventions

- One org feed only. RSS parsing in `lib/rss/`, Framer writes in `lib/framer/`.
- Run `npm test && npm run build` before finishing.
- Do not add test-only API routes under `app/api/test/`.
- Iframe embeds and IR page design are out of scope (see keeping-up docs).
