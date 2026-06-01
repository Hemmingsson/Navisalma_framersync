/** True only when running `next dev` locally — not on Vercel production or preview. */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}
