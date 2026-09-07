"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Flame, Thermometer, Snowflake } from "lucide-react";
import {
  PRIORITY_HINT,
  PRIORITY_LABEL,
  PIPELINE_LABEL,
  type DirectoryLeadSummary,
  type LeadPriority,
  type LeadPipelineStatus,
} from "@/lib/directoryLeads";

const TEMP_ICON: Record<LeadPriority, { Icon: typeof Flame; color: string }> = {
  hot: { Icon: Flame, color: "text-[var(--red)]" },
  warm: { Icon: Thermometer, color: "text-[var(--amber-deep)]" },
  cold: { Icon: Snowflake, color: "text-[var(--blue)]" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DirectoryLeadsPanel({
  rows,
  mode,
}: {
  rows: DirectoryLeadSummary[];
  mode: "admin" | "owner";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | LeadPriority>("all");
  const [pipelineFilter, setPipelineFilter] = useState<"all" | LeadPipelineStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (pipelineFilter !== "all" && r.pipeline_status !== pipelineFilter) return false;
      if (!q) return true;
      return (
        (r.lead_code ?? "").toLowerCase().includes(q) ||
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.customer_email ?? "").toLowerCase().includes(q) ||
        (r.job_description ?? "").toLowerCase().includes(q) ||
        (r.business_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, priorityFilter, pipelineFilter]);

  const stats = useMemo(() => {
    const byPriority: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    const byPipeline: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byBudget: Record<string, number> = {};
    for (const r of rows) {
      if (r.priority) byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
      byPipeline[r.pipeline_status] = (byPipeline[r.pipeline_status] ?? 0) + 1;
      const t = r.customer_type || "Unspecified";
      byType[t] = (byType[t] ?? 0) + 1;
      const b = r.budget || "Not sure";
      byBudget[b] = (byBudget[b] ?? 0) + 1;
    }
    return { byPriority, byPipeline, byType, byBudget };
  }, [rows]);

  function startQuote(id: string) {
    // Open the normal /quote wizard with this lead prefilled - do not
    // create an empty draft and dump onto the finished-quote page.
    router.push(`/quote?enquiry_id=${encodeURIComponent(id)}`);
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">
            {mode === "admin" ? "Directory leads" : "Leads"}
          </h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
            {rows.length} lead{rows.length !== 1 ? "s" : ""} from directory quote requests
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, name, job…"
              className="app-field pl-8 py-1.5 text-[13px] w-56"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as "all" | LeadPriority)}
            className="app-field py-1.5 text-[13px] w-auto"
          >
            <option value="all">All priorities</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value as "all" | LeadPipelineStatus)}
            className="app-field py-1.5 text-[13px] w-auto"
          >
            <option value="all">All stages</option>
            {(Object.keys(PIPELINE_LABEL) as LeadPipelineStatus[]).map((k) => (
              <option key={k} value={k}>
                {PIPELINE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compact report strip - not a dashboard wall */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {(["hot", "warm", "cold"] as LeadPriority[]).map((p) => {
          const { Icon, color } = TEMP_ICON[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(priorityFilter === p ? "all" : p)}
              className={`rounded-xl border px-3 py-2.5 text-left ${
                priorityFilter === p ? "border-[var(--navy)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              <p className={`text-[11px] font-bold uppercase tracking-wide flex items-center gap-1 ${color}`}>
                <Icon size={12} /> {PRIORITY_LABEL[p]}
              </p>
              <p className="font-display text-xl text-[var(--ink)]">{stats.byPriority[p] ?? 0}</p>
              <p className="text-[11px] text-[var(--ink-faint)]">{PRIORITY_HINT[p]}</p>
            </button>
          );
        })}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">Won</p>
          <p className="font-display text-xl text-[var(--ink)]">
            {(stats.byPipeline.quote_won ?? 0) + (stats.byPipeline.on_job ?? 0)}
          </p>
          <p className="text-[11px] text-[var(--ink-faint)]">Quote won / on job</p>
        </div>
      </div>

      {(Object.keys(stats.byBudget).length > 0 || Object.keys(stats.byType).length > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-faint)] mb-4">
          {Object.entries(stats.byType).map(([k, n]) => (
            <span key={k}>
              <span className="font-semibold text-[var(--ink-soft)]">{k}</span> {n}
            </span>
          ))}
          <span className="text-[var(--line)]">·</span>
          {Object.entries(stats.byBudget).map(([k, n]) => (
            <span key={k}>
              <span className="font-semibold text-[var(--ink-soft)]">{k}</span> {n}
            </span>
          ))}
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-[13.5px] text-[var(--ink-faint)]">
            No leads match that filter.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {filtered.map((r) => {
              const p = (r.priority ?? null) as LeadPriority | null;
              const temp = p ? TEMP_ICON[p] : null;
              const Icon = temp?.Icon;
              return (
                <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-[12px] font-bold text-[var(--ink-faint)]">
                        {r.lead_code ?? "-"}
                      </span>
                      {p && Icon && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${temp.color}`}>
                          <Icon size={12} /> {PRIORITY_LABEL[p]}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-[var(--ink-soft)]">
                        {PIPELINE_LABEL[r.pipeline_status] ?? r.pipeline_status}
                      </span>
                      {mode === "admin" && r.business_name && (
                        <span className="text-[11px] text-[var(--ink-faint)]">→ {r.business_name}</span>
                      )}
                    </div>
                    <p className="font-semibold text-[14px] text-[var(--ink)]">
                      {r.customer_name || "Unnamed"}
                      {r.customer_email ? (
                        <span className="font-normal text-[var(--ink-faint)]"> · {r.customer_email}</span>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-[var(--ink-soft)] mt-0.5 line-clamp-2">
                      {r.job_description}
                    </p>
                    {(r.other_quotes || r.notes || r.site_suburb) && (
                      <p className="text-[12px] text-[var(--ink-soft)] mt-1 line-clamp-2">
                        {[r.site_suburb, r.other_quotes, r.notes].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {r.photo_urls && r.photo_urls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r.photo_urls.map((photo) => (
                          <a
                            key={photo.path}
                            href={photo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
                          >
                            {photo.name}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-[11.5px] text-[var(--ink-faint)] mt-1">
                      {[r.customer_type, r.budget, r.photo_urls?.length ? `${r.photo_urls.length} file${r.photo_urls.length === 1 ? "" : "s"}` : null, fmtDate(r.created_at)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {mode === "owner" && !r.job_id && (r.pipeline_status === "new" || r.pipeline_status === "quoting") && (
                      <button
                        type="button"
                        onClick={() => startQuote(r.id)}
                        className="btn-primary text-[12px] py-1.5 px-3"
                      >
                        {r.quote_id ? "Continue quote" : "Start quote"}
                      </button>
                    )}
                    {r.quote_id && (
                      <Link href={`/quotes/${r.quote_id}`} className="btn-secondary text-[12px] py-1.5 px-3">
                        View quote
                      </Link>
                    )}
                    {r.job_id && (
                      <Link href={`/jobs/${r.job_id}`} className="btn-secondary text-[12px] py-1.5 px-3">
                        Open job
                      </Link>
                    )}
                    {r.customer_phone && (
                      <a href={`tel:${r.customer_phone.replace(/\s/g, "")}`} className="btn-secondary text-[12px] py-1.5 px-3">
                        Call
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
