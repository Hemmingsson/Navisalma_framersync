import { SYNC_ERROR_CATEGORY_HEADS } from "./retry-utils";

/** Cision release ids in feeds are typically 32-char hex GUID segments (case-insensitive). */
const FRAMER_LINE_HEX32_PREFIX = /^([0-9A-F]{32}):\s/i;

/**
 * Extract the Framer/`syncReleasesToFramer` item id from an error line shaped like
 * `{encryptedId}: {message}`.
 *
 * Lines starting with a known categorized prefix (`cision_fetch_failed`, `config`, …)
 * return `null` — those are not per-item Framer failures.
 *
 * Prefer matching a 32-char hex id prefix; otherwise split on the first `": "`.
 */
export function encryptedIdFromFramerErrorLine(line: string): string | null {
  const hex = line.match(FRAMER_LINE_HEX32_PREFIX);
  if (hex?.[1]) return hex[1];

  const sep = ": ";
  const i = line.indexOf(sep);
  if (i < 0) return null;
  const head = line.slice(0, i).trim();
  if (SYNC_ERROR_CATEGORY_HEADS.has(head)) return null;
  return head;
}
