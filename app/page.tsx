import { featureEnvStatus, type FeatureName } from "@/lib/features/env-status";

export const dynamic = "force-dynamic";

const FEATURE_LABELS: Record<FeatureName, string> = {
  notifiedSync: "Notified → Framer CMS",
  hubspotNewsletter: "Framer form → HubSpot",
};

// Env-only status: a dot per feature, green if its env vars load.
// Deliberately does not call Framer or HubSpot, so rendering issues no API call.
export default function HomePage() {
  const { features } = featureEnvStatus();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  for (const [name, message] of Object.entries(features)) {
    if (message !== "ok") console.error(`${name}: ${message}`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 16,
        boxSizing: "border-box",
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.webp" alt="einride-framer-things" width={160} height={160} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {(Object.keys(FEATURE_LABELS) as FeatureName[]).map((name) => {
          const ok = features[name] === "ok";
          return (
            <li
              key={name}
              title={ok ? "ok" : features[name]}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
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
              <span>{FEATURE_LABELS[name]}</span>
              <span style={{ color: "#737373" }}>{ok ? "ok" : "misconfigured"}</span>
            </li>
          );
        })}
      </ul>
      {commit ? <span style={{ color: "#525252", fontSize: 12 }}>{commit}</span> : null}
    </main>
  );
}
