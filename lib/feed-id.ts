/**
 * Feed id comes only from env (local `.env` or Vercel project settings).
 * Do not commit real values; use `.env.example` as a template.
 */
export function resolveCisionFeedId(): string {
  return (
    process.env.CISION_FEED_ID?.trim() ||
    process.env.CISION_FEED_ID_EN_PRESS?.trim() ||
    ""
  );
}
