import { loadNewsletterEnv } from "./hubspot-newsletter/env";
import { loadSyncEnv } from "./notified-sync/env";

/** Every feature's env loader; add new features here so health and `/` cover them. */
const FEATURE_ENV_LOADERS = {
  notifiedSync: loadSyncEnv,
  hubspotNewsletter: loadNewsletterEnv,
} satisfies Record<string, () => unknown>;

export type FeatureName = keyof typeof FEATURE_ENV_LOADERS;

/** `"ok"` or the env error message, per feature. */
export function featureEnvStatus(): { ok: boolean; features: Record<FeatureName, string> } {
  const features = {} as Record<FeatureName, string>;
  for (const [name, load] of Object.entries(FEATURE_ENV_LOADERS)) {
    try {
      load();
      features[name as FeatureName] = "ok";
    } catch (error) {
      features[name as FeatureName] = error instanceof Error ? error.message : "Configuration error";
    }
  }
  return { ok: Object.values(features).every((status) => status === "ok"), features };
}
