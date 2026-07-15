"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Repeat, Settings2, Plus, Trash2, X, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import LineItemProgressBadge from "./LineItemProgressBadge";
import type { LineItemStatus } from "./JobLineItemsPanel";

export type BoardJob = {
  id: string;
  job_number: number;
  client_name: string | null;
  site_address: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  status: string;
  source: string;
  scheduled_date: string | null;
  scheduled_start: string | null;
};

export type BoardColumn = {
  id: string;
  label: string;
  color: string;
  statuses: string[];
  sort_order: number;
};

export const ALL_JOB_STATUSES = [
  "scheduled", "in_progress", "on_hold", "awaiting_sign_off",
  "complete", "invoiced", "partially_paid", "archived", "cancelled",
];

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled", in_progress: "In progress", on_hold: "On hold",
  awaiting_sign_off: "Awaiting sign-off", complete: "Complete", invoiced: "Invoiced",
  partially_paid: "Partially paid", archived: "Archived", cancelled: "Cancelled",
};

const COLOR_OPTIONS = ["navy", "amber", "green", "blue", "red", "gray", "teal"] as const;

const COLOR_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  navy: { bg: "var(--navy)", text: "#ffffff", dot: "var(--navy)" },
  amber: { bg: "var(--amber-light)", text: "var(--amber-deep)", dot: "var(--amber)" },
  green: { bg: "var(--green-bg)", text: "var(--green)", dot: "var(--green)" },
  blue: { bg: "var(--blue-bg)", text: "var(--blue)", dot: "var(--blue)" },
  red: { bg: "var(--red-bg)", text: "var(--red)", dot: "var(--red)" },
  gray: { bg: "var(--app-bg)", text: "var(--ink-soft)", dot: "var(--ink-faint)" },
  teal: { bg: "#e6faf6", text: "#0f766e", dot: "#14b8a6" },
};

const ARCHIVE_STATUSES = ["archived", "cancelled"];

type LineItemsMap = Record<string, { status: LineItemStatus }[]>;

export default function JobsKanbanBoard({ jobs: initialJobs, columns: initialColumns }: { jobs: BoardJob[]; columns: BoardColumn[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [columns, setColumns] = useState(initialColumns);
  const [dragId, setDragId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [lineItemsMap, setLineItemsMap] = useState<LineItemsMap>({});

  useEffect(() => {
    const visibleJobIds = jobs.filter((j) => !ARCHIVE_STATUSES.includes(j.status)).map((j) => j.id);
    if (visibleJobIds.length === 0) return;
    let cancelled = false;
    async function loadLineItems() {
      const results: LineItemsMap = {};
      await Promise.all(
        visibleJobIds.map(async (jobId) => {
          try {
            const res = await fetch(`/api/job-line-items?jobId=${jobId}`);
            if (res.ok) {
              const data = await res.json();
              results[jobId] = (data.items ?? []).map((item: { status: LineItemStatus }) => ({ status: item.status }));
            }
          } catch { /* skip */ }
        })
      );
      if (!cancelled) setLineItemsMap(results);
    }
    loadLineItems();
    return () => { cancelled = true; };
  }, [jobs]);

  const visibleColumns = columns.filter((c) => !c.statuses.every((s) => ARCHIVE_STATUSES.includes(s)));
  const archivedCount = jobs.filter((j) => ARCHIVE_STATUSES.includes(j.status)).length;

  async function setStatus(jobId: string, status: string) {
    setBusyId(jobId);
    setMenuId(null);
    const prev = jobs;
    setJobs((cur) => cur.map((j) => (j.id === jobId ? { ...j, status } : j)));
    const res = await fetch("/api/jobs/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
    setBusyId(null);
    if (!res.ok) setJobs(prev);
    else router.refresh();
  }

  function onDrop(column: BoardColumn) {
    if (!dragId) return;
    const target = column.statuses[0];
    if (target) setStatus(dragId, target);
    setDragId(null);
  }

  async function saveColumns(next: BoardColumn[]) {
    setColumns(next);
    await fetch("/api/jobs/board-columns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: next.map((c) => ({ label: c.label, color: c.color, statuses: c.statuses })) }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)]">
          <Settings2 size={14} /> Customize board
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {visibleColumns.map((col) => {
          const style = COLOR_STYLES[col.color] ?? COLOR_STYLES.gray;
          const colJobs = jobs.filter((j) => col.statuses.includes(j.status));
          const colTotal = colJobs.reduce((s, j) => s + (j.total_cost ?? 0), 0);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col)}
              className="bg-[var(--app-bg)] rounded-xl p-2.5 shrink-0 w-[260px] min-h-[120px]"
            >
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide px-2 py-1 rounded-full" style={{ background: style.bg, color: style.text }}>
                  {col.label}
                </span>
                <span className="text-[11px] text-[var(--ink-faint)] font-semibold">{colJobs.length}</span>
              </div>
              {colJobs.length > 0 && (
                <p className="text-[11px] text-[var(--ink-faint)] px-1 mb-2">${colTotal.toLocaleString()}</p>
              )}
              <div className="space-y-2">
                {colJobs.map((j) => {
                  const isPrimary = j.status === col.statuses[0];
                  const subBadge = !isPrimary ? STATUS_LABELS[j.status] : null;
                  const lineItems = lineItemsMap[j.id] ?? [];
                  return (
                    <div
                      key={j.id}
                      draggable
                      onDragStart={() => setDragId(j.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`bg-white rounded-lg border border-[var(--line)] p-2.5 cursor-grab active:cursor-grabbing transition-opacity ${busyId === j.id ? "opacity-50" : ""}`}
                      style={{ borderLeft: `3px solid ${style.dot}` }}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-[var(--ink)] truncate">{j.client_name || "Unnamed client"}</p>
                          <p className="text-[11px] text-[var(--ink-faint)]">Job #{j.job_number}</p>
                        </Link>
                        <div className="relative shrink-0">
                          <button onClick={() => setMenuId(menuId === j.id ? null : j.id)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] p-0.5">
                            <MoreVertical size={14} />
                          </button>
                          {menuId === j.id && (
                            <div className="absolute right-0 top-6 z-10 bg-white border border-[var(--line)] rounded-lg shadow-lg py-1 w-48 text-[12.5px] max-h-64 overflow-y-auto">
                              {columns.map((c) => (
                                <div key={c.id}>
                                  <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase text-[var(--ink-faint)]">{c.label}</p>
                                  {c.statuses.map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => setStatus(j.id, s)}
                                      className={`block w-full text-left px-3 py-1.5 hover:bg-[var(--app-bg)] ${j.status === s ? "font-bold text-[var(--navy)]" : "text-[var(--ink-soft)]"}`}
                                    >
                                      {STATUS_LABELS[s] ?? s}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {j.site_address && <p className="text-[11px] text-[var(--ink-faint)] truncate mb-1">{j.site_address}</p>}
                      {lineItems.length > 0 && (
                        <div className="mb-1.5">
                          <LineItemProgressBadge items={lineItems} size="sm" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-[var(--ink)]">${(j.total_cost ?? 0).toLocaleString()}</p>
                        {j.source !== "quote" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--amber-light)] text-[var(--amber-deep)] font-bold uppercase">
                            {j.source === "recurring" ? <Repeat size={10} className="inline -mt-0.5" /> : "quick"}
                          </span>
                        )}
                      </div>
                      {subBadge && (
                        <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: style.bg, color: style.text }}>{subBadge}</span>
                      )}
                    </div>
                  );
                })}
                {colJobs.length === 0 && <p className="text-[12px] text-[var(--ink-faint)] px-1 py-3 text-center">No jobs</p>}
              </div>
            </div>
          );
        })}
      </div>

      {archivedCount > 0 && (
        <button onClick={() => setShowArchived((v) => !v)} className="text-[12.5px] font-semibold text-[var(--navy)] mt-1">
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </button>
      )}

      {showArchived && (
        <div className="mt-3 space-y-2">
          {jobs.filter((j) => ARCHIVE_STATUSES.includes(j.status)).map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="card flex items-center justify-between gap-3 opacity-70 hover:opacity-100">
              <p className="text-[13px] text-[var(--ink)]">{j.client_name || "Unnamed client"} <span className="text-[var(--ink-faint)]">Job #{j.job_number}</span></p>
              <span className="text-[11px] text-[var(--ink-faint)] uppercase font-bold">{j.status}</span>
            </Link>
          ))}
        </div>
      )}

      {editing && <BoardEditor columns={columns} onClose={() => setEditing(false)} onSave={saveColumns} />}
    </div>
  );
}

function BoardEditor({ columns, onClose, onSave }: { columns: BoardColumn[]; onClose: () => void; onSave: (cols: BoardColumn[]) => void }) {
  const [draft, setDraft] = useState<BoardColumn[]>(columns.map((c) => ({ ...c, statuses: [...c.statuses] })));

  function assignedElsewhere(status: string, exceptColId: string) {
    return draft.some((c) => c.id !== exceptColId && c.statuses.includes(status));
  }

  function toggleStatus(colId: string, status: string) {
    setDraft((cur) =>
      cur.map((c) => {
        if (c.id === colId) {
          const has = c.statuses.includes(status);
          return { ...c, statuses: has ? c.statuses.filter((s) => s !== status) : [...c.statuses, status] };
        }
        if (c.statuses.includes(status)) {
          return { ...c, statuses: c.statuses.filter((s) => s !== status) };
        }
        return c;
      })
    );
  }

  function updateLabel(colId: string, label: string) {
    setDraft((cur) => cur.map((c) => (c.id === colId ? { ...c, label } : c)));
  }
  function updateColor(colId: string, color: string) {
    setDraft((cur) => cur.map((c) => (c.id === colId ? { ...c, color } : c)));
  }
  function addColumn() {
    setDraft((cur) => [...cur, { id: `new-${Date.now()}`, label: "New column", color: "gray", statuses: [], sort_order: cur.length }]);
  }
  function removeColumn(colId: string) {
    setDraft((cur) => cur.filter((c) => c.id !== colId));
  }
  function move(colId: string, dir: -1 | 1) {
    setDraft((cur) => {
      const i = cur.findIndex((c) => c.id === colId);
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const unassigned = ALL_JOB_STATUSES.filter((s) => !draft.some((c) => c.statuses.includes(s)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[19px] text-[var(--ink)]">Customize board</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="space-y-3 mb-4">
          {draft.map((col, i) => {
            const style = COLOR_STYLES[col.color] ?? COLOR_STYLES.gray;
            return (
              <div key={col.id} className="border border-[var(--line)] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical size={14} className="text-[var(--ink-faint)] shrink-0" />
                  <input value={col.label} onChange={(e) => updateLabel(col.id, e.target.value)} className="app-field text-[13.5px] py-1.5 flex-1" />
                  <div className="flex flex-col">
                    <button onClick={() => move(col.id, -1)} disabled={i === 0} className="text-[var(--ink-faint)] disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => move(col.id, 1)} disabled={i === draft.length - 1} className="text-[var(--ink-faint)] disabled:opacity-30"><ChevronDown size={14} /></button>
                  </div>
                  <button onClick={() => removeColumn(col.id)} className="text-[var(--ink-faint)] hover:text-[var(--red)]"><Trash2 size={14} /></button>
                </div>
                <div className="flex gap-1.5 mb-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateColor(col.id, c)}
                      className={`w-6 h-6 rounded-full border-2 ${col.color === c ? "border-[var(--ink)]" : "border-transparent"}`}
                      style={{ background: COLOR_STYLES[c].dot }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_JOB_STATUSES.map((s) => {
                    const active = col.statuses.includes(s);
                    const disabled = !active && assignedElsewhere(s, col.id);
                    return (
                      <button
                        key={s}
                        disabled={disabled}
                        onClick={() => toggleStatus(col.id, s)}
                        className="text-[11px] px-2 py-1 rounded-full font-semibold disabled:opacity-30"
                        style={active ? { background: style.bg, color: style.text } : { background: "var(--app-bg)", color: "var(--ink-faint)" }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {unassigned.length > 0 && (
          <p className="text-[12px] text-[var(--red)] mb-3">Not shown on any column: {unassigned.map((s) => STATUS_LABELS[s]).join(", ")}. Jobs in these stages won&apos;t appear on the board.</p>
        )}

        <button onClick={addColumn} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] mb-4">
          <Plus size={14} /> Add column
        </button>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => { onSave(draft); onClose(); }} className="btn-primary flex-1">Save board</button>
        </div>
      </div>
    </div>
  );
}
