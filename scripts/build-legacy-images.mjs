// One-off: map Notified release Identifier → image from the legacy Framer "Press releases" CMS.
// Matches by normalized title. The sync only uses an entry when Notified itself has no image.
//   node --env-file=.env scripts/build-legacy-images.mjs
import { writeFileSync } from "node:fs";
import { connect } from "framer-api";

const FEED_URL =
  "https://rss.globenewswire.com/JsonFeed/organization/KRP8MKO23XlKmlSLWzS2WA==/content/fulltext/attachments/all";
const LEGACY_COLLECTION = "Press releases";
const OUT = new URL("../lib/features/notified-sync/legacy-images.json", import.meta.url);

const norm = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

const releases = new Map();
for (let start = 0; ; start += 100) {
  const res = await fetch(`${FEED_URL}/max/100/start/${start}`, {
    headers: { "User-Agent": "einride-framer-things/1.0 (+https://einride-framer-things.vercel.app)" },
  });
  if (!res.ok) throw new Error(`Feed ${res.status}`);
  const page = await res.json();
  for (const item of page) {
    const id = String(item.Identifier);
    if (!releases.has(id) || item.Language === "en") releases.set(id, item);
  }
  if (page.length < 100) break;
}

const framer = await connect(process.env.FRAMER_PROJECT_URL, process.env.FRAMER_API_KEY);
const legacy = (await framer.getCollections()).find((c) => c.name === LEGACY_COLLECTION);
if (!legacy) throw new Error(`Collection not found: ${LEGACY_COLLECTION}`);
const fields = Object.fromEntries((await legacy.getFields()).map((f) => [f.name, f.id]));
const byTitle = new Map(
  (await legacy.getItems()).map((item) => [norm(item.fieldData[fields.Title]?.value), item]),
);

const map = {};
const unmatched = [];
for (const [id, release] of [...releases].sort(([a], [b]) => a.localeCompare(b))) {
  const image = byTitle.get(norm(release.Title))?.fieldData[fields.Image]?.value?.url;
  if (image) map[id] = { title: release.Title, image };
  else unmatched.push(`${id} ${release.Title}`);
}

writeFileSync(OUT, `${JSON.stringify(map, null, 2)}\n`);
console.log(`Wrote ${Object.keys(map).length} entries; unmatched ${unmatched.length}`);
for (const line of unmatched) console.log(`  unmatched: ${line}`);
process.exit(0);
