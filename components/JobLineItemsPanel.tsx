"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Trash2,
  Package,
  Truck,
  Wrench,
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  GripVertical,
} from "lucide-react";

export type LineItemStatus =
  | "not_started"
  | "materials_ordered"
  | "materials_sent_to_site"
  | "installed"
  | "complete";

export type LineItem = {
  id: string;
  job_id: string;
  label: string;
  quantity: number;
  unit: string;
  status: LineItemStatus;
  sort_order: number;
  created_at: string;
};

const STATUS_FLOW: { key: LineItemStatus; label: string; icon: typeof Circle; color: string }[] = [
  { key: "not_started", label: "Not started", icon: Circle, color: "var(--ink-faint)" },
  { key: "materials_ordered", label: "Ordered", icon: Package, color: "var(--amber)" },
  { key: "materials_sent_to_site", label: "On site", icon: Truck, color: "var(--blue)" },
  { key: "installed", label: "Installed", icon: Wrench, color: "var(--navy)" },
  { key: "complete", label: "Done", icon: CheckCircle2, color: "var(--green)" },
];

const STATUS_COLORS: Record<LineItemStatus, { bg: string; text: string; border: string }> = {
  not_started: { bg: "var(--app-bg)", text: "var(--ink-faint)", border: "var(--line)" },
  materials_ordered: { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
  materials_sent_to_site: { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd" },
  installed: { bg: "#eef2ff", text: "#3730a3", border: "#a5b4fc" },
  complete: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
};

export default function JobLineItemsPanel({
  jobId,
  initialItems,
  scopeLines,
}: {
  jobId: string;
  initialItems: LineItem[];
  scopeLines: string[];
}) {
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnit, setNewUnit] = useState("ea");
  const [savingId, setSavingId] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    const res = await fetch(`/api/job-line-items?jobId=${jobId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, [jobId]);

  async function addItem() {
    if (!newLabel.trim()) return;
    setAdding(false);
    const label = newLabel.trim();
    const quantity = parseFloat(newQuantity) || 1;
    const res = await fetch("/api/job-line-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        label,
        quantity,
        unit: newUnit,
        sortOrder: items.length,
      }),
    });
    if (res.ok) {
      setNewLabel("");
      setNewQuantity("1");
      setNewUnit("ea");
      await refreshItems();
    }
  }

  async function deleteItem(id: string) {
    const res = await fetch(`/api/job-line-items/${id}`, { method: "DELETE" });
    if (res.ok) await refreshItems();
  }

  async function advanceStatus(id: string, currentStatus: LineItemStatus) {
    const idx = STATUS_FLOW.findIndex((s) => s.key === currentStatus);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)].key;
    await updateStatus(id, nextStatus);
  }

  async function updateStatus(id: string, status: LineItemStatus) {
    setSavingId(id);
    const res = await fetch(`/api/job-line-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSavingId(null);
    if (res.ok) await refreshItems();
  }

  function seedFromScope() {
    const unchecked = scopeLines.filter(
      (line) => !items.some((i) => i.label.toLowerCase() === line.toLowerCase())
    );
    unchecked.forEach((label, i) => {
      fetch("/api/job-line-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, label, quantity: 1, unit: "ea", sortOrder: items.length + i }),
      });
    });
    setTimeout(refreshItems, 300);
  }

  const totalCount = items.length;
  const completeCount = items.filter((i) => i.status === "complete").length;
  const progressPct = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="section-tag">Line items</p>
          <p className="font-semibold text-[var(--ink)]">Quote item progress</p>
        </div>
        <div className="text-right">
          {totalCount > 0 && (
            <span className="text-[12px] text-[var(--ink-faint)] font-semibold">
              {completeCount}/{totalCount} done
            </span>
          )}
        </div>
      </div>

      {/* Mini progress bar */}
      {totalCount > 0 && (
        <div className="w-full h-1.5 bg-[var(--app-bg)] rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-[var(--green)] rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Legend */}
      {totalCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {STATUS_FLOW.map((s) => {
            const count = items.filter((i) => i.status === s.key).length;
            if (count === 0) return null;
            return (
              <span
                key={s.key}
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: STATUS_COLORS[s.key].bg,
                  color: STATUS_COLORS[s.key].text,
                }}
              >
                <s.icon size={10} />
                {s.label} ({count})
              </span>
            );
          })}
        </div>
      )}

      {/* Seed from scope */}
      {totalCount === 0 && scopeLines.length > 0 && (
        <button
          onClick={seedFromScope}
          className="text-[12.5px] font-semibold text-[var(--navy)] mb-3 flex items-center gap-1"
        >
          <Plus size={14} /> Add {scopeLines.length} items from scope
        </button>
      )}

      {/* Item list */}
      <div className="space-y-1.5">
        {items.map((item) => {
          const statusIdx = STATUS_FLOW.findIndex((s) => s.key === item.status);
          const colors = STATUS_COLORS[item.status];
          return (
            <div
              key={item.id}
              className="group border rounded-lg p-2.5 transition-all"
              style={{
                borderColor: colors.border,
                background: colors.bg,
              }}
            >
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-[var(--ink-faint)] shrink-0 opacity-0 group-hover:opacity-50" />
                <span className="text-[13.5px] font-medium flex-1 min-w-0" style={{ color: colors.text }}>
                  {item.label}
                  <span className="text-[11px] opacity-60 ml-1">
                    ({item.quantity} {item.unit})
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Status stepper */}
                  <div className="flex items-center gap-0.5">
                    {STATUS_FLOW.map((s, i) => {
                      const Icon = s.icon;
                      const isActive = i <= statusIdx;
                      return (
                        <button
                          key={s.key}
                          onClick={() => updateStatus(item.id, s.key)}
                          disabled={savingId === item.id}
                          className="p-0.5 rounded transition-colors hover:scale-110"
                          title={s.label}
                        >
                          <Icon
                            size={14}
                            style={{
                              color: isActive ? s.color : "var(--line)",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <ChevronRight size={12} className="text-[var(--line)] mx-0.5" />
                  {/* Quick advance */}
                  {item.status !== "complete" && (
                    <button
                      onClick={() => advanceStatus(item.id, item.status)}
                      disabled={savingId === item.id}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/60 hover:bg-white text-[var(--ink-soft)] transition-colors"
                    >
                      Next
                    </button>
                  )}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-[var(--ink-faint)] hover:text-[var(--red)] p-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new */}
      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] mt-3"
        >
          <Plus size={14} /> Add item
        </button>
      ) : (
        <div className="mt-3 bg-[var(--app-bg)] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Item description"
              className="app-field text-[13px] flex-1"
              autoFocus
            />
            <input
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="app-field text-[13px] w-16"
              min="0"
              step="0.1"
            />
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="app-field text-[13px] w-16"
              placeholder="ea"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="btn-secondary text-[12px] flex-1 py-1.5">
              <X size={12} /> Cancel
            </button>
            <button onClick={addItem} disabled={!newLabel.trim()} className="btn-primary text-[12px] flex-1 py-1.5">
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
