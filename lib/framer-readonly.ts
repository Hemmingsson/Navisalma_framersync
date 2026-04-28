import { connect } from "framer-api";

/**
 * Read-only Framer inspection: project info, collection names, field id/name/type.
 * Does not create collections, fields, or items; does not publish.
 */
export type FramerFieldSummary = { id: string; name: string; type: string };

export type FramerCollectionSummary = {
  id: string;
  name: string;
  managedBy: string;
  slugFieldName: string | null;
  fields: FramerFieldSummary[];
  fieldError?: string;
};

export type FramerManagedCollectionSummary = {
  id: string;
  name: string;
  managedBy: string;
};

export type FramerInspectResult = {
  project: { name: string };
  collections: FramerCollectionSummary[];
  managedCollections: FramerManagedCollectionSummary[];
};

export async function inspectFramerReadOnly(): Promise<
  { ok: true; data: FramerInspectResult } | { ok: false; error: string }
> {
  const projectUrl = process.env.FRAMER_PROJECT_URL?.trim();
  const apiKey = process.env.FRAMER_API_KEY?.trim();
  if (!projectUrl || !apiKey) {
    return { ok: false, error: "Missing FRAMER_PROJECT_URL or FRAMER_API_KEY" };
  }

  const framer = await connect(projectUrl, apiKey);
  try {
    const projectInfo = await framer.getProjectInfo();
    const collections = await framer.getCollections();
    let managedList: Awaited<ReturnType<typeof framer.getManagedCollections>> =
      [];
    try {
      managedList = await framer.getManagedCollections();
    } catch {
      managedList = [];
    }

    const out: FramerInspectResult = {
      project: { name: projectInfo.name },
      collections: [],
      managedCollections: managedList.map((m) => ({
        id: m.id,
        name: m.name,
        managedBy: m.managedBy,
      })),
    };

    for (const c of collections) {
      try {
        const fields = await c.getFields();
        out.collections.push({
          id: c.id,
          name: c.name,
          managedBy: c.managedBy,
          slugFieldName: c.slugFieldName,
          fields: fields.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
          })),
        });
      } catch (e) {
        out.collections.push({
          id: c.id,
          name: c.name,
          managedBy: c.managedBy,
          slugFieldName: c.slugFieldName,
          fields: [],
          fieldError: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { ok: true, data: out };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await framer.disconnect();
  }
}
