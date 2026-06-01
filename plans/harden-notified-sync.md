# Execution plan — Harden Notified→Framer sync

Validated against the working tree on 2026-06-01. Baseline: 28 tests pass, `npm run build` succeeds.

**Important:** The working tree already contains uncommitted work — a table-driven `JSON_FEED_FIELD_MAP` (22 fields, all `string` for unknown shapes) and an expanded `JsonFeedItem` type. This plan edits that working-tree state, not `HEAD`.

Verified facts:
- `framer-api@0.1.5` exposes `image` and `boolean` field types. Data inputs: `ImageFieldDataEntryInput = { type: "image", value: string | null, alt? }`, `BooleanFieldDataEntryInput = { type: "boolean", value: boolean }`. Field inputs `{ id, name, type: "image" }` / `{ id, name, type: "boolean" }` are valid (no required crop/resolution).
- Deleted last-sync exports are consumed only by `app/page.tsx` and `lib/framer/last-sync.test.ts`.
- `JsonFeedItem` is defined in `lib/rss/parse-json-feed.ts`; `lib/rss/types.ts` re-exports it. Importers of the type all use `../rss/types` except `parse-json-feed.ts` itself.

---

## Task groups (file-disjoint → parallelizable)

Each group touches a disjoint file set, so groups run in parallel. Contracts (exported names/signatures) are fixed below so cross-group imports line up without coordination.

### Group A — `lib/framer/schema.ts` + `lib/framer/schema.test.ts` (Findings 3, 12, and the `schemaFingerprint` half of 2)

**`schema.ts` changes:**

1. **Field map delta** in `JSON_FEED_FIELD_MAP`:
   - `logo` → `{ id: "logoImage", name: "Logo", framerType: "image", jsonKey: "Logo" }`
   - `orgLogo` → `{ id: "orgLogoImage", name: "Org Logo", framerType: "image", jsonKey: "OrgLogo" }`
   - `isFullTextRss` → `framerType: "boolean"` (keep id/name/jsonKey)
   - **Remove** the `widgetAttachment` and `relatedLinks` entries entirely.
   - Result: 20 fields.

2. **`extractImageUrl(value: unknown): string | null`** helper (string → trimmed; array → first non-null recursively; `{url}` object → trimmed string or null; else null).

3. **`FieldDataValue` union** grows:
   ```ts
   | { type: "boolean"; value: boolean }
   | { type: "image"; value: string | null }
   ```

4. **`jsonFeedItemToFieldData`** switch gains `case "boolean"` (`{ type: "boolean", value: raw === true }`) and `case "image"` (`{ type: "image", value: extractImageUrl(raw) }`).

5. **`buildCollectionFields`** — if the `{ id, name, type: framerType }` return fails to typecheck once `image`/`boolean` are in the union, add explicit `as const` branches mirroring the existing `formattedText` special-case (one branch per literal, or a typed cast to `ManagedCollectionFieldInput`). Verify with `npm run build`.

6. **`fingerprintValue`** — `link`/`image` use `value ?? ""`; `boolean` uses `String(value)`. (Dropped keys are absent from the map, hence absent from the fingerprint — intended.)

7. **`parseFeedDate(value, fieldName)`** (Finding 12) — add a second arg; when value is non-empty and unparseable, `throw new Error(\`Invalid date: ${value} for field ${fieldName}\`)`. Empty/undefined still returns `undefined`. Update the `case "date"` caller to pass the field `id`.

8. **`schemaFingerprint(): string`** (Finding 2) — export:
   ```ts
   export function schemaFingerprint(): string {
     return createHash("sha256").update(JSON.stringify(buildCollectionFields())).digest("hex");
   }
   ```

**`schema.test.ts` changes** — rewrite the field-data expectations for the changed/dropped fields:
- `defines all JsonFeed-backed Framer fields` → `toHaveLength(20)`.
- `logoImage` for `Logo: ["https://example.com/logo.png"]` → `{ type: "image", value: "https://example.com/logo.png" }`.
- `orgLogoImage` for `OrgLogo: { url: "https://example.com/org.png" }` → `{ type: "image", value: "https://example.com/org.png" }`.
- `isFullTextRss` for `IsFullTextRss: true` → `{ type: "boolean", value: true }`.
- `isins` for `ISINs: ["A","B"]` → `{ type: "string", value: "A, B" }` (keep the existing single-element assertion or extend).
- Assert `fieldData.widgetAttachment` and `fieldData.relatedLinks` are `undefined`.
- Remove the old `logo`/`orgLogo`(string)/`widgetAttachment`/`relatedLinks`(string)/`isFullTextRss`(string) assertions.
- Add a `parseFeedDate` throw test: `expect(() => jsonFeedItemToFieldData({ ...sampleItem, ReleaseDateTime: "not-a-date" })).toThrow(/Invalid date/)`.

### Group B — `lib/framer/sync-press-releases.ts` + `lib/framer/sync-press-releases.test.ts` (Findings 1, 2-wiring, 10)

1. **Empty-feed guard (Finding 1)** — first statement of `syncPressReleasesToFramer`, before `connect`:
   ```ts
   if (items.length === 0) {
     throw new Error("Empty feed; refusing to reconcile (would wipe collection)");
   }
   ```

2. **Schema-fingerprint guard (Finding 2)** — import `schemaFingerprint` from `./schema`. Add `const SCHEMA_FINGERPRINT_KEY = "lastSchemaFingerprint";`. Rework `ensureManagedCollection` so `setFields` runs only when the collection was just created OR the stored schema fingerprint differs; then `setPluginData(SCHEMA_FINGERPRINT_KEY, current)`. Found-collection path reads the stored fingerprint first.

3. **Reorder fingerprint write (Finding 10)** — move `setPluginData(FINGERPRINT_KEY, fingerprint)` to *after* the `publish`/`deploy` block, so a failed deploy leaves the feed fingerprint unchanged and the next run retries. Keep the `LAST_SYNC_KEY` write last.

**Test changes:**
- New: `items: []` with non-empty `getItemIds` → `rejects.toThrow(/Empty feed/)` and `removeItems` **not** called.
- New: when the stored `SCHEMA_FINGERPRINT_KEY` equals the current `schemaFingerprint()`, `setFields` is **not** called; when it differs (or is null), it **is**. (Add `getPluginData` mock returns keyed by argument, or assert call patterns.)
- Existing two tests stay green (adjust `getPluginData` mock so the feed-fingerprint lookups still behave).

### Group C — `lib/rss/fetch-all-feed.ts` + `lib/rss/fetch-all-feed.test.ts` (Finding 5)

1. Add `const MAX_PAGES = 200;` and inside the loop, after `pages += 1`:
   ```ts
   if (pages > MAX_PAGES) {
     throw new Error(`Feed pagination exceeded ${MAX_PAGES} pages — refusing to continue`);
   }
   ```
2. Test: mock `fetch` to always return a full page of `pageSize` items (each with a unique `Identifier`), assert `fetchAllFeedItems` rejects with `/exceeded 200 pages/`.

### Group D — `lib/rss/types.ts` + `lib/rss/parse-json-feed.ts` (Finding 6)

1. Move the `JsonFeedItem` type *definition* from `parse-json-feed.ts` into `types.ts` (alongside `SyncResult`).
2. In `types.ts`, delete the `export type { JsonFeedItem } from "./parse-json-feed";` re-export and replace with the actual definition.
3. In `parse-json-feed.ts`, add `import type { JsonFeedItem } from "./types";` and remove the inline definition. Leave all functions intact.
4. No circular import: `types.ts` imports nothing from `parse-json-feed.ts`; `parse-json-feed.ts` imports the type from `types.ts` (one-way). Confirm `npm run build`.

### Group E — `app/page.tsx` + `lib/framer/last-sync.ts` + `lib/framer/last-sync.test.ts` (Findings 4, 7, 9)

1. **`last-sync.ts`** — keep only `LAST_SYNC_KEY`, `LastSyncRecord`, and a tightened `parseLastSync`. Remove `readLastSync`, `readSyncStatus`, `syncStatusFromLastSync`, `formatLastSync`, `STALE_SYNC_MS`, `STATUS_DOT_COLORS`, `SyncStatus`, and the now-unused `connect`/`findManagedCollection`/`SyncEnv` imports.
   - **Tighten `parseLastSync` (Finding 4):** return `null` unless the parsed object has `at: string` and numeric `fetched`/`upserted`/`removed`/`changed(boolean)`/`collection(string)`/`published(boolean)`. Plain guard, no Zod.
2. **`app/page.tsx`** (Findings 7 + 9) — rewrite: no `readSyncStatus`, no `connect`, no last-sync line. `try { loadSyncEnv() }` → green dot; `catch (err)` → red dot, set `title={err.message}` (the missing-var name) and `console.error(err)` server-side. Keep `export const dynamic = "force-dynamic"`. Use a local 2-color map instead of `STATUS_DOT_COLORS`.
3. **`last-sync.test.ts`** — trim to `parseLastSync` only: a valid record round-trips; a malformed/legacy-shaped record (e.g. missing `published`, or `fetched` as string) returns `null`. Remove `formatLastSync`/`syncStatusFromLastSync` tests.

### Group F — `app/api/feed-preview/route.ts` + `app/api/feed-preview/route.test.ts` (Finding 8)

1. Success path returns `{ ok, feedUrl, settings, jsonItems, itemCount }` only — drop `parsed` and `raw`. Error paths keep truncated `raw`.
2. Test: on the valid-array case, assert `body.parsed === undefined` and `body.raw === undefined` (plus existing `jsonItems`/`itemCount` checks).

### Group G — `package.json` + `AGENTS.md` + `CLAUDE.md` (Findings 11 + doc sync)

1. `package.json`: `engines.node` → `">=20.11.0"`.
2. `AGENTS.md`: field count `22` → `20`; `/` description drop "+ last sync" → "status dot only"; add a line under the sync pipeline noting the empty-feed refusal and that `setFields` runs only when the schema fingerprint changes.
3. `CLAUDE.md`: add a one-line note on empty-feed refusal behaviour; ensure no reference to last-sync display on `/`.

---

## Dependency / ordering notes

- **Group A must define `schemaFingerprint` before Group B's build passes**, but they edit disjoint files — run in parallel using the fixed contract: `export function schemaFingerprint(): string` in `schema.ts`. The final `npm run build` validates the link.
- Groups C, D, E, F, G are fully independent.
- After all groups land, run the full gate once.

## Verification gate (run after all groups)

```bash
npm test        # expect all suites green, incl. empty-feed refusal, schema-fingerprint skip,
                # image extraction, boolean coercion, max-pages throw, bad-date throw,
                # dropped widgetAttachment/relatedLinks, trimmed parseLastSync, feed-preview shape
npm run build   # next build + typecheck clean
```

Manual smoke is optional (requires live Framer creds) and out of scope for this automated run; the empty-feed refusal and idempotency are covered by unit tests.

## Out of scope / deferred

- No new features beyond the 12 findings.
- Live Framer-side column spot-check is manual and not part of this run.
