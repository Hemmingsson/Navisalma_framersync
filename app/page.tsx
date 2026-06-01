import { loadSyncEnv } from "@/lib/env";
import { readSyncStatus, STATUS_DOT_COLORS } from "@/lib/framer/last-sync";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let status: keyof typeof STATUS_DOT_COLORS = "error";
  let syncLine = "Configuration error";

  try {
    const env = loadSyncEnv();
    ({ status, syncLine } = await readSyncStatus(env));
  } catch {
    // loadSyncEnv throws when required env vars are missing
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
        title={status}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_DOT_COLORS[status],
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
