const CISION_BASE = "https://publish.ne.cision.com/papi";

export type CisionReleaseRaw = {
  EncryptedId?: string;
  Title?: string;
  Intro?: string;
  HtmlBody?: string;
  Body?: string;
  PublishDate?: string;
  LanguageCode?: string;
  Languages?: { Code?: string }[];
  PublicUrl?: string;
  CanonicalUrl?: string;
  CisionWireUrl?: string;
  Images?: { DownloadUrl?: string }[];
};

export type CisionFeedResponse = {
  PageIndex?: number;
  PageSize?: number;
  TotalFoundReleases?: number;
  Releases?: CisionReleaseRaw[];
};

export type CisionRelease = {
  encryptedId: string;
  title: string;
  summary: string;
  bodyHtml: string;
  publishDate: string;
  language: string;
  sourceUrl: string;
  heroImageUrl: string | null;
};

function pickLanguage(raw: CisionReleaseRaw): string {
  return raw.Languages?.[0]?.Code ?? raw.LanguageCode ?? "";
}

function pickSourceUrl(raw: CisionReleaseRaw): string {
  return raw.PublicUrl ?? raw.CanonicalUrl ?? raw.CisionWireUrl ?? "";
}

export function normalizeCisionRelease(raw: CisionReleaseRaw): CisionRelease | null {
  const encryptedId = raw.EncryptedId?.trim();
  if (!encryptedId) return null;
  const firstImg = raw.Images?.[0];
  return {
    encryptedId,
    title: (raw.Title ?? "").trim() || "(untitled)",
    summary: (raw.Intro ?? "").trim(),
    bodyHtml: (raw.HtmlBody ?? raw.Body ?? "") as string,
    publishDate: raw.PublishDate ?? "",
    language: pickLanguage(raw),
    sourceUrl: pickSourceUrl(raw),
    heroImageUrl: firstImg?.DownloadUrl?.trim() ?? null,
  };
}

export async function fetchFeed(feedId: string): Promise<CisionFeedResponse> {
  const url = `${CISION_BASE}/NewsFeed/${encodeURIComponent(
    feedId,
  )}?format=json&detailLevel=detail&pageSize=50`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Cision feed HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as CisionFeedResponse;
}

export async function fetchRelease(encryptedId: string): Promise<CisionRelease | null> {
  const url = `${CISION_BASE}/Release/${encodeURIComponent(
    encryptedId,
  )}?format=json&isCleanHtml=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Cision release HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    Release?: CisionReleaseRaw;
  };
  const raw = data.Release;
  if (!raw) return null;
  return normalizeCisionRelease(raw);
}
