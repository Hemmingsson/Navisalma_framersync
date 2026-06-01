import { loadSyncEnv } from "@/lib/env";
import { formatLastSync, readLastSync } from "@/lib/framer/last-sync";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let ok = false;
  let syncLine = "No sync recorded yet";

  try {
    const env = loadSyncEnv();
    ok = true;
    const lastSync = await readLastSync(env);
    if (lastSync) syncLine = formatLastSync(lastSync);
  } catch {
    ok = false;
    syncLine = "Configuration error";
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
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: ok ? "#22c55e" : "#ef4444",
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "#888",
        }}
      >
        {syncLine}
      </p>
    </main>
  );
}
