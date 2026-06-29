"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import PriceBookSearch, { type PriceBookResult } from "@/components/PriceBookSearch";
import { Package, Plus, Trash2, Loader2, X, Search, BookOpen, ArrowRight } from "lucide-react";

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

interface MaterialRow { item_key: string; label: string; unit_cost: number; trade: string }

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
 * Items are picked from the existing materials list or price book, not
 * retyped -- that keeps a package's costs tied to the same numbers used
 * everywhere else, so updating a unit cost in Materials doesn't silently
 * leave packages out of date... well, it still will for now (costs are
 * copied in at pick-time, not referenced live) but at least the starting
 * numbers are never hand-typed twice.
 *
 * v1 is CRUD only -- applying a package straight into the quote builder as
 * a one-tap starting point is the natural next step, not built yet.
 */
export default function PackagesPanel({
  trades, initialPackages, allMaterials, hourlyRate,
}: {
  trades: string[];
  initialPackages: JobPackage[];
  allMaterials: MaterialRow[];
  hourlyRate: number;
}) {
  const [packages, setPackages] = useState<JobPackage[]>(initialPackages);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New package form state
  const [name, setName] = useState("");
  const [trade, setTrade] = useState(trades[0] ?? "electrician");
  const [description, setDescription] = useState("");
  const [labourHours, setLabourHours] = useState("");
  const [items, setItems] = useState<PackageItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Item picker state -- one shared typeahead row at the bottom of the
  // items list, rather than every row being independently editable text.
  const [pickerQuery, setPickerQuery] = useState("");
  const [showPriceBookSearch, setShowPriceBookSearch] = useState(false);

  const tradeMaterials = useMemo(
    () => allMaterials.filter((m) => m.trade === trade),
    [allMaterials, trade]
  );

  const pickerMatches = useMemo(() => {
    if (pickerQuery.trim().length < 1) return [];
    const q = pickerQuery.toLowerCase();
    return tradeMaterials.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 8);
  }, [pickerQuery, tradeMaterials]);

  function addItem(item: PackageItem) {
    setItems((prev) => {
      const existing = prev.find((it) => it.item_key === item.item_key);
      if (existing) return prev.map((it) => it.item_key === item.item_key ? { ...it, qty: it.qty + 1 } : it);
      return [...prev, item];
    });
    setPickerQuery("");
  }

  function addFromMaterial(m: MaterialRow) {
    addItem({ item_key: m.item_key, label: m.label, qty: 1, unit_cost: m.unit_cost });
  }

  function addFromPriceBook(p: PriceBookResult) {
    addItem({ item_key: `pb_${p.id}`, label: p.description, qty: 1, unit_cost: p.cost_price });
    setShowPriceBookSearch(false);
  }

  function addCustomItem() {
    if (!pickerQuery.trim()) return;
    addItem({ item_key: pickerQuery.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label: pickerQuery.trim(), qty: 1, unit_cost: 0 });
  }

  function updateItem(key: string, field: "qty" | "unit_cost" | "label", value: string) {
    setItems((prev) => prev.map((it) => it.item_key !== key ? it : {
      ...it,
      [field]: field === "qty" || field === "unit_cost" ? Number(value) || 0 : value,
    }));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.item_key !== key));
  }

  function resetForm() {
    setName(""); setDescription(""); setLabourHours("");
    setItems([]); setPickerQuery(""); setShowPriceBookSearch(false);
    setCreating(false);
  }

  async function savePackage() {
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, user.id);

    const { data, error } = await supabase
      .from("job_packages")
      .insert({
        profile_id: businessId,
        trade,
        name: name.trim(),
        description: description.trim() || null,
        items,
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

  function materialsCost(pkgItems: PackageItem[]) {
    return pkgItems.reduce((s, it) => s + it.qty * it.unit_cost, 0);
  }

  const formMaterialsCost = materialsCost(items);
  const formLabourCost = (Number(labourHours) || 0) * hourlyRate;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <p className="section-tag mb-0">Your packages</p>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-secondary text-[12.5px] py-1.5 px-3 inline-flex items-center gap-1.5">
            <Plus size={13} /> New package
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-[var(--app-bg)] rounded-xl p-4 mb-4 border border-[var(--line)]">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-[13.5px] text-[var(--ink)]">New package</p>
            <button onClick={resetForm} className="text-[var(--ink-faint)] hover:text-[var(--ink)]"><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5 mb-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Package name, e.g. Switchboard upgrade" className="app-field" />
            <select value={trade} onChange={(e) => { setTrade(e.target.value); setItems([]); }} className="app-field">
              {trades.map((t) => <option key={t} value={t}>{TRADE_LABELS[t] ?? t}</option>)}
            </select>
          </div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="app-field mb-3" />

          <p className="text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Materials</p>

          {/* Existing items in the package */}
          {items.length > 0 && (
            <div className="space-y-1.5 mb-2.5">
              {items.map((it) => (
                <div key={it.item_key} className="grid grid-cols-[1fr_60px_90px_auto] gap-2 items-center bg-[var(--surface)] rounded-lg px-2 py-1.5 border border-[var(--line)]">
                  <span className="text-[13px] text-[var(--ink)] truncate">{it.label}</span>
                  <input type="number" min={0} value={it.qty} onChange={(e) => updateItem(it.item_key, "qty", e.target.value)} className="app-field text-[12.5px] py-1" />
                  <div className="flex items-center gap-0.5">
                    <span className="text-[12px] text-[var(--ink-faint)]">$</span>
                    <input type="number" min={0} step={0.01} value={it.unit_cost} onChange={(e) => updateItem(it.item_key, "unit_cost", e.target.value)} className="app-field text-[12.5px] py-1" />
                  </div>
                  <button onClick={() => removeItem(it.item_key)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Typeahead picker -- pulls from this trade's materials list */}
          <div className="relative mb-1.5">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (pickerMatches[0]) addFromMaterial(pickerMatches[0]); else addCustomItem(); } }}
              placeholder={tradeMaterials.length > 0 ? "Search your materials list..." : "Type an item name..."}
              className="app-field pl-8 text-[13px]"
            />
            {pickerQuery.trim().length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[var(--line)] rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                {pickerMatches.map((m) => (
                  <button key={m.item_key} type="button" onClick={() => addFromMaterial(m)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--app-bg)] text-left border-b border-[var(--line-subtle)] last:border-0">
                    <span className="text-[13px] text-[var(--ink)] truncate">{m.label}</span>
                    <span className="text-[12.5px] font-bold text-[var(--ink-soft)] shrink-0">${m.unit_cost.toFixed(2)}</span>
                  </button>
                ))}
                <button type="button" onClick={addCustomItem}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--app-bg)] text-left text-[12.5px] font-semibold text-[var(--navy)]">
                  <Plus size={13} /> Add &quot;{pickerQuery.trim()}&quot; as a custom item
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setShowPriceBookSearch((v) => !v)} className="text-[12px] font-semibold text-[var(--navy)] inline-flex items-center gap-1 mb-3">
            <BookOpen size={12} /> {showPriceBookSearch ? "Hide" : "Search"} price book instead
          </button>
          {showPriceBookSearch && (
            <div className="mb-3">
              <PriceBookSearch trade={trade} onSelect={addFromPriceBook} placeholder="Search supplier SKUs..." />
            </div>
          )}

          <label className="block mb-3 mt-1">
            <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Labour hours</span>
            <input type="number" min={0} step={0.5} value={labourHours} onChange={(e) => setLabourHours(e.target.value)} placeholder="0" className="app-field w-32" />
          </label>

          {/* Live total */}
          {(items.length > 0 || Number(labourHours) > 0) && (
            <div className="flex items-center gap-4 text-[12.5px] font-semibold text-[var(--ink-soft)] mb-3 bg-[var(--surface)] rounded-lg px-3 py-2 border border-[var(--line)]">
              <span>Materials: <strong className="text-[var(--ink)]">${formMaterialsCost.toFixed(0)}</strong></span>
              <span>Labour: <strong className="text-[var(--ink)]">${formLabourCost.toFixed(0)}</strong></span>
              <span className="ml-auto">Total: <strong className="text-[var(--ink)]">${(formMaterialsCost + formLabourCost).toFixed(0)}</strong></span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={savePackage} disabled={saving || !name.trim()} className="btn-primary text-[13px] py-2 px-4">
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Save package"}
            </button>
          </div>
        </div>
      )}

      {packages.length === 0 && !creating ? (
        <p className="text-[13.5px] text-[var(--ink-faint)] py-2">
          No packages yet. Bundle materials and labour for a job you quote often — e.g. &quot;Switchboard upgrade&quot; or &quot;Standard bathroom rewire&quot;.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {packages.map((pkg) => {
            const matCost = materialsCost(pkg.items);
            const labCost = pkg.labour_hours * hourlyRate;
            const expanded = expandedId === pkg.id;
            return (
              <div key={pkg.id} className="border border-[var(--line)] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <button onClick={() => setExpandedId(expanded ? null : pkg.id)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <Package size={15} className="text-[var(--amber-deep)] shrink-0" />
                    <p className="font-semibold text-[14px] text-[var(--ink)] truncate">{pkg.name}</p>
                  </button>
                  <button onClick={() => deletePackage(pkg.id)} disabled={busyId === pkg.id} className="text-[var(--ink-faint)] hover:text-[var(--red)] shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {pkg.description && <p className="text-[12.5px] text-[var(--ink-faint)] mb-2">{pkg.description}</p>}
                <p className="text-[12px] text-[var(--ink-soft)] mb-1">{pkg.items.length} item{pkg.items.length !== 1 ? "s" : ""} · {pkg.labour_hours}h labour</p>
                <p className="text-[13px] font-bold text-[var(--ink)] mb-1">${Math.round(matCost + labCost).toLocaleString()} <span className="text-[11.5px] font-medium text-[var(--ink-faint)]">(${Math.round(matCost)} materials + ${Math.round(labCost)} labour)</span></p>
                {expanded && (
                  <ul className="mt-2 pt-2 border-t border-[var(--line-subtle)] space-y-1 mb-3">
                    {pkg.items.map((it) => (
                      <li key={it.item_key} className="flex justify-between text-[12.5px] text-[var(--ink-soft)]">
                        <span>{it.qty}× {it.label}</span>
                        <span className="font-semibold">${(it.qty * it.unit_cost).toFixed(0)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/electrician?package_id=${pkg.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--navy)] hover:underline"
                >
                  Use this package <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
