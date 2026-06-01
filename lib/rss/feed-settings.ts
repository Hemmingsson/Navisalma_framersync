import { DEFAULT_ORG_TOKEN } from "../config";

export type ContentType = "" | "briefplain" | "brief" | "fulltext" | "photo";

export type AttachmentsMode = "" | "images" | "all" | "none";

export type SortOrder = "" | "asc" | "desc";

export const ATTACHMENT_TYPE_CODES = [
  { code: "REG", label: "Regular Attachment" },
  { code: "OTH", label: "Other" },
  { code: "INR", label: "Interim report" },
  { code: "ANR", label: "Annual Report" },
  { code: "POC", label: "Presentation of company" },
  { code: "PIR", label: "Presentation of Interim report" },
  { code: "PAR", label: "Presentation of Annual report" },
  { code: "PRI", label: "Primary Attachment" },
] as const;

export const DATE_FORMAT_PRESETS = [
  { value: "", label: "Default" },
  { value: "dd+MMM+yyyy", label: "20 Aug 2019" },
  { value: "MMM+dd,+yyyy", label: "Aug 20, 2019" },
  { value: "yyyy-MM-dd", label: "2019-08-20" },
  { value: "dd/MM/yyyy", label: "20/08/2019" },
] as const;

export const TARGET_LINK_OPTIONS = [
  { value: "", label: "Default (newsroom)" },
  { value: "newsroom", label: "newsroom" },
  { value: "niftXml", label: "niftXml" },
  { value: "newsArchiveRelativeUrl", label: "newsArchiveRelativeUrl" },
  { value: "newsarchive", label: "newsarchive" },
] as const;

export type FeedSettings = {
  organizationToken: string;
  contentType: ContentType;
  attachments: AttachmentsMode;
  attachmentTypes: string;
  pdf: boolean;
  noLinks: boolean;
  subjects: string;
  subjectCodes: string;
  language: string;
  keyword: string;
  newsTags: string;
  search: string;
  startDate: string;
  endDate: string;
  lastModDays: string;
  max: string;
  start: string;
  sort: SortOrder;
  count: boolean;
  showLogo: boolean;
  secure: boolean;
  feedTitle: string;
  targetLink: string;
  dateFormat: string;
  timezone: string;
};

export const DEFAULT_FEED_SETTINGS: FeedSettings = {
  organizationToken: DEFAULT_ORG_TOKEN,
  contentType: "fulltext",
  attachments: "all",
  attachmentTypes: "",
  pdf: false,
  noLinks: false,
  subjects: "",
  subjectCodes: "",
  language: "",
  keyword: "",
  newsTags: "",
  search: "",
  startDate: "",
  endDate: "",
  lastModDays: "",
  max: "20",
  start: "",
  sort: "desc",
  count: false,
  showLogo: false,
  secure: false,
  feedTitle: "",
  targetLink: "",
  dateFormat: "",
  timezone: "",
};

export function settingsFromSearchParams(params: URLSearchParams): FeedSettings {
  const bool = (key: string) => params.get(key) === "1" || params.get(key) === "true";
  const str = (key: string, fallback: string) => params.get(key) ?? fallback;

  return {
    organizationToken: str("token", DEFAULT_FEED_SETTINGS.organizationToken),
    contentType: (params.has("content") ? params.get("content") : DEFAULT_FEED_SETTINGS.contentType) as ContentType,
    attachments: (params.has("attachments") ? params.get("attachments") : DEFAULT_FEED_SETTINGS.attachments) as AttachmentsMode,
    attachmentTypes: str("atttyp", DEFAULT_FEED_SETTINGS.attachmentTypes),
    pdf: params.has("pdf") ? bool("pdf") : DEFAULT_FEED_SETTINGS.pdf,
    noLinks: params.has("nolinks") ? bool("nolinks") : DEFAULT_FEED_SETTINGS.noLinks,
    subjects: str("subjects", DEFAULT_FEED_SETTINGS.subjects),
    subjectCodes: str("subjectcodes", DEFAULT_FEED_SETTINGS.subjectCodes),
    language: str("language", DEFAULT_FEED_SETTINGS.language),
    keyword: str("keyword", DEFAULT_FEED_SETTINGS.keyword),
    newsTags: str("newstags", DEFAULT_FEED_SETTINGS.newsTags),
    search: str("search", DEFAULT_FEED_SETTINGS.search),
    startDate: str("startdate", DEFAULT_FEED_SETTINGS.startDate),
    endDate: str("enddate", DEFAULT_FEED_SETTINGS.endDate),
    lastModDays: str("lastmod", DEFAULT_FEED_SETTINGS.lastModDays),
    max: str("max", DEFAULT_FEED_SETTINGS.max),
    start: str("start", DEFAULT_FEED_SETTINGS.start),
    sort: (params.has("sort") ? params.get("sort") : DEFAULT_FEED_SETTINGS.sort) as SortOrder,
    count: params.has("count") ? bool("count") : DEFAULT_FEED_SETTINGS.count,
    showLogo: params.has("showlogo") ? bool("showlogo") : DEFAULT_FEED_SETTINGS.showLogo,
    secure: params.has("secure") ? bool("secure") : DEFAULT_FEED_SETTINGS.secure,
    feedTitle: str("feedtitle", DEFAULT_FEED_SETTINGS.feedTitle),
    targetLink: str("targetlink", DEFAULT_FEED_SETTINGS.targetLink),
    dateFormat: str("dateformat", DEFAULT_FEED_SETTINGS.dateFormat),
    timezone: str("timezone", DEFAULT_FEED_SETTINGS.timezone),
  };
}

export function settingsToSearchParams(settings: FeedSettings): URLSearchParams {
  const params = new URLSearchParams();

  const set = (key: string, value: string | boolean | undefined) => {
    if (value === undefined || value === "" || value === false) return;
    params.set(key, typeof value === "boolean" ? "1" : value);
  };

  if (settings.organizationToken !== DEFAULT_ORG_TOKEN) set("token", settings.organizationToken);
  set("content", settings.contentType);
  set("attachments", settings.attachments);
  set("atttyp", settings.attachmentTypes);
  set("pdf", settings.pdf);
  set("nolinks", settings.noLinks);
  set("subjects", settings.subjects);
  set("subjectcodes", settings.subjectCodes);
  set("language", settings.language);
  set("keyword", settings.keyword);
  set("newstags", settings.newsTags);
  set("search", settings.search);
  set("startdate", settings.startDate);
  set("enddate", settings.endDate);
  set("lastmod", settings.lastModDays);
  if (settings.max !== "20") set("max", settings.max);
  set("start", settings.start);
  if (settings.sort && settings.sort !== "desc") set("sort", settings.sort);
  set("count", settings.count);
  set("showlogo", settings.showLogo);
  set("secure", settings.secure);
  set("feedtitle", settings.feedTitle);
  set("targetlink", settings.targetLink);
  set("dateformat", settings.dateFormat);
  set("timezone", settings.timezone);

  return params;
}
