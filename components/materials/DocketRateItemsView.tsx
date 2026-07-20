"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Plus, Trash2, Loader2, HardHat, Truck } from "lucide-react";
import type { DocketRateItem, DocketRateCategory } from "@/lib/dockets";

const EMPTY_FORM = { category: "labour" as DocketRateCategory, label: "", default_rate: "", unit: "hour" };

export default function DocketRateItemsView() {
  const [items, setItems] = useState<DocketRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }
      const id = await getActiveBusinessId(supabase, userData.user.id);
      setBusinessId(id);
      const { data } = await supabase.from("docket_rate_items").select("*").eq("profile_id", id).order("category").order("label");
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  async function addItem() {
    if (!form.label.trim()) { setError("Name is required"); return; }
    if (!businessId) { setError("Not signed in"); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("docket_rate_items")
      .insert({ profile_id: businessId, category: form.category, label: form.label.trim(), default_rate: Number(form.default_rate) || 0, unit: form.unit })
      .select()
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    setItems((prev) => [...prev, data].sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)));
    setShowForm(false);
    setForm(EMPTY_FORM);
    setSaving(false);
  }

  async function removeItem(id: string) {
    const supabase = createClient();
    await supabase.from("docket_rate_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const labourItems = items.filter((i) => i.category === "labour");
  const plantItems = items.filter((i) => i.category === "plant");

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-[var(--ink-faint)]" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Dayworks rates</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">Your usual labour and plant rates - pick from these on a docket instead of typing them out each time.</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(null); }} className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-[var(--navy)] text-white rounded-xl px-4 py-2.5 shrink-0">
          <Plus size={15} /> Add rate
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Type</span>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DocketRateCategory }))} className="app-field">
                <option value="labour">Labour</option>
                <option value="plant">Plant / equipment</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Name</span>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="app-field" placeholder={form.category === "labour" ? "e.g. Labourer, Machine Operator" : "e.g. Excavator, Tipper Truck"} />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Default rate ($/hour)</span>
              <input type="number" min={0} value={form.default_rate} onChange={(e) => setForm((f) => ({ ...f, default_rate: e.target.value }))} className="app-field" placeholder="0" />
            </label>
          </div>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addItem} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setShowForm(false)} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <HardHat size={16} className="text-[var(--amber-deep)]" />
            <p className="font-bold text-[var(--ink)]">Labour</p>
          </div>
          {labourItems.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">No labour rates saved yet.</p>
          ) : (
            <div className="space-y-2">
              {labourItems.map((i) => (
                <div key={i.id} className="flex items-center justify-between border border-[var(--line)] rounded-lg px-3 py-2">
                  <span className="text-[13.5px] text-[var(--ink)]">{i.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-[var(--ink-soft)]">${i.default_rate}/{i.unit}</span>
                    <button onClick={() => removeItem(i.id)} className="text-[var(--ink-faint)] hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-[var(--amber-deep)]" />
            <p className="font-bold text-[var(--ink)]">Plant &amp; equipment</p>
          </div>
          {plantItems.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">No plant rates saved yet.</p>
          ) : (
            <div className="space-y-2">
              {plantItems.map((i) => (
                <div key={i.id} className="flex items-center justify-between border border-[var(--line)] rounded-lg px-3 py-2">
                  <span className="text-[13.5px] text-[var(--ink)]">{i.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-[var(--ink-soft)]">${i.default_rate}/{i.unit}</span>
                    <button onClick={() => removeItem(i.id)} className="text-[var(--ink-faint)] hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
