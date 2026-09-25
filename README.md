# einride-framer-things

Small backend for the einride Framer website, deployed on Vercel. Each feature lives in `lib/features/`:

- **Notified sync** — GlobeNewswire JsonFeed → Framer CMS, every minute via Vercel cron.

**Operator docs:** [AGENTS.md](./AGENTS.md)  
**Notified reference:** keeping-up repo → `docs/NOTIFIED-FEED-SYNC.md`, `docs/NOTIFIED-INTEGRATION.md`

## Quick start

```bash
npm install
cp .env.example .env   # Framer + CRON_SECRET
npm run dev              # http://localhost:3000
```

## Verify before push

```bash
npm run lint && npm test && npm run build
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync
```

Push `main` → Vercel auto-deploys. Set Production env vars to match `.env.example`.
