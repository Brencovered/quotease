"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Package, Plus, Trash2, Loader2, X } from "lucide-react";

interface PackageItem {
  item_key: string;
  label: string;
  qty: number;
  unit_cost: number;
}

interface JobPackage {
  id: string;
  trade: string;
  name: string;
  description: string | null;
  items: PackageItem[];
  labour_hours: number;
}

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician", plumber: "Plumber", carpenter: "Carpenter", roofer: "Roofer",
  painter: "Painter", tiler: "Tiler", landscaper: "Landscaper", arborist: "Arborist",
  concreter: "Concreter", fencer: "Fencer", aircon: "Air conditioning", surveyor: "Surveyor",
};

/**
 * Packages let a tradie bundle materials + labour into a reusable preset
 * (e.g. "Switchboard upgrade", "Standard bathroom rewire") instead of
 * re-keying the same line items into every similar quote.
 *
 * v1 is CRUD only -- applying a package straight into the quote builder as
 * a one-tap starting point is the natural next step, not built yet.
 */
export default function PackagesPanel({ trades, initialPackages }: { trades: string[]; initialPackages: JobPackage[] }) {
  const [packages, setPackages] = useState<JobPackage[]>(initialPackages);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New package form state
  const [name, setName] = useState("");
  const [trade, setTrade] = useState(trades[0] ?? "electrician");
  const [description, setDescription] = useState("");
  const [labourHours, setLabourHours] = useState("");
  const [items, setItems] = useState<PackageItem[]>([{ item_key: "", label: "", qty: 1, unit_cost: 0 }]);
  const [saving, setSaving] = useState(false);

  function updateItem(i: number, field: keyof PackageItem, value: string) {
    setItems((prev) => prev.map((it, idx) => idx !== i ? it : {
      ...it,
      [field]: field === "qty" || field === "unit_cost" ? Number(value) || 0 : value,
    }));
  }

  function addItemRow() {
    setItems((prev) => [...prev, { item_key: "", label: "", qty: 1, unit_cost: 0 }]);
  }

  function removeItemRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    setName(""); setDescription(""); setLabourHours("");
    setItems([{ item_key: "", label: "", qty: 1, unit_cost: 0 }]);
    setCreating(false);
  }

  async function savePackage() {
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, user.id);

    const validItems = items
      .filter((it) => it.label.trim())
      .map((it) => ({ ...it, item_key: it.item_key || it.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") }));

    const { data, error } = await supabase
      .from("job_packages")
      .insert({
        profile_id: businessId,
        trade,
        name: name.trim(),
        description: description.trim() || null,
        items: validItems,
        labour_hours: Number(labourHours) || 0,
      })
      .select()
      .single();

    if (!error && data) {
      setPackages((prev) => [data, ...prev]);
      resetForm();
    }
    setSaving(false);
  }

  async function deletePackage(id: string) {
    if (!window.confirm("Delete this package?")) return;
    setBusyId(id);
    const supabase = createClient();
    const { error } = await supabase.from("job_packages").delete().eq("id", id);
    if (!error) setPackages((prev) => prev.filter((p) => p.id !== id));
    setBusyId(null);
  }

  function packageCost(pkg: JobPackage) {
    return pkg.items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <p className="section-tag mb-0">Packages</p>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-secondary text-[12.5px] py-1.5 px-3 inline-flex items-center gap-1.5">
            <Plus size={13} /> New package
          </button>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-4">
        Bundle materials and labour for a job you quote often -- e.g. &quot;Switchboard upgrade&quot; or &quot;Standard bathroom rewire&quot;.
      </p>

      {creating && (
        <div className="bg-[var(--app-bg)] rounded-xl p-4 mb-4 border border-[var(--line)]">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-[13.5px] text-[var(--ink)]">New package</p>
            <button onClick={resetForm} className="text-[var(--ink-faint)] hover:text-[var(--ink)]"><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5 mb-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Package name" className="app-field" />
            <select value={trade} onChange={(e) => setTrade(e.target.value)} className="app-field">
              {trades.map((t) => <option key={t} value={t}>{TRADE_LABELS[t] ?? t}</option>)}
            </select>
          </div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="app-field mb-2.5" />
          <label className="block mb-3">
            <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Labour hours</span>
            <input type="number" min={0} step={0.5} value={labourHours} onChange={(e) => setLabourHours(e.target.value)} placeholder="0" className="app-field w-32" />
          </label>

          <p className="text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Materials</p>
          <div className="space-y-2 mb-3">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] gap-2 items-center">
                <input value={it.label} onChange={(e) => updateItem(i, "label", e.target.value)} placeholder="Item" className="app-field text-[13px]" />
                <input type="number" min={0} value={it.qty} onChange={(e) => updateItem(i, "qty", e.target.value)} className="app-field text-[13px]" />
                <input type="number" min={0} step={0.01} value={it.unit_cost} onChange={(e) => updateItem(i, "unit_cost", e.target.value)} placeholder="$ each" className="app-field text-[13px]" />
                <button onClick={() => removeItemRow(i)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addItemRow} className="text-[12.5px] font-semibold text-[var(--navy)] inline-flex items-center gap-1 mb-4">
            <Plus size={12} /> Add item
          </button>

          <div className="flex items-center gap-3">
            <button onClick={savePackage} disabled={saving || !name.trim()} className="btn-primary text-[13px] py-2 px-4">
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Save package"}
            </button>
          </div>
        </div>
      )}

      {packages.length === 0 && !creating ? (
        <p className="text-[13.5px] text-[var(--ink-faint)] py-2">No packages yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="border border-[var(--line)] rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-[var(--amber-deep)] shrink-0" />
                  <p className="font-semibold text-[14px] text-[var(--ink)]">{pkg.name}</p>
                </div>
                <button onClick={() => deletePackage(pkg.id)} disabled={busyId === pkg.id} className="text-[var(--ink-faint)] hover:text-[var(--red)] shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
              {pkg.description && <p className="text-[12.5px] text-[var(--ink-faint)] mb-2">{pkg.description}</p>}
              <p className="text-[12px] text-[var(--ink-soft)] mb-1">{pkg.items.length} item{pkg.items.length !== 1 ? "s" : ""} · {pkg.labour_hours}h labour</p>
              <p className="text-[13px] font-bold text-[var(--ink)]">~${Math.round(packageCost(pkg)).toLocaleString()} materials</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
