import { featureEnvStatus } from "@/lib/features/env-status";

export const dynamic = "force-dynamic";

// Static, env-only status: green if every feature's env vars load, red otherwise.
// Deliberately does not connect to Framer, so rendering `/` issues no API call.
export default function HomePage() {
  let title = "ok";
  let color = "#22c55e";

  const status = featureEnvStatus();
  if (!status.ok) {
    color = "#ef4444";
    title = Object.entries(status.features)
      .filter(([, message]) => message !== "ok")
      .map(([name, message]) => `${name}: ${message}`)
      .join("; ");
    console.error(title);
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
