"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import JobsKanbanBoard, { type BoardJob, type BoardColumn } from "@/components/JobsKanbanBoard";
import QuickJobsPanel from "@/components/QuickJobsPanel";
import JobsPanel from "@/components/JobsPanel";

export default function JobsPageClient({
  boardJobs,
  quickJobs,
  listJobs,
  teamMembers,
  boardColumns,
  canSeePricing = true,
}: {
  boardJobs: BoardJob[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quickJobs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listJobs: any[];
  teamMembers: Array<{ id: string; name: string | null; email: string }>;
  boardColumns: BoardColumn[];
  /** Site members never see pricing anywhere - hides $ figures on the board and removes the invoicing-focused List view entirely. */
  canSeePricing?: boolean;
}) {
  const [view, setView] = useState<"board" | "list">("board");

  const toggle = canSeePricing ? (
    <div className="inline-flex rounded-xl border-2 border-[var(--line)] p-0.5">
      <button
        onClick={() => setView("board")}
        className={`flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg ${view === "board" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-faint)]"}`}
      >
        <LayoutGrid size={14} /> Board
      </button>
      <button
        onClick={() => setView("list")}
        className={`flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg ${view === "list" ? "bg-[var(--navy)] text-white" : "text-[var(--ink-faint)]"}`}
      >
        <List size={14} /> List &amp; invoicing
      </button>
    </div>
  ) : null;

  if (view === "list" && canSeePricing) {
    return (
      <div>
        <div className="page-wrap pb-0">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-display text-[28px] text-[var(--ink)]">Jobs</h1>
            {toggle}
          </div>
        </div>
        <JobsPanel jobs={listJobs} />
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Jobs</h1>
        {toggle}
      </div>
      <QuickJobsPanel jobs={quickJobs} teamMembers={teamMembers} />
      <JobsKanbanBoard jobs={boardJobs} columns={boardColumns} canSeePricing={canSeePricing} />
    </div>
  );
}
