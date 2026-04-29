# navisalma-framersync

Syncs Cision News Feed JSON into a Framer CMS collection. Next.js app, meant for Vercel. Secrets live in env vars; `.env` is gitignored.

## Setup

1. Copy `.env.example` → `.env` and fill values.
2. `npm install` · `npm run dev`

## Environment

Feed IDs are the JSON **UniqueIdentifier** values from your Cision delivery. See `.env.example` for variable names. If you set several feeds and the same release appears twice, one row is kept: **first** configured feed wins (`duplicateEncryptedIdsDropped` in the sync response).

## What it does

- Fetches **all** list pages (`pageSize=100`, `detailLevel=detail`).
- Loads each item from the **detail** endpoint (`isCleanHtml=true`). No list-only fallback.
- Writes into a **managed** Framer collection named `cision_feed` (or `FRAMER_COLLECTION_NAME`). CMS field ids match Cision `Release` keys; nested data is stored as JSON in string fields. **`CoverImage`** is an Framer **image** field filled from the first entry in Cision **`Images`** (`DownloadUrl` / `Url`).
- Do not point the same name at a **user-managed** collection—the sync will refuse. On **new** or **incomplete** managed collections, the sync applies the full schema (including **`CoverImage`**). Rename the collection or change `FRAMER_COLLECTION_NAME` if you need a clean reset.

Cision URLs (reference):

| Step | Pattern |
|------|---------|
| List | `https://publish.ne.cision.com/papi/NewsFeed/{id}?format=json&...` |
| Detail | `https://publish.ne.cision.com/papi/Release/{encryptedId}?format=json&isCleanHtml=true` |

## HTTP

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/health` | none | Liveness |
| `GET /api/sync` | `Authorization: Bearer <CRON_SECRET>` | Full sync (cron uses this) |
| `POST /api/sync/run` | Bearer in production; open on local dev | Manual sync |
| `GET /api/test/cision` | Bearer | Per-feed sample: counts, first id, detail field names |
| `GET /api/test/framer` | Bearer | Lists collections / fields |

Sync returns `200` with `hasErrors` when Cision or Framer reported issues. Useful fields: `synced`, `feedItems`, `releasesPrepared`, `errors`, `feedResults`, `framerErrorsUnattributed`.

## Vercel

Set the same env vars as in `.env.example`. Build: `npm run build`. Cron: `vercel.json` calls `GET /api/sync` hourly.

When the project defines **`CRON_SECRET`**, Vercel’s cron invocations send **`Authorization: Bearer <CRON_SECRET>`**; the route rejects other callers. Use that same header to trigger **`GET /api/sync`** manually if needed.

Logs: search for `cision_feed_complete` and `cision_sync_summary`.

## Tests

`npm run test` (Vitest)
