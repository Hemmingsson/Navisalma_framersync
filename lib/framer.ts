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
import {
  categorizeSyncError,
  errorMessage,
  isRetryableFetchOrNetworkError,
  withRetry,
  withTimeout,
} from "./retry-utils";

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
  contentType: "cision_contentType",
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
  contentType: ["contenttype", "type", "category"],
};

const REQUIRED_USER_KEYS: ManagedFieldKey[] = [
  "title",
  "summary",
  "body",
  "publishDate",
];

type TargetCollection =
  | {
      kind: "managed";
      collection: ManagedCollection;
      /** False when collection existed before `cision_contentType` existed — omit field on write. */
      hasContentTypeField: boolean;
    }
  | {
      kind: "user";
      collection: Collection;
      slugToItemId: Map<string, string>;
      fieldMapping: Map<string, string>;
    };

function collectionName(): string {
  return process.env.FRAMER_COLLECTION_NAME?.trim() || COLLECTION_NAME_DEFAULT;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlToSafeParagraph(input: string): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (!compact) return "<p></p>";
  // Framer rejects some vendor HTML payloads; plain paragraph is the safest fallback.
  return `<p>${escapeHtml(compact)}</p>`;
}

function safeFormattedHtml(input: string): string {
  const v = input.trim();
  if (!v) return "<p></p>";
  // Prefer existing HTML for normal cases; fallback protects against malformed rich text payloads.
  if (/<\/?[a-z][\s\S]*>/i.test(v)) return v;
  return htmlToSafeParagraph(v);
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

  for (const key of ["language", "sourceUrl", "heroImage", "contentType"] as const) {
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

const MANAGED_SCHEMA_FIELDS = [
  { id: MANAGED_FIELD_IDS.title, name: "Title", type: "string" as const },
  {
    id: MANAGED_FIELD_IDS.summary,
    name: "Summary",
    type: "formattedText" as const,
  },
  { id: MANAGED_FIELD_IDS.body, name: "Body", type: "formattedText" as const },
  { id: MANAGED_FIELD_IDS.publishDate, name: "Publish Date", type: "date" as const },
  { id: MANAGED_FIELD_IDS.language, name: "Language", type: "string" as const },
  { id: MANAGED_FIELD_IDS.sourceUrl, name: "Source URL", type: "link" as const },
  { id: MANAGED_FIELD_IDS.heroImage, name: "Hero Image", type: "image" as const },
  {
    id: MANAGED_FIELD_IDS.contentType,
    name: "Content Type",
    type: "string" as const,
  },
];

async function ensureManagedSchema(collection: ManagedCollection): Promise<void> {
  const existing = await collection.getFields();
  if (existing.length > 0) return;
  await collection.setFields([...MANAGED_SCHEMA_FIELDS]);
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
    return {
      kind: "user",
      collection: userMatch,
      slugToItemId,
      fieldMapping: mapping,
    };
  }

  const managed = await framer.getManagedCollections();
  let managedMatch = managed.find((c) => c.name === name && c.managedBy === "thisPlugin");
  if (!managedMatch) {
    try {
      managedMatch = await framer.createManagedCollection(name);
    } catch (e) {
      errors.push(
        `Could not create/find managed collection "${name}": ${errorMessage(e)}`,
      );
      return null;
    }
  }
  await ensureManagedSchema(managedMatch);
  const managedFields = await managedMatch.getFields();
  const hasContentTypeField = managedFields.some(
    (f) => f.id === MANAGED_FIELD_IDS.contentType,
  );
  return {
    kind: "managed",
    collection: managedMatch,
    hasContentTypeField,
  };
}

function managedFieldData(
  release: CisionRelease,
  hasContentTypeField: boolean,
): FieldDataInput {
  const summaryHtml = safeFormattedHtml(release.summary || "");
  const bodyHtml = safeFormattedHtml(release.bodyHtml || "");
  const fd: FieldDataInput = {
    [MANAGED_FIELD_IDS.title]: { type: "string", value: release.title },
    [MANAGED_FIELD_IDS.summary]: {
      type: "formattedText",
      value: summaryHtml,
      contentType: "html",
    },
    [MANAGED_FIELD_IDS.body]: {
      type: "formattedText",
      value: bodyHtml,
      contentType: "html",
    },
    [MANAGED_FIELD_IDS.language]: {
      type: "string",
      value: release.language || "",
    },
  };
  const pd = release.publishDate?.trim();
  if (pd) {
    fd[MANAGED_FIELD_IDS.publishDate] = { type: "date", value: pd };
  }
  const url = release.sourceUrl?.trim();
  if (url) {
    fd[MANAGED_FIELD_IDS.sourceUrl] = { type: "link", value: url };
  }
  if (hasContentTypeField) {
    fd[MANAGED_FIELD_IDS.contentType] = {
      type: "string",
      value: release.contentType,
    };
  }
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
  const summaryHtml = safeFormattedHtml(release.summary || "");
  const bodyHtml = safeFormattedHtml(release.bodyHtml || "");
  const fd: FieldDataInput = {};
  const put = (key: ManagedFieldKey, data: FieldDataEntryInput) => {
    const fid = mapping.get(MANAGED_FIELD_IDS[key]);
    if (fid) fd[fid] = data;
  };

  put("title", { type: "string", value: release.title });
  put("summary", {
    type: "formattedText",
    value: summaryHtml,
    contentType: "html",
  });
  put("body", {
    type: "formattedText",
    value: bodyHtml,
    contentType: "html",
  });
  const pd = release.publishDate?.trim();
  if (pd) {
    put("publishDate", { type: "date", value: pd });
  }
  if (release.language) {
    put("language", { type: "string", value: release.language });
  }
  if (release.sourceUrl) {
    put("sourceUrl", { type: "link", value: release.sourceUrl });
  }
  if (release.heroImageUrl) {
    put("heroImage", { type: "image", value: release.heroImageUrl });
  }
  put("contentType", { type: "string", value: release.contentType });
  return fd;
}

function mappingForTarget(target: TargetCollection): Map<string, string> {
  if (target.kind === "managed") {
    return identityManagedMapping();
  }
  return target.fieldMapping;
}

const FRAMER_UPSERT_TIMEOUT_MS = 45_000;

async function upsertReleaseOnce(
  target: TargetCollection,
  release: CisionRelease,
  mapping: Map<string, string>,
): Promise<void> {
  const slug = release.encryptedId;
  const fieldData =
    target.kind === "managed"
      ? managedFieldData(release, target.hasContentTypeField)
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

async function upsertRelease(
  target: TargetCollection,
  release: CisionRelease,
  mapping: Map<string, string>,
): Promise<void> {
  await withRetry(
    () =>
      withTimeout(
        FRAMER_UPSERT_TIMEOUT_MS,
        upsertReleaseOnce(target, release, mapping),
        `Framer upsert ${release.encryptedId}`,
      ),
    { isRetryable: isRetryableFetchOrNetworkError },
  );
}

export async function syncReleasesToFramer(releases: CisionRelease[]): Promise<FramerSyncResult> {
  const errors: string[] = [];
  const projectUrl = process.env.FRAMER_PROJECT_URL?.trim();
  const apiKey = process.env.FRAMER_API_KEY?.trim();
  if (!projectUrl || !apiKey) {
    return {
      synced: 0,
      errors: [
        categorizeSyncError(
          "config",
          "Missing FRAMER_PROJECT_URL or FRAMER_API_KEY",
        ),
      ],
    };
  }

  const framer = await connect(projectUrl, apiKey);
  let synced = 0;
  try {
    const target = await resolveTarget(framer, errors);
    if (!target) return { synced: 0, errors };

    const mapping = mappingForTarget(target);

    for (const release of releases) {
      try {
        await upsertRelease(target, release, mapping);
        synced++;
      } catch (e) {
        errors.push(`${release.encryptedId}: ${errorMessage(e)}`);
      }
    }
  } finally {
    await framer.disconnect();
  }

  return { synced, errors };
}
