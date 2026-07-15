"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";
import type { SiteConditionTemplateRow } from "@/lib/peripherals";

/**
 * Fully business + trade customizable site condition fees (Level 2
 * connection fees, switchboard isolation, scaffolding, etc) - shown as
 * toggle cards during quote creation (PeripheralsPanel). Previously a
 * hardcoded per-trade list in lib/peripherals.ts with no way for a
 * business to set their own numbers; every account saw the same figures.
 *
 * initialByTrade arrives pre-seeded (see getPeripheralsForBusiness) - the
 * first time a business has no rows for a trade, real DB rows already got
 * created here from the old hardcoded defaults before this component ever
 * rendered, so every row shown is already a real, editable, business-owned
 * record - not a preview of a default that might not be saved yet.
 */
export default function SiteConditionsSettingsPanel({
  businessId,
  initialByTrade,
}: {
  businessId: string;
  initialByTrade: { trade: string; templates: SiteConditionTemplateRow[] }[];
}) {
  const [byTrade, setByTrade] = useState(initialByTrade);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingTrade, setAddingTrade] = useState<string | null>(null);

  function updateRow(trade: string, id: string, patch: Partial<SiteConditionTemplateRow>) {
    setByTrade((prev) =>
      prev.map((g) => (g.trade !== trade ? g : { ...g, templates: g.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
    );
  }

  async function saveRow(id: string, patch: Partial<SiteConditionTemplateRow>) {
    setSavingId(id);
    const supabase = createClient();
    await supabase.from("site_condition_templates").update(patch).eq("id", id);
    setSavingId(null);
  }

  async function removeRow(trade: string, id: string) {
    setByTrade((prev) => prev.map((g) => (g.trade !== trade ? g : { ...g, templates: g.templates.filter((t) => t.id !== id) })));
    const supabase = createClient();
    await supabase.from("site_condition_templates").delete().eq("id", id);
  }

  async function addRow(trade: string) {
    setAddingTrade(trade);
    const supabase = createClient();
    const group = byTrade.find((g) => g.trade === trade);
    const sortOrder = group ? group.templates.length : 0;
    const { data } = await supabase
      .from("site_condition_templates")
      .insert({ profile_id: businessId, trade, label: "New site condition", kind: "fixed", default_amount: 0, sort_order: sortOrder })
      .select("id, trade, label, kind, default_amount, sort_order")
      .single();
    if (data) {
      setByTrade((prev) => prev.map((g) => (g.trade !== trade ? g : { ...g, templates: [...g.templates, data] })));
    }
    setAddingTrade(null);
  }

  return (
    <div className="page-wrap-narrow pb-0 pt-0">
      <div className="card mt-0 mb-4">
        <p className="section-tag mb-1 flex items-center gap-1.5"><MapPin size={13} /> Site conditions</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Your own starting fees, per trade</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-4">
          These are starting estimates a tradie can toggle on when quoting - always editable per quote, never fixed. Set your own numbers here so they start closer to right every time.
        </p>

        <div className="space-y-5">
          {byTrade.map((group) => (
            <div key={group.trade}>
              <p className="text-[11px] tracking-[.1em] uppercase text-[var(--ink-faint)] font-bold mb-2 capitalize">{group.trade}</p>
              <div className="space-y-2">
                {group.templates.map((t) => (
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[var(--app-bg)] rounded-xl p-2.5">
                    <input
                      value={t.label}
                      onChange={(e) => updateRow(group.trade, t.id, { label: e.target.value })}
                      onBlur={() => saveRow(t.id, { label: t.label })}
                      className="app-field text-[13px] w-full sm:flex-1"
                      placeholder="e.g. Scaffolding"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={t.kind}
                        onChange={(e) => {
                          const kind = e.target.value as "fixed" | "daily";
                          updateRow(group.trade, t.id, { kind });
                          saveRow(t.id, { kind });
                        }}
                        className="app-field text-[13px] w-auto flex-1 sm:flex-none"
                      >
                        <option value="fixed">Flat fee</option>
                        <option value="daily">Per day</option>
                      </select>
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-faint)]">$</span>
                        <input
                          type="number"
                          min={0}
                          value={t.default_amount}
                          onChange={(e) => updateRow(group.trade, t.id, { default_amount: Number(e.target.value) })}
                          onBlur={() => saveRow(t.id, { default_amount: t.default_amount })}
                          className="app-field text-[13px] pl-6 w-full"
                        />
                      </div>
                      {savingId === t.id ? (
                        <Loader2 size={14} className="animate-spin text-[var(--ink-faint)] shrink-0" />
                      ) : (
                        <button
                          onClick={() => removeRow(group.trade, t.id)}
                          className="p-2 rounded-lg text-[var(--ink-faint)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                          aria-label={`Remove ${t.label}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addRow(group.trade)}
                disabled={addingTrade === group.trade}
                className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--navy)] hover:underline disabled:opacity-40"
              >
                {addingTrade === group.trade ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add a site condition for {group.trade}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
