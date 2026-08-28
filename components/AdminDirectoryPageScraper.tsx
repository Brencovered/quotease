"use client";

import { useState } from "react";
import { Globe, Loader2, AlertCircle, Check } from "lucide-react";

type Listing = {
  business_name: string;
  suburb: string | null;
  email: string | null;
  website_url: string | null;
  postcode?: string | null;
  state?: string | null;
  phone?: string | null;
};

type Preview = {
  source: string;
  query?: string | null;
  listings: Listing[];
  note?: string;
};

export function AdminDirectoryPageScraper() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scrape() {
    setBusy(true);
    setError(null);
    setPreview(null);
    setImportResult(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/scrape-directory-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scrape failed");
        return;
      }
      setPreview(data);
      setSelected(new Set(data.listings.map((_: Listing, i: number) => i)));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    if (!preview) return;
    const listings = preview.listings.filter((_, i) => selected.has(i));
    if (listings.length === 0) {
      setError("Select at least one listing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scrape-directory-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import", listings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setImportResult(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
      <h2 className="font-semibold text-[15px] text-[var(--ink)] mb-1 flex items-center gap-2">
        <Globe className="w-4 h-4 text-[var(--amber)]" /> Directory page scraper
      </h2>
      <p className="text-[12.5px] text-[var(--ink-soft)] mb-4">
        Paste a Google Maps, Google Search, or Yellow Pages results URL. Google pages cannot
        be read directly, so we look the same search up on Yellow Pages (Places is skipped
        when that Google Cloud project has billing off). Preview first, then import. Nothing
        is saved until you confirm.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.yellowpages.com.au/search/listings?clue=plumber&locationClue=Newtown"
          className="app-field flex-1 min-w-0 py-2.5 text-[14px]"
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() => void scrape()}
          className="btn-primary disabled:opacity-40 whitespace-nowrap"
        >
          {busy && !preview ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scraping...</>
          ) : (
            "Scrape page"
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[13px] text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-3">
          <p className="text-[13px] text-[var(--ink-soft)]">
            Source: <span className="font-medium text-[var(--ink)]">{preview.source}</span>
            {preview.query ? ` · ${preview.query}` : ""}
            {" · "}
            {preview.listings.length} listing{preview.listings.length === 1 ? "" : "s"}
          </p>
          {preview.note && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
              {preview.note}
            </p>
          )}

          {preview.listings.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead className="bg-[var(--app-bg)] text-[var(--ink-faint)] text-[11.5px] font-semibold uppercase tracking-wide">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={
                            preview.listings.length > 0 &&
                            selected.size === preview.listings.length
                          }
                          onChange={() =>
                            setSelected(
                              selected.size === preview.listings.length
                                ? new Set()
                                : new Set(preview.listings.map((_, i) => i)),
                            )
                          }
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Suburb</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Website</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {preview.listings.map((row, i) => (
                      <tr key={`${row.business_name}-${i}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggle(i)}
                            aria-label={`Select ${row.business_name}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--ink)]">{row.business_name}</td>
                        <td className="px-3 py-2 text-[var(--ink-soft)]">{row.suburb || "-"}</td>
                        <td className="px-3 py-2 text-[var(--ink-soft)]">{row.email || "-"}</td>
                        <td className="max-w-[220px] truncate px-3 py-2">
                          {row.website_url ? (
                            <a
                              href={row.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--navy)] underline"
                            >
                              {row.website_url.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => void importSelected()}
                className="btn-primary disabled:opacity-40"
              >
                {busy && preview ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  `Import ${selected.size} selected`
                )}
              </button>
            </>
          )}
        </div>
      )}

      {importResult && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3.5 py-2.5 text-[13px] text-green-900">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Imported {importResult.inserted}, skipped {importResult.skipped} already in the
            directory.
            {importResult.errors.length > 0 && (
              <>
                {" "}
                {importResult.errors.length} failed: {importResult.errors.slice(0, 3).join("; ")}
              </>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
