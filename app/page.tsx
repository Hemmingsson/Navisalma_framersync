/** Root URL exists only because the App Router requires a page; the product is HTTP APIs. */
export default function Page() {
  return (
    <pre style={{ margin: 16, fontFamily: "monospace" }}>
      navisalma-framersync — API-only service. Try GET /api/health (no auth). Protected tests:
      GET /api/test/cision · GET /api/test/framer — Authorization: Bearer + env CRON_SECRET
      GET /api/sync (cron) · POST /api/sync/run (manual) — same Bearer; sync needs CISION_FEED_ID + Framer env
    </pre>
  );
}
