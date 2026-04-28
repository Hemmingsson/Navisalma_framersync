import {
  connect,
  type Collection,
  type Field,
  type FieldDataEntryInput,
  type FieldDataInput,
  type Framer,
  type ManagedCollection,
} from "framer-api";
import type { CisionRelease } from "./cision";

export type FramerSyncResult = { synced: number; errors: string[] };

const COLLECTION_NAME_DEFAULT = "Press Releases";

const MANAGED_FIELD_IDS = {
  title: "cision_title",
  summary: "cision_summary",
  body: "cision_body",
  publishDate: "cision_publishDate",
  language: "cision_language",
  sourceUrl: "cision_sourceUrl",
  heroImage: "cision_heroImage",
} as const;

type ManagedFieldKey = keyof typeof MANAGED_FIELD_IDS;

const USER_FIELD_ALIASES: Record<ManagedFieldKey, string[]> = {
  title: ["title"],
  summary: ["summary", "intro"],
  body: ["body", "htmlbody", "content"],
  publishDate: ["publishdate", "published", "date"],
  language: ["language", "lang"],
  sourceUrl: ["sourceurl", "source", "publicurl", "canonicalurl", "link", "url"],
  heroImage: ["heroimage", "hero", "image", "cover"],
};

const REQUIRED_USER_KEYS: ManagedFieldKey[] = [
  "title",
  "summary",
  "body",
  "publishDate",
];

type TargetCollection =
  | { kind: "managed"; collection: ManagedCollection }
  | { kind: "user"; collection: Collection; slugToItemId: Map<string, string> };

function collectionName(): string {
  return process.env.FRAMER_COLLECTION_NAME?.trim() || COLLECTION_NAME_DEFAULT;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function resolveUserFieldIds(fields: readonly Field[]): Map<string, string> | null {
  const byNormName = new Map<string, string>();
  for (const f of fields) {
    if (f.type === "unsupported" || f.type === "divider") continue;
    byNormName.set(norm(f.name), f.id);
  }

  const stableToFramer = new Map<string, string>();
  for (const key of REQUIRED_USER_KEYS) {
    const stableId = MANAGED_FIELD_IDS[key];
    let found: string | undefined;
    for (const alias of USER_FIELD_ALIASES[key]) {
      const id = byNormName.get(norm(alias));
      if (id) {
        found = id;
        break;
      }
    }
    if (!found) return null;
    stableToFramer.set(stableId, found);
  }

  for (const key of ["language", "sourceUrl", "heroImage"] as const) {
    const stableId = MANAGED_FIELD_IDS[key];
    for (const alias of USER_FIELD_ALIASES[key]) {
      const id = byNormName.get(norm(alias));
      if (id) {
        stableToFramer.set(stableId, id);
        break;
      }
    }
  }

  return stableToFramer;
}

function identityManagedMapping(): Map<string, string> {
  return new Map(
    (Object.values(MANAGED_FIELD_IDS) as string[]).map((id) => [id, id]),
  );
}

async function ensureManagedSchema(collection: ManagedCollection): Promise<void> {
  const existing = await collection.getFields();
  if (existing.length > 0) return;
  await collection.setFields([
    { id: MANAGED_FIELD_IDS.title, name: "Title", type: "string" },
    {
      id: MANAGED_FIELD_IDS.summary,
      name: "Summary",
      type: "formattedText",
    },
    { id: MANAGED_FIELD_IDS.body, name: "Body", type: "formattedText" },
    { id: MANAGED_FIELD_IDS.publishDate, name: "Publish Date", type: "date" },
    { id: MANAGED_FIELD_IDS.language, name: "Language", type: "string" },
    { id: MANAGED_FIELD_IDS.sourceUrl, name: "Source URL", type: "link" },
    { id: MANAGED_FIELD_IDS.heroImage, name: "Hero Image", type: "image" },
  ]);
}

async function resolveTarget(framer: Framer, errors: string[]): Promise<TargetCollection | null> {
  const name = collectionName();
  const collections = await framer.getCollections();
  const userMatch = collections.find((c) => c.name === name);
  if (userMatch && userMatch.managedBy === "user") {
    const fields = await userMatch.getFields();
    const mapping = resolveUserFieldIds(fields);
    if (!mapping) {
      errors.push(
        `User collection "${name}" needs fields: Title, Summary or Intro, Body, Publish Date (see lib/framer.ts aliases).`,
      );
      return null;
    }
    const items = await userMatch.getItems();
    const slugToItemId = new Map<string, string>();
    for (const it of items) {
      slugToItemId.set(it.slug, it.id);
    }
    return { kind: "user", collection: userMatch, slugToItemId };
  }

  const managed = await framer.getManagedCollections();
  let managedMatch = managed.find((c) => c.name === name && c.managedBy === "thisPlugin");
  if (!managedMatch) {
    try {
      managedMatch = await framer.createManagedCollection(name);
    } catch (e) {
      errors.push(
        `Could not create/find managed collection "${name}": ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
  await ensureManagedSchema(managedMatch);
  return { kind: "managed", collection: managedMatch };
}

function managedFieldData(release: CisionRelease): FieldDataInput {
  const pub = release.publishDate?.trim() || new Date().toISOString();
  const fd: FieldDataInput = {
    [MANAGED_FIELD_IDS.title]: { type: "string", value: release.title },
    [MANAGED_FIELD_IDS.summary]: {
      type: "formattedText",
      value: release.summary || "<p></p>",
      contentType: "html",
    },
    [MANAGED_FIELD_IDS.body]: {
      type: "formattedText",
      value: release.bodyHtml || "<p></p>",
      contentType: "html",
    },
    [MANAGED_FIELD_IDS.publishDate]: { type: "date", value: pub },
    [MANAGED_FIELD_IDS.language]: {
      type: "string",
      value: release.language || "",
    },
    [MANAGED_FIELD_IDS.sourceUrl]: {
      type: "link",
      value: release.sourceUrl || "https://example.com",
    },
  };
  if (release.heroImageUrl) {
    fd[MANAGED_FIELD_IDS.heroImage] = {
      type: "image",
      value: release.heroImageUrl,
    };
  }
  return fd;
}

function userFieldData(
  mapping: Map<string, string>,
  release: CisionRelease,
): FieldDataInput {
  const fd: FieldDataInput = {};
  const put = (key: ManagedFieldKey, data: FieldDataEntryInput) => {
    const fid = mapping.get(MANAGED_FIELD_IDS[key]);
    if (fid) fd[fid] = data;
  };

  put("title", { type: "string", value: release.title });
  put("summary", {
    type: "formattedText",
    value: release.summary || "<p></p>",
    contentType: "html",
  });
  put("body", {
    type: "formattedText",
    value: release.bodyHtml || "<p></p>",
    contentType: "html",
  });
  put("publishDate", {
    type: "date",
    value: release.publishDate?.trim() || new Date().toISOString(),
  });
  if (release.language) {
    put("language", { type: "string", value: release.language });
  }
  if (release.sourceUrl) {
    put("sourceUrl", { type: "link", value: release.sourceUrl });
  }
  if (release.heroImageUrl) {
    put("heroImage", { type: "image", value: release.heroImageUrl });
  }
  return fd;
}

async function getMappingForTarget(target: TargetCollection): Promise<Map<string, string>> {
  if (target.kind === "managed") {
    return identityManagedMapping();
  }
  const resolved = resolveUserFieldIds(await target.collection.getFields());
  if (!resolved) throw new Error("Field mapping missing");
  return resolved;
}

async function upsertRelease(
  target: TargetCollection,
  release: CisionRelease,
  mapping: Map<string, string>,
): Promise<void> {
  const slug = release.encryptedId;
  const fieldData =
    target.kind === "managed"
      ? managedFieldData(release)
      : userFieldData(mapping, release);

  if (target.kind === "managed") {
    await target.collection.addItems([
      {
        id: release.encryptedId,
        slug,
        draft: false,
        fieldData,
      },
    ]);
    return;
  }

  const existingId = target.slugToItemId.get(slug);
  if (existingId) {
    await target.collection.addItems([
      {
        id: existingId,
        slug,
        draft: false,
        fieldData,
      },
    ]);
  } else {
    await target.collection.addItems([
      {
        slug,
        draft: false,
        fieldData,
      },
    ]);
  }
}

export async function syncReleasesToFramer(releases: CisionRelease[]): Promise<FramerSyncResult> {
  const errors: string[] = [];
  const projectUrl = process.env.FRAMER_PROJECT_URL?.trim();
  const apiKey = process.env.FRAMER_API_KEY?.trim();
  if (!projectUrl || !apiKey) {
    return { synced: 0, errors: ["Missing FRAMER_PROJECT_URL or FRAMER_API_KEY"] };
  }

  const framer = await connect(projectUrl, apiKey);
  let synced = 0;
  try {
    const target = await resolveTarget(framer, errors);
    if (!target) return { synced: 0, errors };

    const mapping = await getMappingForTarget(target);

    for (const release of releases) {
      try {
        await upsertRelease(target, release, mapping);
        synced++;
      } catch (e) {
        errors.push(
          `${release.encryptedId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  } finally {
    await framer.disconnect();
  }

  return { synced, errors };
}
