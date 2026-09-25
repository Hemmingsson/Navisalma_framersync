# AGENTS.md

**einride-framer-things** — small Next.js backend for the einride Framer website. Each feature is one folder under `lib/features/` plus its route(s) under `app/api/`.

| Feature | Folder | Route | Trigger |
|---------|--------|-------|---------|
| Notified sync | `lib/features/notified-sync/` | `GET /api/sync` | Vercel cron, every minute |
| HubSpot newsletter | `lib/features/hubspot-newsletter/` | `POST /api/forms/newsletter` | Framer form webhook |

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
| `GET /` | none | Green dot if every feature's env loads; red (hover for details) otherwise. No Framer/feed calls. |
| `GET /api/health` | none | `{ ok, features: { <name>: "ok" \| "<env error>" } }`; 503 if any feature is misconfigured |
| `GET /api/health?deep=1` | none | Framer connect + JsonFeed probe (`max/1`), validates JSON array |
| `GET /api/sync` | Bearer `CRON_SECRET` | Notified sync (see below) |
| `POST /api/forms/newsletter` | `Framer-Signature` HMAC | Framer form → HubSpot (see below) |

## Deploy

Push `main` → Vercel project **einride-framer-things** (formerly navisalma-framersync). Cron: `GET /api/sync` every minute (`vercel.json`, Pro plan). Sync function `maxDuration`: 300s.

Production: `https://einride-framer-things.vercel.app` (old `navisalma-framersync.vercel.app` still serves the same deployment)

| Step | Check |
|------|-------|
| Env vars set | see Environment per feature |
| Cron running | Vercel → Cron Jobs |
| Health | `GET /api/health` → `ok: true`, every feature `"ok"` |

Copy `.env.example` → `.env`. Never commit `.env`.

## Layout

```
app/page.tsx                 Env-only status dot
app/api/health/route.ts      Shallow + deep health
app/api/sync/route.ts        Notified sync entrypoint
app/api/forms/newsletter/    Framer form webhook → HubSpot
lib/features/env-status.ts   Registry of feature env loaders (health + `/`)
lib/shared/                  Code used by more than one feature (auth, env helpers)
lib/features/<feature>/      One folder per feature; owns its env loader, config, tests
```

## Conventions

- New feature → new folder in `lib/features/` with its own `env.ts` loader, registered in `lib/features/env-status.ts`. A feature must not require another feature's env vars.
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
framer/cover-image.ts        Cover Image resolution + removing it from the body
legacy-images.json           Identifier → image from the old "Press releases" CMS (generated)
framer/collection.ts         Find managed collection by name
framer/last-sync.ts          Last sync metadata stored in collection plugin data
```

### Sync pipeline

1. Paginate `feedUrl` with `/max/100/start/N` until a page returns fewer than 100 items (cap: 200 pages).
2. Parse JsonFeed array; dedupe by `Identifier` (a release can appear once per language — keep `Language: "en"`); fail if any item lacks `Identifier`.
3. **Empty feed → error**; sync refuses to reconcile (prevents wiping the collection).
4. Acquire per-collection sync lock (5 min TTL). If locked, return `{ ok: true, skipped: true, ... }` with zeros.
5. `setFields` only when schema fingerprint changes; upsert all items when feed fingerprint changes or cover-image migration version bumps.
6. Reconcile: delete CMS item ids not in the full feed snapshot.
7. Publish + deploy when `AUTO_PUBLISH` and (`changed` or items removed). Upsert batches of 5.

**CMS fields:** 22 vendor keys → Framer columns, plus **Cover Image**. Canonical map: `JSON_FEED_FIELD_MAP` + `COVER_IMAGE_FIELD_ID` in `framer/schema.ts`. Omit image fields when URL is null (Framer mishandles null images).

**Cover Image** (`framer/cover-image.ts`), first hit wins:

1. `WidgetAttachment[].ImageUrl` with `?size=N` stripped (original resolution; `size=4` is a 70px thumb).
2. First `<img>` in `Content` that is not a GlobeNewswire `/media/…` 1×1 tracking pixel.
3. `legacy-images.json` by `Identifier` — images from the pre-Notified "Press releases" CMS for releases Notified has no image for (most releases before Aug 2026).

When the cover comes from Notified, its `<img>` (and a `<p>` wrapper left empty) is removed from `Content` so it isn't shown twice. Legacy covers leave `Content` unchanged. Changing cover logic → bump `COVER_IMAGE_SYNC_VERSION` in `framer/sync-press-releases.ts` (one full re-upsert + publish).

Regenerate the legacy map (read-only against Framer; review the diff before committing):

```bash
node --env-file=.env scripts/build-legacy-images.mjs
```

**Sync response** (`GET /api/sync`):

```json
{ "ok": true, "fetched", "pages", "upserted", "removed", "changed", "collection", "published" }
```

Optional `skipped: true` when another sync holds the lock.

### Rules

- JsonFeed code in `rss/`, Framer writes in `framer/`.
- Item id = `String(Identifier)`; slug matches id.

---

## Feature: HubSpot newsletter

Framer's native form (Investors → "Sign up for insight") posts to a webhook; this route verifies the signature, reshapes the flat Framer JSON into HubSpot's `{ fields: [{ name, value }] }` and submits it to the HubSpot form **Investor Relations Newsletter form** (EU data centre, unauthenticated Forms v3 `integration/submit` endpoint — no HubSpot API key involved).

### Framer setup

1. Form input **names** must be exactly `firstname`, `lastname`, `email` (HubSpot internal names). Other inputs are dropped.
2. Form → Send to → **Webhook**: `https://einride-framer-things.vercel.app/api/forms/newsletter`.
3. Webhook **Secret** = `FRAMER_FORM_WEBHOOK_SECRET` (min 32 chars).
4. Webhook **Fallback** email is required — publish fails with "Form not configured" without it. Framer emails it if the webhook keeps failing.
5. Configure every component variant (Desktop, Phone, …); each has its own form.

### Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `HUBSPOT_PORTAL_ID` | yes | — | HubSpot portal (public) |
| `HUBSPOT_FORM_GUID` | yes | — | HubSpot form (public) |
| `HUBSPOT_SUBMIT_BASE` | no | `https://api-eu1.hsforms.com/submissions/v3/integration/submit` | Region-specific submit base |
| `FRAMER_FORM_WEBHOOK_SECRET` | yes | — | Framer webhook signing secret — the only secret |

### Behavior

- Signature: `Framer-Signature` = `sha256=` + hex HMAC-SHA256(secret, raw body + `Framer-Webhook-Submission-Id`). Bad/missing → 401.
- Framer retries non-2xx up to 5 times, so status codes mean "retry?":
  - HubSpot 2xx → `200 { ok: true }`
  - HubSpot 429/5xx/network → `502` (Framer retries)
  - HubSpot other 4xx, or no email → `200 { ok: false, error }` + `console.error` (retrying cannot help; check Vercel logs)
- Retries can create duplicate *submissions* in HubSpot; contacts are deduped by email.
- Server-side submit has no `hubspotutk` cookie or visitor IP, so HubSpot won't tie the submission to prior page views.
- No `legalConsentOptions`: the HubSpot form has no consent checkbox (confirmed 2026-09-25). If one is added in HubSpot, add a checkbox in Framer and map it in `submit.ts`.
