"use client";

import { Flame, Thermometer, Snowflake } from "lucide-react";
import {
  PRIORITY_HINT,
  PRIORITY_LABEL,
  PIPELINE_LABEL,
  type LeadPriority,
  type LeadPipelineStatus,
} from "@/lib/directoryLeads";

const TEMP: Record<LeadPriority, { Icon: typeof Flame; className: string }> = {
  hot: { Icon: Flame, className: "text-[var(--red)] bg-red-50 border-red-100" },
  warm: { Icon: Thermometer, className: "text-[var(--amber-deep)] bg-amber-50 border-amber-100" },
  cold: { Icon: Snowflake, className: "text-[var(--blue)] bg-blue-50 border-blue-100" },
};

export default function LeadOriginBadge({
  leadCode,
  priority,
  pipelineStatus,
  budget,
  customerType,
  compact = false,
}: {
  leadCode: string | null;
  priority: LeadPriority | null;
  pipelineStatus?: LeadPipelineStatus | null;
  budget?: string | null;
  customerType?: string | null;
  compact?: boolean;
}) {
  if (!leadCode && !priority) return null;
  const temp = priority ? TEMP[priority] : null;
  const Icon = temp?.Icon;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
        {leadCode && <span className="text-[var(--ink-faint)]">{leadCode}</span>}
        {priority && Icon && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${temp.className}`}>
            <Icon size={11} />
            {PRIORITY_LABEL[priority]}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="card !p-3">
      <p className="section-tag mb-2">Directory lead</p>
      <div className="flex flex-wrap items-center gap-2">
        {leadCode && (
          <span className="font-mono text-[13px] font-bold text-[var(--ink)]">{leadCode}</span>
        )}
        {priority && Icon && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${temp.className}`}>
            <Icon size={12} />
            {PRIORITY_LABEL[priority]}
          </span>
        )}
        {pipelineStatus && (
          <span className="text-[11px] font-semibold text-[var(--ink-soft)]">
            {PIPELINE_LABEL[pipelineStatus]}
          </span>
        )}
      </div>
      {priority && (
        <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">{PRIORITY_HINT[priority]}</p>
      )}
      {(budget || customerType) && (
        <p className="text-[12px] text-[var(--ink-soft)] mt-1">
          {[customerType, budget].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
