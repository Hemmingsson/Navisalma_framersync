# navisalma-framersync

API-only service for Cision → Framer (deploy on Vercel, env vars in the dashboard — **never** commit secrets).

## Local setup

1. Copy `.env.example` to `.env` and fill values (`.env` is gitignored).
2. `npm install` then `npm run dev`.

## Checks

- `GET /api/health` — no auth.
- `npm run test` — Vitest unit tests (`lib/**/*.test.ts`).
- `GET /api/test/cision` — `Authorization: Bearer` + value of `CRON_SECRET` from your env; returns one diagnostic block per configured feed (`feeds[]`: counts, `firstEncryptedId`, optional `detailKeys`). Requires at least one `CISION_FEED_ID_*` variable (see `.env.example`).
- `GET /api/test/framer` — same auth; read-only Framer CMS layout (`FRAMER_PROJECT_URL`, `FRAMER_API_KEY` from env).

## Cision feeds

Set any combination of feed ids (non-empty values only). Fixed order: optional `CISION_FEED_ID_EN_ALL` / `CISION_FEED_ID_SV_ALL`, then press (`CISION_FEED_ID_EN_PRESS` or `CISION_FEED_ID_PRESS_EN`), financial (`CISION_FEED_ID_EN_FINANCIAL` or `CISION_FEED_ID_FINANCIAL_EN`), optional decks. Same logical feed may appear under two env names — pick one spelling per slot (see `.env.example`).

- **Overlap:** if the same `EncryptedId` appears in more than one feed (e.g. combined “all” plus press), **the most specific content type wins**: deck → financial → press → other (`lib/dedupe-releases.ts`). The sync JSON reports `duplicateEncryptedIdsDropped`.

## Sync API (`GET /api/sync` with cron auth)

Successful **execution** returns HTTP **200** with a JSON body that always includes whether anything failed upstream:

- `ok` — `true` when the job ran to completion (including partial failures).
- `hasErrors` — `true` when Cision or Framer reported errors (inspect `errors` and per-feed `feedResults`).
- `synced` — items written to Framer in this run.
- `feedItems` — total rows seen across all Cision feed list calls (before dedupe).
- `releasesPrepared` — distinct releases passed to Framer **after** dedupe by `encryptedId`.
- `duplicateEncryptedIdsDropped` — count of duplicate ids removed when merging feeds.
- `feedResults[]` — per-feed `releaseCount`, `preparedCount` (after dedupe), `syncedCount`, `listFallbackCount` (detail API fell back to list row), and feed-scoped `errors` (Cision + Framer lines attributed to that feed).
- `framerErrorsUnattributed` — Framer error lines that could not be mapped to a release (e.g. global config messages).
- `errors` — flattened list for quick debugging (includes category prefixes such as `cision_fetch_failed:`, `timeout:`, `config:`).

HTTP **500** is reserved for misconfiguration that prevents running the route (for example missing `CRON_SECRET` on `/api/sync`) or unexpected crashes — not for transient Cision/Framer HTTP errors (those surface as `200` + `hasErrors: true`).

## Operations / troubleshooting

- **Intermittent upstream errors:** hourly cron may still get `200` with `hasErrors` if a feed or Framer briefly fails. Check Vercel logs for `cision_feed_complete` and `cision_sync_summary` lines; retries apply to retryable HTTP/network conditions.
- **Framer `contentType`:** new managed collections get a **Content Type** field (`cision_contentType`) on first creation. If a collection already existed **without** that column, sync detects it and **omits** `contentType` on write so upserts still succeed — add the field in Framer when you want it populated (or use a user collection with a field aliased to `content type`, `type`, or `category` — see `lib/framer.ts`).
- **Publish Date & article links:** Cision maps to Framer **Publish Date** (`PublishDate`) and **Source URL** (`PublicUrl`, then `CanonicalUrl`, then `CisionWireUrl`). When no URL exists in the payload, the link field is omitted instead of inserting a placeholder.
- **Financial reports & decks:** configure `CISION_FEED_ID_*` for financial and (when available) `CISION_FEED_ID_DECK_EN` / `CISION_FEED_ID_DECK_SV` in Vercel so those feeds are included; overlap with EN_ALL/SV_ALL is OK — dedupe assigns **financial** / **deck** over generic **other**.
- **CI:** `.github/workflows/ci.yml` runs `lint`, `build`, and `test` on push/PR to `main`.

## Vercel

Connect the GitHub repo, then set the same variable names under **Settings → Environment Variables**. Do not put keys in the repo.

Build uses `npm run build` (default). If the dashboard **Root Directory** is wrong, the build will fail. Use **Node 18.18+** (see `engines` in `package.json`).

Cron is defined in `vercel.json` (`GET /api/sync` hourly). Vercel sends `Authorization: Bearer` with your `CRON_SECRET` automatically for cron invocations.

If the build log is truncated, open the deployment → **Building** and expand the error after `vercel build`; common issues: missing env at build time (Next does not need secrets to build), or outdated lockfile — run `npm install` locally and commit `package-lock.json`.
