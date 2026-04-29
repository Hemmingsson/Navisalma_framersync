import {
  connect,
  type Framer,
  type ManagedCollection,
  type ManagedCollectionFieldInput,
} from "framer-api";
import {
  CISION_FORMATTED_HTML_FIELD_KEYS,
  CISION_RELEASE_FIELD_KEYS,
  COVER_IMAGE_FIELD_ID,
} from "./cision-framer-schema";
import type { CisionSyncRelease } from "./dedupe-releases";
import {
  categorizeSyncError,
  errorMessage,
  isRetryableFetchOrNetworkError,
  withRetry,
  withTimeout,
} from "./retry-utils";

export type FramerSyncResult = { synced: number; errors: string[] };

const COLLECTION_NAME_DEFAULT = "cision_feed";

const MANAGED_SCHEMA_FIELDS: ManagedCollectionFieldInput[] = [
  {
    id: COVER_IMAGE_FIELD_ID,
    name: COVER_IMAGE_FIELD_ID,
    type: "image",
  },
  ...CISION_RELEASE_FIELD_KEYS.map(
    (id): ManagedCollectionFieldInput =>
      CISION_FORMATTED_HTML_FIELD_KEYS.has(id)
        ? {
            id,
            name: id,
            type: "formattedText",
            contentType: "html",
          }
        : {
            id,
            name: id,
            type: "string",
          },
  ),
];

function fieldSignatureFromInput(f: ManagedCollectionFieldInput): string {
  if (f.type === "formattedText") {
    return `${f.id}:formattedText:${f.contentType ?? ""}`;
  }
  return `${f.id}:${f.type}:`;
}

function expectedSchemaSignature(): string {
  return MANAGED_SCHEMA_FIELDS.map(fieldSignatureFromInput).sort().join("|");
}

function fieldSignatureFromExisting(
  f: Awaited<ReturnType<ManagedCollection["getFields"]>>[number],
): string {
  if (f.type === "formattedText") {
    return `${f.id}:formattedText:${f.contentType ?? ""}`;
  }
  return `${f.id}:${f.type}:`;
}

function existingSchemaSignature(
  fields: Awaited<ReturnType<ManagedCollection["getFields"]>>,
): string {
  return fields.map(fieldSignatureFromExisting).sort().join("|");
}

function collectionName(): string {
  return process.env.FRAMER_COLLECTION_NAME?.trim() || COLLECTION_NAME_DEFAULT;
}

async function ensureManagedSchema(collection: ManagedCollection): Promise<void> {
  const existing = await collection.getFields();
  if (expectedSchemaSignature() === existingSchemaSignature(existing)) return;
  await collection.setFields([...MANAGED_SCHEMA_FIELDS]);
}

async function resolveManagedTarget(
  framer: Framer,
  errors: string[],
): Promise<ManagedCollection | null> {
  const name = collectionName();
  const collections = await framer.getCollections();
  const userConflict = collections.find(
    (c) => c.name === name && c.managedBy === "user",
  );
  if (userConflict) {
    errors.push(
      categorizeSyncError(
        "config",
        `Collection "${name}" is user-managed. Remove it or rename FRAMER_COLLECTION_NAME — passthrough sync requires a managed collection only.`,
      ),
    );
    return null;
  }

  const managed = await framer.getManagedCollections();
  let managedMatch = managed.find(
    (c) => c.name === name && c.managedBy === "thisPlugin",
  );
  if (!managedMatch) {
    try {
      managedMatch = await framer.createManagedCollection(name);
    } catch (e) {
      errors.push(
        categorizeSyncError(
          "config",
          `Could not create/find managed collection "${name}": ${errorMessage(e)}`,
        ),
      );
      return null;
    }
  }
  await ensureManagedSchema(managedMatch);
  return managedMatch;
}

const FRAMER_UPSERT_TIMEOUT_MS = 45_000;

async function upsertReleaseOnce(
  collection: ManagedCollection,
  release: CisionSyncRelease,
): Promise<void> {
  const slug = release.encryptedId;

  // Framer Server API / managed collections: addItems upserts by stable `id` (same id updates the row; omit id for create-only).
  await collection.addItems([
    {
      id: release.encryptedId,
      slug,
      draft: false,
      fieldData: release.fieldData,
    },
  ]);
}

async function upsertRelease(
  collection: ManagedCollection,
  release: CisionSyncRelease,
): Promise<void> {
  await withRetry(
    () =>
      withTimeout(
        FRAMER_UPSERT_TIMEOUT_MS,
        upsertReleaseOnce(collection, release),
        `Framer upsert ${release.encryptedId}`,
      ),
    { isRetryable: isRetryableFetchOrNetworkError },
  );
}

export async function syncReleasesToFramer(
  releases: CisionSyncRelease[],
): Promise<FramerSyncResult> {
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
    const collection = await resolveManagedTarget(framer, errors);
    if (!collection) return { synced: 0, errors };

    for (const release of releases) {
      try {
        await upsertRelease(collection, release);
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
