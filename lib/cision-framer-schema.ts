/** Framer-compatible string field entries (`FieldDataInput` subset). */
export type FramerStringFieldData = Record<
  string,
  { type: "string"; value: string }
>;

/**
 * Top-level keys on Cision `Release` objects (`detailLevel=detail` JSON list/detail).
 * Order is stable for UI; Framer field order follows this list.
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

/** Map a Cision release object to Framer `string` field data (known keys only). */
export function rawReleaseToFieldData(
  raw: Record<string, unknown>,
): FramerStringFieldData {
  const fd: FramerStringFieldData = {};
  for (const key of CISION_RELEASE_FIELD_KEYS) {
    const str = stringValueForFramer(raw[key]);
    if (str === null) continue;
    fd[key] = { type: "string", value: str };
  }
  return fd;
}
