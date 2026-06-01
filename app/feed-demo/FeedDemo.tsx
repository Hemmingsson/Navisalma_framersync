"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildFeedUrl } from "@/lib/rss/build-feed-url";
import {
  ATTACHMENT_TYPE_CODES,
  DATE_FORMAT_PRESETS,
  DEFAULT_FEED_SETTINGS,
  TARGET_LINK_OPTIONS,
  type FeedSettings,
  settingsFromSearchParams,
  settingsToSearchParams,
} from "@/lib/rss/feed-settings";
import { formatJsonCell, jsonFeedItemId, jsonFeedSummary } from "@/lib/rss/parse-json-feed";
import type { JsonFeedItem } from "@/lib/rss/types";
import styles from "./feed-demo.module.css";

const JSON_CRACK_WIDGET = "https://jsoncrack.com/widget";
const JSON_CRACK_EDITOR = "https://jsoncrack.com/editor";

type PreviewResponse = {
  ok: boolean;
  feedUrl: string;
  itemCount?: number | null;
  jsonItems?: JsonFeedItem[];
  parsed?: unknown;
  raw?: string;
  error?: string;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={styles.checkRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function JsonCrackEmbed({ feedUrl }: { feedUrl: string }) {
  const widgetSrc = `${JSON_CRACK_WIDGET}?json=${encodeURIComponent(feedUrl)}`;
  const editorHref = `${JSON_CRACK_EDITOR}?json=${encodeURIComponent(feedUrl)}`;

  return (
    <section className={styles.jsonCrackSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>JSON graph</h3>
          <p>
            Interactive tree via{" "}
            <a href="https://jsoncrack.com/" target="_blank" rel="noreferrer">
              JSON Crack
            </a>
            , loaded from the built JsonFeed URL.
          </p>
        </div>
        <a className={styles.externalLink} href={editorHref} target="_blank" rel="noreferrer">
          Open in JSON Crack ↗
        </a>
      </div>
      <iframe
        className={styles.jsonCrackFrame}
        src={widgetSrc}
        title="JSON Crack feed visualization"
        loading="lazy"
      />
    </section>
  );
}

const TABLE_COLUMNS: Array<{
  key: keyof JsonFeedItem | "summary";
  label: string;
  className?: string;
}> = [
  { key: "Title", label: "Title", className: styles.colTitle },
  { key: "ReleaseDateTime", label: "Published" },
  { key: "ModifiedDate", label: "Modified" },
  { key: "Subjects", label: "Subjects" },
  { key: "Language", label: "Language" },
  { key: "Keywords", label: "Keywords" },
  { key: "StockTickers", label: "Stock Tickers" },
  { key: "Identifier", label: "Identifier" },
  { key: "summary", label: "Summary", className: styles.colSummary },
  { key: "Url", label: "Url", className: styles.colUrl },
];

function JsonFeedTable({ items }: { items: JsonFeedItem[] }) {
  return (
    <section className={styles.tableSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Feed items</h3>
          <p>{items.length} release{items.length === 1 ? "" : "s"} from the JsonFeed response.</p>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {TABLE_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={jsonFeedItemId(item, index)}>
                {TABLE_COLUMNS.map((col) => {
                  if (col.key === "summary") {
                    return (
                      <td key={col.key} className={col.className}>
                        {jsonFeedSummary(item)}
                      </td>
                    );
                  }
                  if (col.key === "Url" && item.Url) {
                    return (
                      <td key={col.key} className={col.className}>
                        <a href={item.Url} target="_blank" rel="noreferrer">
                          Link
                        </a>
                      </td>
                    );
                  }
                  if (col.key === "Title" && item.Title) {
                    return (
                      <td key={col.key} className={col.className}>
                        {item.Url ? (
                          <a href={item.Url} target="_blank" rel="noreferrer">
                            {item.Title}
                          </a>
                        ) : (
                          item.Title
                        )}
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className={col.className}>
                      {formatJsonCell(item[col.key])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function FeedDemo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<FeedSettings>(DEFAULT_FEED_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [initialized, setInitialized] = useState(false);

  const feedUrl = useMemo(() => buildFeedUrl(settings), [settings]);

  const update = useCallback(<K extends keyof FeedSettings>(key: K, value: FeedSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fetchPreview = useCallback(async (nextSettings: FeedSettings) => {
    setLoading(true);
    setPreview(null);

    const params = settingsToSearchParams(nextSettings);
    try {
      const response = await fetch(`/api/feed-preview?${params.toString()}`);
      const data = (await response.json()) as PreviewResponse;
      setPreview(data);
    } catch (error) {
      setPreview({
        ok: false,
        feedUrl: buildFeedUrl(nextSettings),
        error: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = settingsFromSearchParams(new URLSearchParams(searchParams.toString()));
    setSettings(fromUrl);
    setInitialized(true);
    void fetchPreview(fromUrl);
  }, [searchParams, fetchPreview]);

  const applyAndFetch = () => {
    const params = settingsToSearchParams(settings);
    router.replace(`/feed-demo?${params.toString()}`);
  };

  const resetDefaults = () => {
    router.replace("/feed-demo");
  };

  if (!initialized) {
    return <div className={styles.feedDemo}>Loading…</div>;
  }

  return (
    <div className={styles.feedDemo}>
      <header className={styles.header}>
        <div>
          <h1>GlobeNewswire Feed Explorer</h1>
          <p>JsonFeed preview with JSON Crack graph and tabular item breakdown</p>
        </div>
        <div className={styles.headerLinks}>
          <a href="/">Home</a>
          <a href="/api/health">Health</a>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <section className={styles.section}>
            <h2>Organization</h2>
            <Field label="Organization token" hint="From Notified · Einride default pre-filled">
              <input
                value={settings.organizationToken}
                onChange={(e) => update("organizationToken", e.target.value)}
              />
            </Field>
          </section>

          <section className={styles.section}>
            <h2>Content body</h2>
            <Field label="Content type" hint="/content/* — production uses fulltext">
              <select
                value={settings.contentType}
                onChange={(e) => update("contentType", e.target.value as FeedSettings["contentType"])}
              >
                <option value="">Default (briefplain)</option>
                <option value="briefplain">briefplain</option>
                <option value="brief">brief</option>
                <option value="fulltext">fulltext</option>
                <option value="photo">photo</option>
              </select>
            </Field>
            <CheckField label="No links (/nolinks/true)" checked={settings.noLinks} onChange={(v) => update("noLinks", v)} />
          </section>

          <section className={styles.section}>
            <h2>Attachments</h2>
            <Field label="Attachment mode">
              <select
                value={settings.attachments}
                onChange={(e) => update("attachments", e.target.value as FeedSettings["attachments"])}
              >
                <option value="">Default (images)</option>
                <option value="images">images</option>
                <option value="all">all</option>
                <option value="none">none</option>
              </select>
            </Field>
            <Field label="Attachment types (/atttyp/)" hint="Comma-separated: REG, INR, ANR…">
              <input
                value={settings.attachmentTypes}
                onChange={(e) => update("attachmentTypes", e.target.value)}
                placeholder="ANR,INR"
              />
            </Field>
            <CheckField label="Auto PDF (/pdf/true)" checked={settings.pdf} onChange={(v) => update("pdf", v)} />
            <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              Codes: {ATTACHMENT_TYPE_CODES.map((t) => t.code).join(", ")}
            </small>
          </section>

          <section className={styles.section}>
            <h2>Metadata filters</h2>
            <Field label="Subjects (/subject/)" hint="Repeat for OR · e.g. ERN,DIV">
              <input value={settings.subjects} onChange={(e) => update("subjects", e.target.value)} placeholder="ERN" />
            </Field>
            <Field label="Subject codes (/subjectcode/)">
              <input value={settings.subjectCodes} onChange={(e) => update("subjectCodes", e.target.value)} />
            </Field>
            <Field label="Language (/language/)">
              <input value={settings.language} onChange={(e) => update("language", e.target.value)} placeholder="en" />
            </Field>
            <Field label="Keyword (/keyword/)">
              <input value={settings.keyword} onChange={(e) => update("keyword", e.target.value)} />
            </Field>
            <Field label="News archive tags (/newstag/)" hint="Comma-separated category codes">
              <input value={settings.newsTags} onChange={(e) => update("newsTags", e.target.value)} />
            </Field>
            <Field label="Full-text search (/search/)">
              <input value={settings.search} onChange={(e) => update("search", e.target.value)} />
            </Field>
          </section>

          <section className={styles.section}>
            <h2>Date &amp; paging</h2>
            <Field label="Start date (/startdate/)" hint="yyyymmdd">
              <input value={settings.startDate} onChange={(e) => update("startDate", e.target.value)} placeholder="20240101" />
            </Field>
            <Field label="End date (/enddate/)" hint="yyyymmdd">
              <input value={settings.endDate} onChange={(e) => update("endDate", e.target.value)} placeholder="20241231" />
            </Field>
            <Field label="Last modified days (/lastmod/)" hint="Delta sync — new + updated in N days">
              <input value={settings.lastModDays} onChange={(e) => update("lastModDays", e.target.value)} placeholder="3" />
            </Field>
            <Field label="Max items (/max/)" hint="Default 20 · max 50 recommended · hard cap 100">
              <input value={settings.max} onChange={(e) => update("max", e.target.value)} type="number" min={1} max={100} />
            </Field>
            <Field label="Start offset (/start/)" hint="Pagination · e.g. 0, 20, 40">
              <input value={settings.start} onChange={(e) => update("start", e.target.value)} type="number" min={0} />
            </Field>
            <Field label="Sort (/sort/)">
              <select value={settings.sort} onChange={(e) => update("sort", e.target.value as FeedSettings["sort"])}>
                <option value="desc">desc (newest first)</option>
                <option value="asc">asc</option>
                <option value="">none</option>
              </select>
            </Field>
            <CheckField label="Include total count (/count/true/)" checked={settings.count} onChange={(v) => update("count", v)} />
          </section>

          <section className={styles.section}>
            <h2>Formatting</h2>
            <Field label="Date format (?dateFormat=)">
              <select value={settings.dateFormat} onChange={(e) => update("dateFormat", e.target.value)}>
                {DATE_FORMAT_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Timezone (/timezone/)">
              <input
                value={settings.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                placeholder="Eastern Standard Time"
              />
            </Field>
            <Field label="Feed title (/feedtitle/)">
              <input value={settings.feedTitle} onChange={(e) => update("feedTitle", e.target.value)} />
            </Field>
            <Field label="Target link (/targetlink/)">
              <select value={settings.targetLink} onChange={(e) => update("targetLink", e.target.value)}>
                {TARGET_LINK_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <CheckField label="Show logo (/showlogo/true)" checked={settings.showLogo} onChange={(v) => update("showLogo", v)} />
            <CheckField label="Secure links (/secure/true)" checked={settings.secure} onChange={(v) => update("secure", v)} />
          </section>

          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading} onClick={applyAndFetch}>
              {loading ? "Fetching…" : "Apply & fetch feed"}
            </button>
            <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} disabled={loading} onClick={resetDefaults}>
              Reset to Einride defaults
            </button>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.urlBox}>
            <label>Built feed URL</label>
            <code>{feedUrl}</code>
          </div>

          {preview?.error ? <div className={styles.errorBox}>{preview.error}</div> : null}

          {preview ? (
            <>
              <div className={styles.statusBar}>
                <span className={`${styles.chip} ${preview.ok ? styles.chipOk : styles.chipErr}`}>
                  Status: <strong>{preview.ok ? "OK" : "Error"}</strong>
                </span>
                <span className={styles.chip}>
                  Format: <strong>JSON</strong>
                </span>
                <span className={`${styles.chip} ${preview.itemCount ? styles.chipOk : styles.chipWarn}`}>
                  Items: <strong>{preview.itemCount ?? 0}</strong>
                </span>
              </div>

              {preview.ok && preview.feedUrl ? (
                <>
                  <JsonCrackEmbed feedUrl={preview.feedUrl} />
                  {preview.jsonItems && preview.jsonItems.length > 0 ? (
                    <JsonFeedTable items={preview.jsonItems} />
                  ) : (
                    <div className={styles.empty}>
                      <p>
                        <strong>No items in this JsonFeed response.</strong>
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </>
          ) : loading ? (
            <div className={styles.empty}>Fetching feed from GlobeNewswire…</div>
          ) : (
            <div className={styles.empty}>Adjust settings and click Apply &amp; fetch feed.</div>
          )}
        </main>
      </div>
    </div>
  );
}
