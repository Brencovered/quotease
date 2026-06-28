"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Download, Upload, Save, RotateCcw, Check, AlertCircle, Plus, Trash2 } from "lucide-react";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";

type Row = { item_key: string; label: string; unit_cost: number; trade: string; isNew?: boolean };

const TRADE_DEFAULTS: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician", plumber: "Plumber", carpenter: "Carpenter", roofer: "Roofer",
  painter: "Painter", tiler: "Tiler", landscaper: "Landscaper", arborist: "Arborist",
  concreter: "Concreter", fencer: "Fencer", aircon: "Air conditioning", surveyor: "Surveyor", custom: "Custom",
};

let rowId = 0;
function newKey() { return `new_${++rowId}_${Date.now()}`; }

export default function MaterialPricingPanel({ trades }: { trades: string[] }) {
  const [activeTrade, setActiveTrade] = useState(trades[0] ?? "electrician");
  const [rows,        setRows]        = useState<Row[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [csvMsg,      setCsvMsg]      = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (trade: string) => {
    setLoading(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("material_items").select("item_key,label,unit_cost,trade")
      .eq("profile_id", user.id).eq("trade", trade).order("label");
    if (data && data.length > 0) {
      setRows(data.map((r) => ({ ...r })));
    } else {
      const defs = TRADE_DEFAULTS[trade] ?? [];
      setRows(defs.map((m) => ({ ...m, trade })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(activeTrade); }, [activeTrade, load]);

  function update(key: string, field: "label" | "unit_cost", val: string) {
    setRows((p) => p.map((r) => r.item_key === key ? { ...r, [field]: field === "unit_cost" ? parseFloat(val) || 0 : val } : r));
  }

  function addRow() {
    const key = newKey();
    setRows((p) => [...p, { item_key: key, label: "", unit_cost: 0, trade: activeTrade, isNew: true }]);
    // Scroll to bottom after render
    setTimeout(() => document.getElementById("mat-table-bottom")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function removeRow(key: string) {
    setRows((p) => p.filter((r) => r.item_key !== key));
  }

  async function save() {
    setSaving(true); setSaved(false); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setSaving(false); return; }

    // Filter out blank rows
    const valid = rows.filter((r) => r.label.trim());

    // Delete all existing for this trade then re-insert
    await supabase.from("material_items").delete().eq("profile_id", user.id).eq("trade", activeTrade);
    if (valid.length > 0) {
      const { error: insertErr } = await supabase.from("material_items").insert(
        valid.map((r) => ({ profile_id: user.id, trade: activeTrade, item_key: r.item_key, label: r.label, unit_cost: r.unit_cost }))
      );
      if (insertErr) { setError(insertErr.message); setSaving(false); return; }
    }

    // Reload clean from DB
    await load(activeTrade);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  }

  function resetToDefaults() {
    const defs = TRADE_DEFAULTS[activeTrade] ?? [];
    setRows(defs.map((m) => ({ ...m, trade: activeTrade })));
    setCsvMsg(null);
  }

  function exportCsv() {
    const csv = ["item_key,label,unit_cost", ...rows.map((r) => `${r.item_key},"${r.label}",${r.unit_cost}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `swiftscope-materials-${activeTrade}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function downloadTemplate() {
    const defs = TRADE_DEFAULTS[activeTrade] ?? [];
    const csv  = ["item_key,label,unit_cost", ...defs.map((m) => `${m.item_key},"${m.label}",${m.unit_cost}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `swiftscope-template-${activeTrade}.csv`;
    a.click();
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvMsg(null);
    const text  = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvMsg({ type: "err", text: "CSV is empty or has no data rows." }); return; }
    const header = lines[0].toLowerCase().split(",").map((h) => h.replace(/"/g, "").trim());
    const li = header.indexOf("label"), ci = header.indexOf("unit_cost"), ki = header.indexOf("item_key");
    if (li === -1 || ci === -1) { setCsvMsg({ type: "err", text: 'CSV needs "label" and "unit_cost" columns. Download the template for the correct format.' }); return; }
    const parsed: Row[] = [];
    for (const line of lines.slice(1)) {
      const cols: string[] = []; let inQ = false, cur = "";
      for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; } else cur += ch; }
      cols.push(cur.trim());
      const label = cols[li]?.replace(/"/g, "").trim(); if (!label) continue;
      const cost  = parseFloat(cols[ci]?.replace(/[^0-9.]/g, "") ?? ""); if (isNaN(cost)) continue;
      const key   = ki >= 0 ? (cols[ki]?.replace(/"/g, "").trim() || label.toLowerCase().replace(/\W+/g, "_")) : label.toLowerCase().replace(/\W+/g, "_");
      parsed.push({ item_key: key, label, unit_cost: cost, trade: activeTrade });
    }
    if (!parsed.length) { setCsvMsg({ type: "err", text: "No valid rows found. Check the CSV format." }); return; }
    setRows(parsed);
    setCsvMsg({ type: "ok", text: `${parsed.length} items loaded. Review below then click Save.` });
    e.target.value = "";
  }

  const avgCost = rows.length ? (rows.reduce((s, r) => s + r.unit_cost, 0) / rows.length).toFixed(2) : "0";

  return (
    <div>
      {/* Trade tabs */}
      {trades.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 hide-scrollbar">
          {trades.map((t) => (
            <button key={t} onClick={() => setActiveTrade(t)}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors border-2 ${
                activeTrade === t ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)]/40"
              }`}>
              {TRADE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {/* Explainer */}
      <div className="bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3 mb-5">
        <p className="text-[13.5px] font-bold text-[var(--amber-deep)] mb-1">Your supplier costs</p>
        <p className="text-[13px] text-[var(--amber-deep)]/80 leading-snug">
          Enter what you actually pay per item ex-GST. Your materials margin ({" "}
          <strong>set in Settings</strong>) is added on top when quoting.
          Edit any row directly, add new items, or import from a CSV.
        </p>
      </div>

      {/* CSV bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="btn-secondary text-[13px] py-2 cursor-pointer">
          <Upload size={14} /> Import CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
        </label>
        <button onClick={exportCsv} className="btn-secondary text-[13px] py-2">
          <Download size={14} /> Export
        </button>
        <button onClick={downloadTemplate} className="text-[12.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors">
          <Download size={12} /> Download template
        </button>
      </div>

      {csvMsg && (
        <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 mb-4 text-[13px] font-semibold ${csvMsg.type === "ok" ? "bg-[var(--green-bg)] border border-green-200 text-[var(--green)]" : "bg-[var(--red-bg)] border border-red-200 text-[var(--red)]"}`}>
          {csvMsg.type === "ok" ? <Check size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
          {csvMsg.text}
        </div>
      )}

      {/* Stats + add button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-4 text-[13px] text-[var(--ink-faint)]">
          {!loading && <span><strong className="text-[var(--ink)]">{rows.length}</strong> items</span>}
          {!loading && <span>Avg cost: <strong className="text-[var(--ink)]">${avgCost}</strong></span>}
        </div>
        <button onClick={addRow}
          className="inline-flex items-center gap-1.5 bg-[var(--navy)] text-white text-[13px] font-bold px-3 py-2 rounded-lg hover:bg-[#0e2233] transition-colors">
          <Plus size={14} /> Add item
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-10 text-[var(--ink-faint)] text-[14px]">Loading...</div>
      ) : (
        <div className="border border-[var(--line)] rounded-2xl overflow-hidden mb-4">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_44px] bg-[var(--app-bg)] border-b border-[var(--line)] px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Item name</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] text-right">Your cost (ex-GST)</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--line-subtle)] max-h-[520px] overflow-y-auto">
            {rows.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-[var(--ink-faint)] text-[14px] mb-3">No items yet.</p>
                <button onClick={addRow} className="btn-primary inline-flex px-5 text-[14px]">
                  <Plus size={15} /> Add your first item
                </button>
              </div>
            )}
            {rows.map((r) => (
              <div key={r.item_key} className={`grid grid-cols-[1fr_120px_44px] items-center px-4 py-2.5 hover:bg-[var(--app-bg)] ${r.isNew ? "bg-[var(--amber-light)]/30" : ""}`}>
                <input
                  value={r.label}
                  onChange={(e) => update(r.item_key, "label", e.target.value)}
                  placeholder="Item name (e.g. LED downlight 10W)"
                  className="text-[13.5px] text-[var(--ink)] bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[var(--amber)] rounded px-1.5 py-1 w-full"
                />
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-[var(--ink-faint)] text-[13px]">$</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={r.unit_cost || ""}
                    placeholder="0.00"
                    onChange={(e) => update(r.item_key, "unit_cost", e.target.value)}
                    className="text-[13.5px] font-semibold text-[var(--ink)] bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[var(--amber)] rounded px-1.5 py-1 w-20 text-right"
                  />
                </div>
                <button onClick={() => removeRow(r.item_key)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--ink-faint)] hover:text-[var(--red)] hover:bg-[var(--red-bg)] transition-colors mx-auto">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add row inline at bottom */}
          {rows.length > 0 && (
            <div className="border-t border-[var(--line)] px-4 py-2.5 bg-[var(--app-bg)]">
              <button onClick={addRow}
                className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink-faint)] hover:text-[var(--navy)] transition-colors w-full">
                <Plus size={14} /> Add another item
              </button>
            </div>
          )}
        </div>
      )}

      <div id="mat-table-bottom" />

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={save} disabled={saving || loading} className="btn-primary">
          {saving ? "Saving..." : <><Save size={14} /> Save all prices</>}
        </button>
        <button onClick={resetToDefaults} className="btn-secondary text-[13px] py-2">
          <RotateCcw size={13} /> Reset to defaults
        </button>
        {saved  && <span className="text-[13px] text-[var(--green)] font-semibold flex items-center gap-1.5"><Check size={14} /> Saved</span>}
        {error  && <span className="text-[13px] text-[var(--red)] font-semibold">{error}</span>}
      </div>

      <p className="text-[12px] text-[var(--ink-faint)] mt-3">
        Changes take effect on your next new quote. Existing quotes are not affected.
      </p>
    </div>
  );
}
