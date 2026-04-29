import type { FieldDataInput } from "framer-api";
import { canonicalCisionEncryptedId } from "./cision";

/**
 * Primary teaser/cover image for Framer CMS bindings (first item in Cision `Images[]`).
 * Must match the image field in `MANAGED_SCHEMA_FIELDS` in `lib/framer.ts`.
 */
export const COVER_IMAGE_FIELD_ID = "CoverImage";

/**
 * Top-level keys on Cision `Release` objects (`detailLevel=detail` JSON list/detail).
 * Order is stable for UI; Framer field order follows this list (after `CoverImage`).
 */
export const CISION_RELEASE_FIELD_KEYS = [
  "EncryptedId",
  "Title",
  "Intro",
  "Body",
  "HtmlIntro",
  "HtmlTitle",
  "HtmlHeader",
  "HtmlBody",
  "Header",
  "PublishDate",
  "LastChangeDate",
  "InformationType",
  "LanguageCode",
  "Languages",
  "CountryCode",
  "IptcCode",
  "Keywords",
  "CanonicalUrl",
  "CisionWireUrl",
  "RawHtmlUrl",
  "LogoUrl",
  "PublicUrl",
  "Id",
  "MainJobId",
  "SourceId",
  "SourceName",
  "SourceIsListed",
  "SeOrganizationNumber",
  "IsRegulatory",
  "Complete",
  "SuppressImageOnCisionWire",
  "CompanyInformation",
  "HtmlCompanyInformation",
  "Contact",
  "HtmlContact",
  "Categories",
  "ServiceCategories",
  "EmbeddedItems",
  "ExternalLinks",
  "Files",
  "Images",
  "Videos",
  "Quotes",
  "QuickFacts",
  "Tickers",
  "LanguageVersions",
  "LegalReference",
  "HtmlLegalReference",
] as const;

export type CisionReleaseFieldKey = (typeof CISION_RELEASE_FIELD_KEYS)[number];

/**
 * Cision fields that carry HTML (or `isCleanHtml` text) and must be Framer
 * **`formattedText`** with **`contentType: "html"`** — plain `string` fields
 * trigger "Expected a collection node" for rich-text CMS columns.
 */
export const CISION_FORMATTED_HTML_FIELD_KEYS = new Set<CisionReleaseFieldKey>([
  "Intro",
  "Body",
  "HtmlIntro",
  "HtmlTitle",
  "HtmlHeader",
  "HtmlBody",
  "HtmlCompanyInformation",
  "HtmlContact",
  "HtmlLegalReference",
]);

/** First usable image URL from Cision detail `Images` (News Feed JSON). */
export function primaryImageUrlFromCision(
  raw: Record<string, unknown>,
): string | null {
  const images = raw.Images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const o = first as Record<string, unknown>;
  const candidates = [o.DownloadUrl, o.Url, o.downloadUrl];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function stringValueForFramer(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Map a Cision release to Framer `fieldData`: optional **`CoverImage`**, then
 * **`formattedText`** (HTML) or **`string`** per {@link CISION_FORMATTED_HTML_FIELD_KEYS}.
 */
export function rawReleaseToFieldData(raw: Record<string, unknown>): FieldDataInput {
  const fd: FieldDataInput = {};

  const imageUrl = primaryImageUrlFromCision(raw);
  if (imageUrl) {
    const alt =
      typeof raw.Title === "string" && raw.Title.trim()
        ? raw.Title.trim()
        : undefined;
    fd[COVER_IMAGE_FIELD_ID] = {
      type: "image",
      value: imageUrl,
      ...(alt ? { alt } : {}),
    };
  }

  for (const key of CISION_RELEASE_FIELD_KEYS) {
    let source: unknown = raw[key];
    if (key === "EncryptedId" && typeof source === "string") {
      source = canonicalCisionEncryptedId(source);
    }
    const str = stringValueForFramer(source);
    if (str === null) continue;
    if (CISION_FORMATTED_HTML_FIELD_KEYS.has(key)) {
      fd[key] = {
        type: "formattedText",
        value: str,
        contentType: "html",
      };
    } else {
      fd[key] = { type: "string", value: str };
    }
  }

  return fd;
}
