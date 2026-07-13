"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Clock, DollarSign, FileClock, Mail, CheckCircle2, ChevronDown } from "lucide-react";
import type { AttentionItem, AttentionItemType } from "@/lib/attentionItems";

const ICONS: Record<AttentionItemType, typeof AlertTriangle> = {
  quote_follow_up: Mail,
  quote_expired: AlertTriangle,
  job_stalled: Clock,
  invoice_overdue: DollarSign,
  timesheet_missing: FileClock,
};

const COLLAPSED_LIMIT = 5;

export default function AttentionCard({ items }: { items: AttentionItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <div className="card mb-6 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-[var(--green)] shrink-0" />
        <p className="text-[13px] text-[var(--ink-soft)]">
          Nothing needs your attention right now - quotes, jobs, invoices and timesheets are all up to date.
        </p>
      </div>
    );
  }

  const visible = expanded ? items : items.slice(0, COLLAPSED_LIMIT);
  const highCount = items.filter((i) => i.severity === "high").length;

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className="text-amber-600" />
        <h2 className="font-bold text-[16px] text-[var(--ink)]">Needs your attention</h2>
        <span className="text-[11px] font-bold text-[var(--ink-faint)] bg-[var(--app-bg)] rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>
      {highCount > 0 && (
        <p className="text-[12px] text-amber-700 mb-3">{highCount} of these are more overdue than the rest - worth starting there.</p>
      )}
      <div className="flex flex-col gap-2 mt-2">
        {visible.map((item) => {
          const Icon = ICONS[item.type];
          const isHigh = item.severity === "high";
          return (
            <Link
              key={item.id}
              prefetch={false}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
                isHigh
                  ? "bg-red-50 border-red-200 hover:border-red-300"
                  : "bg-amber-50 border-amber-200 hover:border-amber-300"
              }`}
            >
              <Icon size={16} className={`shrink-0 ${isHigh ? "text-[var(--red)]" : "text-amber-600"}`} />
              <div className="min-w-0">
                <p className={`text-[13px] font-bold truncate ${isHigh ? "text-[var(--red)]" : "text-amber-800"}`}>
                  {item.label}
                </p>
                <p className={`text-[11px] ${isHigh ? "text-red-600" : "text-amber-600"}`}>{item.sublabel}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {items.length > COLLAPSED_LIMIT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[12px] font-bold text-[var(--ink-faint)] mt-3 hover:text-[var(--ink)]"
        >
          {expanded ? "Show less" : `Show ${items.length - COLLAPSED_LIMIT} more`}
          <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
