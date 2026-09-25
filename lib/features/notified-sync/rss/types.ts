/** GlobeNewswire JsonFeed item shape (PascalCase keys from vendor API). */
export type JsonFeedItem = {
  Title?: string;
  Url?: string;
  ReleaseDateTime?: string;
  LocalizedReleaseDateTime?: string;
  ModifiedDate?: string;
  Content?: string;
  ContentSummary?: string;
  Summary?: string;
  Subjects?: string | string[];
  Language?: string;
  Keywords?: string | string[];
  Identifier?: string | number;
  StockTickers?: string | string[];
  NewsArchiveTags?: unknown;
  PdfDownloadUrl?: string;
  WidgetAttachment?: unknown;
  ISINs?: unknown;
  IsFullTextRss?: boolean;
  Logo?: unknown;
  OrgLogo?: unknown;
  OrgName?: string;
  RelatedLinks?: unknown;
  [key: string]: unknown;
};

export type SyncResult = {
  fetched: number;
  pages: number;
  upserted: number;
  removed: number;
  changed: boolean;
  collection: string;
  published: boolean;
  skipped?: boolean;
};
