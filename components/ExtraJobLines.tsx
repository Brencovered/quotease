"use client";

import { Plus, Trash2 } from "lucide-react";

export interface ExtraLine {
  id: string;
  label: string;
  hours: number;
  materialsCost: number;
  note: string;
}

export function emptyLine(): ExtraLine {
  return { id: `line_${Date.now()}_${Math.random()}`, label: "", hours: 0, materialsCost: 0, note: "" };
}

export function extraLinesTotals(lines: ExtraLine[], hourlyRate: number, marginPct: number) {
  const labour    = lines.reduce((s, l) => s + l.hours * hourlyRate, 0);
  const materials = lines.reduce((s, l) => s + l.materialsCost * (1 + marginPct / 100), 0);
  return { labour: Math.round(labour), materials: Math.round(materials), total: Math.round(labour + materials) };
}

export default function ExtraJobLines({
  lines, onChange, hourlyRate, marginPct,
}: {
  lines: ExtraLine[];
  onChange: (lines: ExtraLine[]) => void;
  hourlyRate: number;
  marginPct: number;
}) {
  function update(id: string, patch: Partial<ExtraLine>) {
    onChange(lines.map(l => l.id === id ? { ...l, ...patch } : l));
  }
  function remove(id: string) { onChange(lines.filter(l => l.id !== id)); }
  function add() { onChange([...lines, emptyLine()]); }

  if (lines.length === 0) {
    return (
      <button onClick={add}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-3 text-[13.5px] font-bold text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors">
        <Plus size={15} /> Add another job to this quote
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Additional jobs</p>
        <button onClick={add}
          className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--navy)] hover:opacity-70">
          <Plus size={13} /> Add another
        </button>
      </div>

      {lines.map((l, i) => {
        const lineLabour    = Math.round(l.hours * hourlyRate);
        const lineMaterials = Math.round(l.materialsCost * (1 + marginPct / 100));
        const lineTotal     = lineLabour + lineMaterials;
        return (
          <div key={l.id} className="bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Job {i + 2}</span>
              <button onClick={() => remove(l.id)} className="text-[var(--red)] p-1"><Trash2 size={13} /></button>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">What needs doing</label>
              <input
                value={l.label}
                onChange={e => update(l.id, { label: e.target.value })}
                className="app-field text-[13.5px]"
                placeholder="e.g. Replace hot water unit, fix leaking taps"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Labour (hours)</label>
                <input
                  type="number" min={0} step={0.5}
                  value={l.hours || ""}
                  onChange={e => update(l.id, { hours: parseFloat(e.target.value) || 0 })}
                  className="app-field text-[13.5px]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Materials cost ($)</label>
                <input
                  type="number" min={0} step={10}
                  value={l.materialsCost || ""}
                  onChange={e => update(l.id, { materialsCost: parseFloat(e.target.value) || 0 })}
                  className="app-field text-[13.5px]"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Notes (optional)</label>
              <input
                value={l.note}
                onChange={e => update(l.id, { note: e.target.value })}
                className="app-field text-[13px]"
                placeholder="Any details for this part of the job"
              />
            </div>

            <div className="bg-[var(--navy)] rounded-xl px-4 py-2.5 flex justify-between items-center">
              <div className="text-[12px] text-[var(--steel-2)] space-x-3">
                <span>Labour: ${lineLabour.toLocaleString()}</span>
                <span>Materials: ${lineMaterials.toLocaleString()}</span>
              </div>
              <span className="font-display text-[18px] text-[var(--amber)]">${lineTotal.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
