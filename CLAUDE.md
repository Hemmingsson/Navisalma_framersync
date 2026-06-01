# CLAUDE.md

Follow [AGENTS.md](./AGENTS.md). Architecture: keeping-up `docs/NOTIFIED-FEED-SYNC.md`.

## Rules

- JsonFeed in `lib/rss/`, Framer in `lib/framer/`.
- Paginate full feed before reconcile deletes.
- Empty feed → sync throws (refuses to reconcile); never wipes the collection.
- Item id = `String(Identifier)`.
- `loadSyncEnv()` from `lib/env.ts`.
- Field map: `JSON_FEED_FIELD_MAP` in `lib/framer/schema.ts`.
- No `app/api/test/` routes. No iframe work in this repo.

## Verify

```bash
npm test && npm run build
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Expect: `{ ok: true, fetched, pages, upserted, removed, changed, collection, published }`.
