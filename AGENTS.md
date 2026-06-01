# AGENTS.md

**navisalma-framersync** — GlobeNewswire JsonFeed → Framer managed collection **Notified_Feed**.

Architecture and vendor API: keeping-up `docs/NOTIFIED-FEED-SYNC.md`, `docs/NOTIFIED-INTEGRATION.md`. Iframes: `docs/IFRAMES.md`.

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

Dev-only feed explorer: `/feed-demo`, `/api/feed-preview` (404 in production via `middleware.ts`).

Production routes: `/` (status dot only), `/api/health`, `/api/sync` (Bearer auth).

| Health | Auth | Behavior |
|--------|------|----------|
| `GET /api/health` | none | `{ ok: true }` if env loads |
| `GET /api/health?deep=1` | none | Framer connect + JsonFeed GET `max/1`, validates JSON array |

## Deploy

Push `main` → Vercel **navisalma-framersync**. Cron: `GET /api/sync` every minute (`vercel.json`, requires Pro).

| Step | Check |
|------|-------|
| Env vars set | see below |
| Cron running | Vercel → Cron Jobs |
| Health | `GET /api/health` → `{ ok: true }` |
| Sync | Bearer `CRON_SECRET` → `{ ok, fetched, pages, upserted, removed, changed, published }` |

Cron auth: Vercel sends `Authorization: Bearer $CRON_SECRET` (`lib/auth-cron.ts`).

## Environment

Copy `.env.example` → `.env`. Never commit `.env`.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FRAMER_PROJECT_URL` | yes | — | Framer project URL |
| `FRAMER_API_KEY` | yes | — | Framer Server API key |
| `CRON_SECRET` | yes | — | `/api/sync` Bearer token |
| `FRAMER_COLLECTION_NAME` | no | `Notified_Feed` | Managed collection |
| `NOTIFIED_FEED_URL` | no | Einride JsonFeed URL | Feed source |
| `NOTIFIED_RSS_URL` | no | — | Fallback; `/RssFeed/` rewritten to `/JsonFeed/` in `loadSyncEnv()` |
| `AUTO_PUBLISH` | no | `true` | Publish + deploy when fingerprint changes or items removed |

Loader: `lib/env.ts` → `loadSyncEnv()`. Defaults: `lib/config.ts`.

## Layout

```
app/page.tsx                       Status dot only
app/api/sync/route.ts              Sync entrypoint
app/api/health/route.ts            Shallow + deep health
app/api/feed-preview/route.ts      Feed explorer API (dev)
app/feed-demo/                     Feed explorer UI (dev)
middleware.ts                      Dev-only gate for explorer
lib/sync/run-sync.ts               Paginated fetch → Framer
lib/rss/fetch-all-feed.ts          JsonFeed pagination (max 100/page)
lib/rss/parse-json-feed.ts         Parse + normalize vendor JSON
lib/rss/build-feed-url.ts          JsonFeed URL builder
lib/framer/sync-press-releases.ts  Upsert, reconcile, publish
lib/framer/schema.ts               CMS fields + JsonFeed mapping (source of truth)
lib/framer/last-sync.ts            Last sync metadata + status helper
```

## Sync pipeline

1. Paginate `feedUrl` with `/max/100/start/N` until a page returns fewer than 100 items.
2. Parse JsonFeed array; CMS item id = `String(Identifier)`; fail if any item missing `Identifier`.
3. Refuse to run: if the upstream feed is empty, the sync returns an error and does not reconcile (prevents wiping the collection).
4. `setFields` runs only when the schema fingerprint changes, not every tick; upsert when the feed fingerprint changes; reconcile deletes CMS ids not in the full snapshot.
5. Publish + deploy when `AUTO_PUBLISH` and content changed or items removed.

**CMS fields:** 20 vendor keys → Framer columns. Canonical list: `JSON_FEED_FIELD_MAP` in `lib/framer/schema.ts`. Full table: keeping-up `docs/NOTIFIED-FEED-SYNC.md`.

## Conventions

- JsonFeed code in `lib/rss/`, Framer writes in `lib/framer/`.
- Run `npm test && npm run build` before finishing.
- No routes under `app/api/test/`.
- IR page design and iframe widgets are out of scope (keeping-up docs).

Production sync: `https://navisalma-framersync.vercel.app/api/sync`
