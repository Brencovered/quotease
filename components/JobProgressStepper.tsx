"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import type { BoardColumn } from "./JobsKanbanBoard";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled", in_progress: "In progress", on_hold: "On hold",
  awaiting_sign_off: "Awaiting sign-off", complete: "Complete", invoiced: "Invoiced",
  partially_paid: "Partially paid", archived: "Archived", cancelled: "Cancelled",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

const COLOR_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  navy: { bg: "var(--navy)", text: "#ffffff", dot: "var(--navy)" },
  amber: { bg: "var(--amber-light)", text: "var(--amber-deep)", dot: "var(--amber)" },
  green: { bg: "var(--green-bg)", text: "var(--green)", dot: "var(--green)" },
  blue: { bg: "var(--blue-bg)", text: "var(--blue)", dot: "var(--blue)" },
  red: { bg: "var(--red-bg)", text: "var(--red)", dot: "var(--red)" },
  gray: { bg: "var(--app-bg)", text: "var(--ink-soft)", dot: "var(--ink-faint)" },
  teal: { bg: "#e6faf6", text: "#0f766e", dot: "#14b8a6" },
};

export default function JobProgressStepper({ jobId, status, columns }: { jobId: string; status: string; columns: BoardColumn[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeColIndex = columns.findIndex((c) => c.statuses.includes(current));

  async function setStatus(next: string) {
    setSaving(true);
    setMenuOpen(false);
    const prev = current;
    setCurrent(next);
    const res = await fetch("/api/jobs/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: next }),
    });
    setSaving(false);
    if (!res.ok) setCurrent(prev);
    else router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-tag">Job progress</p>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} disabled={saving} className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)]">
            Change status <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-10 bg-white border border-[var(--line)] rounded-lg shadow-lg py-1 w-48 text-[12.5px] max-h-72 overflow-y-auto">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`block w-full text-left px-3 py-1.5 hover:bg-[var(--app-bg)] ${current === s ? "font-bold text-[var(--navy)]" : "text-[var(--ink-soft)]"}`}
                >
                  {STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center">
        {columns.map((col, i) => {
          const style = COLOR_STYLES[col.color] ?? COLOR_STYLES.gray;
          const isActive = i === activeColIndex;
          const isPast = activeColIndex >= 0 && i < activeColIndex;
          const subLabel = isActive && col.statuses[0] !== current ? STATUS_LABELS[current] : null;
          return (
            <div key={col.id} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => setStatus(col.statuses[0])}
                disabled={saving}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
                  style={{
                    background: isActive || isPast ? style.dot : "var(--surface)",
                    borderColor: style.dot,
                  }}
                >
                  {isPast ? <Check size={15} color="white" /> : <span className="w-2 h-2 rounded-full" style={{ background: isActive ? "white" : style.dot }} />}
                </span>
                <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: isActive ? style.text : "var(--ink-faint)" }}>
                  {col.label}
                  {subLabel && <span className="block text-[10px] font-bold uppercase">{subLabel}</span>}
                </span>
              </button>
              {i < columns.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 mb-4" style={{ background: isPast ? (COLOR_STYLES[col.color] ?? COLOR_STYLES.gray).dot : "var(--line)" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
