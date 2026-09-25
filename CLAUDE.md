# CLAUDE.md

Follow [AGENTS.md](./AGENTS.md). Backend for the einride Framer website: one folder per feature in `lib/features/`, shared code in `lib/shared/`.

## Rules

- A feature owns its `env.ts` loader and must not require another feature's env vars.
- No `app/api/test/` routes. No iframe or feed-demo work in this repo.

### Notified sync (`lib/features/notified-sync/`)

Notified/GlobeNewswire JsonFeed field reference: keeping-up repo `docs/NOTIFIED-FEED-SYNC.md`.

- JsonFeed in `rss/`, Framer in `framer/`.
- Paginate the full feed before reconcile deletes (100/page, max 200 pages).
- Empty feed → sync throws; never wipes the collection.
- Item id = `String(Identifier)`.
- `loadSyncEnv()` from `env.ts`.
- Field map: `JSON_FEED_FIELD_MAP` in `framer/schema.ts`.
- Omit null image field keys in upserts (`imageFieldData` in `framer/schema.ts`).
- Concurrent syncs skip via collection plugin-data lock (`skipped: true` in response).

## Verify

```bash
npm test && npm run build
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Expect: `{ ok: true, fetched, pages, upserted, removed, changed, collection, published }` (optional `skipped: true` if lock held).
