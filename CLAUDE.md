# CLAUDE.md

Follow [AGENTS.md](./AGENTS.md). Notified/GlobeNewswire JsonFeed field reference: keeping-up repo `docs/NOTIFIED-FEED-SYNC.md`.

## Rules

- JsonFeed in `lib/rss/`, Framer in `lib/framer/`.
- Paginate the full feed before reconcile deletes (100/page, max 200 pages).
- Empty feed → sync throws; never wipes the collection.
- Item id = `String(Identifier)`.
- `loadSyncEnv()` from `lib/env.ts`.
- Field map: `JSON_FEED_FIELD_MAP` in `lib/framer/schema.ts`.
- Omit null image field keys in upserts (`imageFieldData` in `lib/framer/schema.ts`).
- Concurrent syncs skip via collection plugin-data lock (`skipped: true` in response).
- No `app/api/test/` routes. No iframe or feed-demo work in this repo.

## Verify

```bash
npm test && npm run build
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Expect: `{ ok: true, fetched, pages, upserted, removed, changed, collection, published }` (optional `skipped: true` if lock held).
