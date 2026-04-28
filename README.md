# navisalma-framersync

API-only service for Cision → Framer (deploy on Vercel, env vars in the dashboard — **never** commit secrets).

## Local setup

1. Copy `.env.example` to `.env` and fill values (`.env` is gitignored).
2. `npm install` then `npm run dev`.

## Checks

- `GET /api/health` — no auth.
- `GET /api/test/cision` — `Authorization: Bearer` + value of `CRON_SECRET` from your env; needs `CISION_FEED_ID` or `CISION_FEED_ID_EN_PRESS`.
- `GET /api/test/framer` — same auth; read-only Framer CMS layout (`FRAMER_PROJECT_URL`, `FRAMER_API_KEY` from env).

## Vercel

Connect the GitHub repo, then set the same variable names under **Settings → Environment Variables**. Do not put keys in the repo.

Build uses `npm run build` (default). If the dashboard **Root Directory** is wrong, the build will fail. Use **Node 18.18+** (see `engines` in `package.json`).

Cron is defined in `vercel.json` (`GET /api/sync` hourly). Vercel sends `Authorization: Bearer` with your `CRON_SECRET` automatically for cron invocations.

If the build log is truncated, open the deployment → **Building** and expand the error after `vercel build`; common issues: missing env at build time (Next does not need secrets to build), or outdated lockfile — run `npm install` locally and commit `package-lock.json`.
