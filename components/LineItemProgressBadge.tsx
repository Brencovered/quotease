"use client";

import {
  Package,
  Truck,
  Wrench,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { LineItemStatus } from "./JobLineItemsPanel";

type MiniItem = {
  status: LineItemStatus;
};

const STATUS_RANK: Record<LineItemStatus, number> = {
  not_started: 0,
  materials_ordered: 1,
  materials_sent_to_site: 2,
  installed: 3,
  complete: 4,
};

export default function LineItemProgressBadge({
  items,
  size = "sm",
}: {
  items: MiniItem[];
  size?: "sm" | "md";
}) {
  if (!items || items.length === 0) return null;

  const total = items.length;
  const complete = items.filter((i) => i.status === "complete").length;
  const allNotStarted = items.every((i) => i.status === "not_started");

  if (allNotStarted) return null;

  const pct = Math.round((complete / total) * 100);
  const iconSize = size === "sm" ? 10 : 12;

  return (
    <div className="inline-flex items-center gap-1 bg-[var(--app-bg)] rounded-full px-1.5 py-0.5">
      <div className="flex items-center -space-x-0.5">
        {items.slice(0, 4).map((item, i) => {
          const rank = STATUS_RANK[item.status];
          let Icon = Circle;
          let color = "var(--ink-faint)";
          if (rank >= 4) {
            Icon = CheckCircle2;
            color = "var(--green)";
          } else if (rank >= 3) {
            Icon = Wrench;
            color = "var(--navy)";
          } else if (rank >= 2) {
            Icon = Truck;
            color = "var(--blue)";
          } else if (rank >= 1) {
            Icon = Package;
            color = "var(--amber)";
          }
          return <Icon key={i} size={iconSize} style={{ color }} />;
        })}
        {items.length > 4 && (
          <span className="text-[9px] text-[var(--ink-faint)] ml-0.5">
            +{items.length - 4}
          </span>
        )}
      </div>
      <div
        className="h-1 rounded-full bg-[var(--line)]"
        style={{ width: size === "sm" ? 20 : 28 }}
      >
        <div
          className="h-full bg-[var(--green)] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] font-bold text-[var(--ink-faint)]">
        {pct}%
      </span>
    </div>
  );
}
