"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Repeat } from "lucide-react";

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

type ColumnDef = { key: string; label: string; matches: string[]; subStatus?: { value: string; label: string } };

const COLUMNS: ColumnDef[] = [
  { key: "scheduled", label: "Scheduled", matches: ["scheduled"] },
  { key: "in_progress", label: "In progress", matches: ["in_progress", "on_hold"], subStatus: { value: "on_hold", label: "On hold" } },
  { key: "complete", label: "Complete", matches: ["complete", "awaiting_sign_off"], subStatus: { value: "awaiting_sign_off", label: "Awaiting sign-off" } },
  { key: "invoiced", label: "Invoiced", matches: ["invoiced", "partially_paid"], subStatus: { value: "partially_paid", label: "Partially paid" } },
];

const ARCHIVE_STATUSES = ["archived", "cancelled"];

// Each column's card drop target sets the job to this primary status.
const COLUMN_PRIMARY_STATUS: Record<string, string> = {
  scheduled: "scheduled",
  in_progress: "in_progress",
  complete: "complete",
  invoiced: "invoiced",
};

export default function JobsKanbanBoard({ jobs: initialJobs }: { jobs: BoardJob[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [dragId, setDragId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    if (!res.ok) {
      setJobs(prev);
    } else {
      router.refresh();
    }
  }

  function onDrop(columnKey: string) {
    if (!dragId) return;
    const target = COLUMN_PRIMARY_STATUS[columnKey];
    if (target) setStatus(dragId, target);
    setDragId(null);
  }

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => col.matches.includes(j.status));
          const colTotal = colJobs.reduce((s, j) => s + (j.total_cost ?? 0), 0);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col.key)}
              className="bg-[var(--app-bg)] rounded-xl p-2.5 shrink-0 w-[260px] min-h-[120px]"
            >
              <div className="flex items-center justify-between mb-2.5 px-1">
                <p className="text-[12px] font-bold text-[var(--ink)] uppercase tracking-wide">{col.label}</p>
                <span className="text-[11px] text-[var(--ink-faint)] font-semibold">{colJobs.length}</span>
              </div>
              {colJobs.length > 0 && (
                <p className="text-[11px] text-[var(--ink-faint)] px-1 mb-2 -mt-1.5">${colTotal.toLocaleString()}</p>
              )}
              <div className="space-y-2">
                {colJobs.map((j) => {
                  const subBadge = col.subStatus && j.status === col.subStatus.value ? col.subStatus.label : null;
                  return (
                    <div
                      key={j.id}
                      draggable
                      onDragStart={() => setDragId(j.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`bg-[var(--surface,white)] bg-white rounded-lg border border-[var(--line)] p-2.5 cursor-grab active:cursor-grabbing ${busyId === j.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <Link href={`/electrician/jobs/${j.id}`} className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-[var(--ink)] truncate">{j.client_name || "Unnamed client"}</p>
                          <p className="text-[11px] text-[var(--ink-faint)]">Job #{j.job_number}</p>
                        </Link>
                        <div className="relative shrink-0">
                          <button onClick={() => setMenuId(menuId === j.id ? null : j.id)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] p-0.5">
                            <MoreVertical size={14} />
                          </button>
                          {menuId === j.id && (
                            <div className="absolute right-0 top-6 z-10 bg-white border border-[var(--line)] rounded-lg shadow-lg py-1 w-44 text-[12.5px]">
                              {["scheduled", "in_progress", "on_hold", "awaiting_sign_off", "complete", "invoiced", "partially_paid", "archived", "cancelled"].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setStatus(j.id, s)}
                                  className={`block w-full text-left px-3 py-1.5 hover:bg-[var(--app-bg)] ${j.status === s ? "font-bold text-[var(--navy)]" : "text-[var(--ink-soft)]"}`}
                                >
                                  {s.replace(/_/g, " ")}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {j.site_address && <p className="text-[11px] text-[var(--ink-faint)] truncate mb-1">{j.site_address}</p>}
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-[var(--ink)]">${(j.total_cost ?? 0).toLocaleString()}</p>
                        {j.source !== "quote" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--amber-light)] text-[var(--amber-deep)] font-bold uppercase">
                            {j.source === "recurring" ? <Repeat size={10} className="inline -mt-0.5" /> : "quick"}
                          </span>
                        )}
                      </div>
                      {subBadge && (
                        <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold uppercase">{subBadge}</span>
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
            <Link key={j.id} href={`/electrician/jobs/${j.id}`} className="card flex items-center justify-between gap-3 opacity-70 hover:opacity-100">
              <p className="text-[13px] text-[var(--ink)]">{j.client_name || "Unnamed client"} <span className="text-[var(--ink-faint)]">Job #{j.job_number}</span></p>
              <span className="text-[11px] text-[var(--ink-faint)] uppercase font-bold">{j.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
