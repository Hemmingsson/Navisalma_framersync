const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = [500, 1000, 2000];

/** Single source for categorized sync error prefixes — extend here only. */
export const ERROR_CATEGORY_VALUES = [
  "cision_fetch_failed",
  "cision_detail_failed",
  "framer_write_failed",
  "timeout",
  "config",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORY_VALUES)[number];

export const SYNC_ERROR_CATEGORY_HEADS = new Set<string>([
  ...ERROR_CATEGORY_VALUES,
]);

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function categorizeSyncError(
  category: ErrorCategory,
  message: string,
): string {
  return `${category}: ${message}`;
}

export function isRetryableFetchOrNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/HTTP\s+(429|5\d{2})\b/i.test(msg)) return true;
  if (/ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|socket|network/i.test(msg))
    return true;
  return false;
}

export async function withTimeout<T>(
  ms: number,
  promise: Promise<T>,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    backoffMs?: number[];
    isRetryable?: (err: unknown) => boolean;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = options?.backoffMs ?? DEFAULT_BACKOFF_MS;
  const isRetryable = options?.isRetryable ?? isRetryableFetchOrNetworkError;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const retry = attempt < maxAttempts - 1 && isRetryable(e);
      if (!retry) throw e;
      const delay = backoffMs[attempt] ?? backoffMs[backoffMs.length - 1] ?? 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
