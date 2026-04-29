# navisalma-framersync

Next.js service that reads Cision News Feed JSON and writes items into Framer CMS. Deploy on Vercel; configure secrets in the project dashboard and keep them out of git (`.env` is ignored).

## Local setup

1. Copy `.env.example` to `.env` and fill in values.
2. Run `npm install`, then `npm run dev`.

## Checks

- `GET /api/health` — no authentication.
- `npm run test` — Vitest (`lib/**/*.test.ts`).
- `GET /api/test/cision` — send `Authorization: Bearer <CRON_SECRET>`. Returns diagnostics per configured feed (`feeds[]`: counts, `firstEncryptedId`, optional `detailKeys`). Needs at least one `CISION_FEED_ID_*` variable.
- `GET /api/test/framer` — same auth; lists Framer collections using `FRAMER_PROJECT_URL` and `FRAMER_API_KEY`.

## Cision feeds

Use the UniqueIdentifiers from your News Feed JSON delivery (the ids shown per module: ALL Releases, Press, Financial, etc.). Map them to env vars as listed in `.env.example`; `lib/feed-id.ts` defines slot names and order.

If the same release appears in more than one feed, dedupe keeps one row per `EncryptedId` and prefers the more specific category: deck, then financial, then press, then other (`lib/dedupe-releases.ts`). The sync response includes `duplicateEncryptedIdsDropped`.

### News Feed JSON URLs

The integration follows Cision’s published endpoints:

| Purpose | URL pattern |
|--------|-------------|
| List | `https://publish.ne.cision.com/papi/NewsFeed/[feedUniqueIdentifier]?format=json` |
| Detail | `https://publish.ne.cision.com/papi/Release/[encryptedId]?format=json` |
| Detail (clean HTML) | `https://publish.ne.cision.com/papi/Release/[encryptedId]?format=json&isCleanHtml=true` |

List rows expose `EncryptedId`; detail requests use that value.

Optional list parameters include `detailLevel` (`base`, `medium`, `detail`), `pageSize` (default 50, max 100), `pageIndex`, `startDate`, `endDate`, `tags`, `SearchTerm` (names are case-sensitive per Cision).

This code requests lists with `format=json`, `detailLevel=detail`, `pageSize=50`, and details with `format=json&isCleanHtml=true`.

## Sync API

Call `GET /api/sync` with `Authorization: Bearer <CRON_SECRET>` (used by Vercel cron as well).

Successful runs return HTTP 200 with JSON such as:

- `ok` — run finished (there may still be per-step errors).
- `hasErrors` — true if Cision or Framer reported problems.
- `synced` — items written this run.
- `feedItems` — rows returned across all feed list calls before dedupe.
- `releasesPrepared` — distinct releases after dedupe.
- `duplicateEncryptedIdsDropped` — duplicates removed when merging feeds.
- `feedResults[]` — per-feed counts, errors, `listFallbackCount` when detail fetch fell back to list data.
- `framerErrorsUnattributed` — Framer messages that could not be tied to a feed.
- `errors` — flattened messages for logs.

HTTP 500 usually means configuration or a crash (e.g. missing `CRON_SECRET` where required). Transient Cision/Framer issues tend to show up as 200 with `hasErrors: true`.

## Operations

- When Cision or Framer fails briefly, cron can still return 200 with `hasErrors: true`. Search Vercel logs for `cision_feed_complete` and `cision_sync_summary`.

### Framer CMS: category (`contentType`)

Sync writes a single category string per item so you can filter press vs financial (and `other` for ALL feeds). **`deck`** only appears if `CISION_FEED_ID_DECK_*` env vars are set.

**Values stored** (lowercase): `press`, `financial`, `other`; plus `deck` when deck feeds exist.

**Managed collection** (plugin / `managedBy === "thisPlugin"`): field id **`cision_contentType`**, label **Content Type** (`lib/framer.ts`). New collections get it when the schema is first created. **Path B:** if the collection already existed **without** that column, sync **omits** `contentType` on write so upserts still succeed—add the **Content Type** field in Framer (or recreate schema) so values appear.

**User-managed collection**: add a plain **Text** field whose name matches one of **Content Type**, **Type**, or **Category** (normalized matching in `lib/framer.ts`). If none exists, category is not written.

**Checklist:** (1) CMS collection name matches **`FRAMER_COLLECTION_NAME`**. (2) Confirm the field above exists for your collection type. (3) Optional: `GET /api/test/framer` (same auth as `/api/sync`) lists collections and helps confirm the project sees the right CMS.

- Dates and links come from Cision `PublishDate` and, for URLs, the first non-empty of `PublicUrl`, `CanonicalUrl`, `CisionWireUrl` (`lib/cision.ts`). Empty values are not invented; fields are omitted when there is nothing to send. If Framer requires a date on every item, detail payloads must include `PublishDate`.
- Financial and deck feeds need their `CISION_FEED_ID_*` vars set when those modules exist. Duplicates across “all” and category feeds are merged so financial and deck win over the generic “other” bucket.
- CI: `.github/workflows/ci.yml` runs lint, build, and test on pushes and PRs to `main`.

## Vercel

Link the GitHub repo and add the same env names under Settings → Environment Variables.

Build command is `npm run build`. Node should match `package.json` engines (18.18+).

Cron is in `vercel.json` (hourly `GET /api/sync`). Vercel injects `Authorization: Bearer` using `CRON_SECRET`.

If a build fails, read the deployment log on that build page—often wrong root directory or an out-of-date lockfile.
