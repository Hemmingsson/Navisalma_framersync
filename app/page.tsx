import { loadSyncEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Static, env-only status: green if required env vars load, red otherwise.
// Deliberately does not connect to Framer, so rendering `/` issues no API call.
export default function HomePage() {
  let title = "ok";
  let color = "#22c55e";

  try {
    loadSyncEnv();
  } catch (err) {
    color = "#ef4444";
    title = err instanceof Error ? err.message : "Configuration error";
    console.error(err);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        margin: 0,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <span
        aria-hidden
        title={title}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
    </main>
  );
}
