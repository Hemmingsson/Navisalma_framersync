export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>Navisalma Framer Sync</h1>
      <p>GlobeNewswire RSS → Framer CMS. Cron at <code>/api/sync</code>.</p>
      <ul>
        <li>
          <a href="/feed-demo"><strong>Feed explorer</strong></a> — JsonFeed preview + parameter builder
        </li>
        <li>
          <a href="/api/health">/api/health</a>
        </li>
      </ul>
    </main>
  );
}
