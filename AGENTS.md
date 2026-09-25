# AGENTS.md

**navisalma-framersync** — sync Notified (GlobeNewswire) press releases from JsonFeed into a Framer managed collection (**Notified_Feed** by default).

Vendor API and field reference live in the Navisalma **keeping-up** repo: `docs/NOTIFIED-FEED-SYNC.md`, `docs/NOTIFIED-INTEGRATION.md`. Iframe/IR page work is out of scope here.

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

## Routes

| Route | Auth | Behavior |
|-------|------|----------|
| `GET /` | none | Green dot if `loadSyncEnv()` succeeds; red on missing env. No Framer/feed calls. |
| `GET /api/health` | none | `{ ok: true }` if env loads |
| `GET /api/health?deep=1` | none | Framer connect + JsonFeed probe (`max/1`), validates JSON array |
| `GET /api/sync` | Bearer `CRON_SECRET` | Full paginated sync → Framer upsert/reconcile/publish |

## Deploy

Push `main` → Vercel project **navisalma-framersync**. Cron: `GET /api/sync` every minute (`vercel.json`, Pro plan). Sync function `maxDuration`: 300s.

| Step | Check |
|------|-------|
| Env vars set | see below |
| Cron running | Vercel → Cron Jobs |
| Health | `GET /api/health` → `{ ok: true }` |
| Sync | Bearer `CRON_SECRET` → see response shape below |

Cron auth: `Authorization: Bearer $CRON_SECRET` (`lib/auth-cron.ts`).

Production: `https://navisalma-framersync.vercel.app/api/sync`

## Environment

Copy `.env.example` → `.env`. Never commit `.env`.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FRAMER_PROJECT_URL` | yes | — | Framer project URL |
| `FRAMER_API_KEY` | yes | — | Framer Server API key |
| `CRON_SECRET` | yes | — | `/api/sync` Bearer token |
| `FRAMER_COLLECTION_NAME` | no | `Notified_Feed` | Managed collection name |
| `NOTIFIED_FEED_URL` | no | see below | JsonFeed source URL |
| `NOTIFIED_RSS_URL` | no | — | Fallback; `/RssFeed/` → `/JsonFeed/` in `loadSyncEnv()` |
| `AUTO_PUBLISH` | no | `true` | Publish + deploy when content changed or items removed |

Feed URL resolution (`lib/env.ts`): `NOTIFIED_FEED_URL` → `NOTIFIED_RSS_URL` (normalized) → `buildFeedUrl(DEFAULT_FEED_SETTINGS)` (`lib/rss/build-feed-url.ts`, org token in `lib/config.ts`).

Loader: `loadSyncEnv()` in `lib/env.ts`. Defaults: `lib/config.ts`, `lib/rss/feed-settings.ts`.

## Layout

```
app/page.tsx                       Env-only status dot
app/api/sync/route.ts              Sync entrypoint (Bearer auth)
app/api/health/route.ts            Shallow + deep health
lib/auth-cron.ts                   Cron Bearer check
lib/env.ts                         Env loader
lib/config.ts                      Collection name, JsonFeed base URL, default org token
lib/sync/run-sync.ts               Fetch all pages → Framer sync
lib/rss/fetch-all-feed.ts          JsonFeed pagination (100/page, max 200 pages)
lib/rss/parse-json-feed.ts         Parse + normalize vendor JSON
lib/rss/build-feed-url.ts          JsonFeed URL builder
lib/rss/feed-settings.ts           Feed query defaults + URL param helpers
lib/rss/types.ts                   JsonFeedItem + SyncResult types
lib/framer/sync-press-releases.ts  Upsert, reconcile, publish, sync lock
lib/framer/schema.ts               CMS fields + JsonFeed mapping (source of truth)
lib/framer/collection.ts           Find managed collection by name
lib/framer/last-sync.ts            Last sync metadata stored in collection plugin data
```

## Sync pipeline

1. Paginate `feedUrl` with `/max/100/start/N` until a page returns fewer than 100 items (cap: 200 pages).
2. Parse JsonFeed array; dedupe by `Identifier`; fail if any item lacks `Identifier`.
3. **Empty feed → error**; sync refuses to reconcile (prevents wiping the collection).
4. Acquire per-collection sync lock (5 min TTL). If locked, return `{ ok: true, skipped: true, ... }` with zeros.
5. `setFields` only when schema fingerprint changes; upsert all items when feed fingerprint changes or cover-image migration version bumps.
6. Reconcile: delete CMS item ids not in the full feed snapshot.
7. Publish + deploy when `AUTO_PUBLISH` and (`changed` or items removed). Upsert batches of 5.

**CMS fields:** 22 vendor keys → Framer columns, plus **Cover Image** (first `<img src>` in `Content`). Canonical map: `JSON_FEED_FIELD_MAP` + `COVER_IMAGE_FIELD_ID` in `lib/framer/schema.ts`. Omit image fields when URL is null (Framer mishandles null images).

**Sync response** (`GET /api/sync`):

```json
{ "ok": true, "fetched", "pages", "upserted", "removed", "changed", "collection", "published" }
```

Optional `skipped: true` when another sync holds the lock.

## Conventions

- JsonFeed code in `lib/rss/`, Framer writes in `lib/framer/`.
- Item id = `String(Identifier)`; slug matches id.
- Run `npm test && npm run build` before finishing.
- No routes under `app/api/test/`. No dev preview/demo routes in this repo.
