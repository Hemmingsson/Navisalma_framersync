import { requiredEnv } from "@/lib/shared/env";

/** HubSpot EU data centre; override for other regions. */
const DEFAULT_SUBMIT_BASE = "https://api-eu1.hsforms.com/submissions/v3/integration/submit";

export type NewsletterEnv = {
  portalId: string;
  formGuid: string;
  submitBase: string;
  webhookSecret: string;
};

export function loadNewsletterEnv(): NewsletterEnv {
  return {
    portalId: requiredEnv("HUBSPOT_PORTAL_ID"),
    formGuid: requiredEnv("HUBSPOT_FORM_GUID"),
    submitBase: (process.env.HUBSPOT_SUBMIT_BASE?.trim() || DEFAULT_SUBMIT_BASE).replace(/\/$/, ""),
    webhookSecret: requiredEnv("FRAMER_FORM_WEBHOOK_SECRET"),
  };
}
