# AGENTS.md

**einride-framer-things** — small Next.js backend for the einride Framer website. Each feature is one folder under `lib/features/` plus its route(s) under `app/api/`.

| Feature | Folder | Route | Trigger |
|---------|--------|-------|---------|
| Notified sync | `lib/features/notified-sync/` | `GET /api/sync` | Vercel cron, every minute |

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm test
npm run lint
npm run build
```

## Routes

| Route | Auth | Behavior |
|-------|------|----------|
| `GET /` | none | Green dot if env loads; red on missing env. No Framer/feed calls. |
| `GET /api/health` | none | `{ ok: true }` if env loads |
| `GET /api/health?deep=1` | none | Framer connect + JsonFeed probe (`max/1`), validates JSON array |
| `GET /api/sync` | Bearer `CRON_SECRET` | Notified sync (see below) |

## Deploy

Push `main` → Vercel project **navisalma-framersync** (to be renamed **einride-framer-things**). Cron: `GET /api/sync` every minute (`vercel.json`, Pro plan). Sync function `maxDuration`: 300s.

Production: `https://navisalma-framersync.vercel.app`

| Step | Check |
|------|-------|
| Env vars set | see Environment per feature |
| Cron running | Vercel → Cron Jobs |
| Health | `GET /api/health` → `{ ok: true }` |

Copy `.env.example` → `.env`. Never commit `.env`.

## Layout

```
app/page.tsx                 Env-only status dot
app/api/health/route.ts      Shallow + deep health
app/api/sync/route.ts        Notified sync entrypoint
lib/shared/                  Code used by more than one feature (auth, env helpers)
lib/features/<feature>/      One folder per feature; owns its env loader, config, tests
```

## Conventions

- New feature → new folder in `lib/features/` with its own `env.ts` loader. A feature must not require another feature's env vars.
- Only move code to `lib/shared/` once a second feature needs it.
- Route handlers stay thin: load env, check auth, call the feature, return JSON.
- Run `npm test && npm run build` before finishing.
- No routes under `app/api/test/`. No dev preview/demo routes.

---

## Feature: Notified sync

Syncs Notified (GlobeNewswire) press releases from JsonFeed into a Framer managed collection (**Notified_Feed** by default).

Vendor API and field reference live in the Navisalma **keeping-up** repo: `docs/NOTIFIED-FEED-SYNC.md`, `docs/NOTIFIED-INTEGRATION.md`. Iframe/IR page work is out of scope here.

Manual run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Cron auth: `Authorization: Bearer $CRON_SECRET` (`lib/shared/auth-cron.ts`).

### Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FRAMER_PROJECT_URL` | yes | — | Framer project URL |
| `FRAMER_API_KEY` | yes | — | Framer Server API key |
| `CRON_SECRET` | yes | — | `/api/sync` Bearer token |
| `FRAMER_COLLECTION_NAME` | no | `Notified_Feed` | Managed collection name |
| `NOTIFIED_FEED_URL` | no | see below | JsonFeed source URL |
| `NOTIFIED_RSS_URL` | no | — | Fallback; `/RssFeed/` → `/JsonFeed/` in `loadSyncEnv()` |
| `AUTO_PUBLISH` | no | `true` | Publish + deploy when content changed or items removed |

Feed URL resolution (`env.ts`): `NOTIFIED_FEED_URL` → `NOTIFIED_RSS_URL` (normalized) → `buildFeedUrl(DEFAULT_FEED_SETTINGS)` (`rss/build-feed-url.ts`, org token in `config.ts`).

### Layout (under `lib/features/notified-sync/`)

```
env.ts                       loadSyncEnv()
config.ts                    Collection name, JsonFeed base URL, default org token, User-Agent
run-sync.ts                  Fetch all pages → Framer sync
rss/fetch-all-feed.ts        JsonFeed pagination (100/page, max 200 pages)
rss/parse-json-feed.ts       Parse + normalize vendor JSON
rss/build-feed-url.ts        JsonFeed URL builder
rss/feed-settings.ts         Feed query defaults + URL param helpers
rss/types.ts                 JsonFeedItem + SyncResult types
framer/sync-press-releases.ts  Upsert, reconcile, publish, sync lock
framer/schema.ts             CMS fields + JsonFeed mapping (source of truth)
framer/collection.ts         Find managed collection by name
framer/last-sync.ts          Last sync metadata stored in collection plugin data
```

### Sync pipeline

1. Paginate `feedUrl` with `/max/100/start/N` until a page returns fewer than 100 items (cap: 200 pages).
2. Parse JsonFeed array; dedupe by `Identifier`; fail if any item lacks `Identifier`.
3. **Empty feed → error**; sync refuses to reconcile (prevents wiping the collection).
4. Acquire per-collection sync lock (5 min TTL). If locked, return `{ ok: true, skipped: true, ... }` with zeros.
5. `setFields` only when schema fingerprint changes; upsert all items when feed fingerprint changes or cover-image migration version bumps.
6. Reconcile: delete CMS item ids not in the full feed snapshot.
7. Publish + deploy when `AUTO_PUBLISH` and (`changed` or items removed). Upsert batches of 5.

**CMS fields:** 22 vendor keys → Framer columns, plus **Cover Image** (first `<img src>` in `Content`). Canonical map: `JSON_FEED_FIELD_MAP` + `COVER_IMAGE_FIELD_ID` in `framer/schema.ts`. Omit image fields when URL is null (Framer mishandles null images).

**Sync response** (`GET /api/sync`):

```json
{ "ok": true, "fetched", "pages", "upserted", "removed", "changed", "collection", "published" }
```

Optional `skipped: true` when another sync holds the lock.

### Rules

- JsonFeed code in `rss/`, Framer writes in `framer/`.
- Item id = `String(Identifier)`; slug matches id.
