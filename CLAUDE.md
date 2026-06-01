# CLAUDE.md

Follow [AGENTS.md](./AGENTS.md). Architecture: keeping-up `docs/NOTIFIED-FEED-SYNC.md`.

## Before editing

Read `lib/sync/run-sync.ts` and `lib/framer/sync-press-releases.ts`. Run `npm test && npm run build` before claiming done.

## Rules

- JsonFeed in `lib/rss/`, Framer in `lib/framer/`.
- Paginate full feed before reconcile deletes.
- Item id = `String(Identifier)`.
- Use `loadSyncEnv()` from `lib/env.ts`.
- No `app/api/test/` routes. No iframe work in this repo.

## Verify

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Expect: `{ ok: true, fetched, pages, upserted, removed, changed, collection, published }`.
