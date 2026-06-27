"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Download, Upload, Save, RotateCcw, Check, AlertCircle } from "lucide-react";
import { ELECTRICIAN_DEFAULT_MATERIALS } from "@/lib/calc";
import { PLUMBER_DEFAULT_MATERIALS } from "@/lib/calcPlumber";
import { CARPENTER_DEFAULT_MATERIALS } from "@/lib/calcCarpenter";
import { ROOFER_DEFAULT_MATERIALS } from "@/lib/calcRoofer";

type MaterialRow = { item_key: string; label: string; unit_cost: number; trade: string };

const TRADE_DEFAULTS: Record<string, readonly { item_key: string; label: string; unit_cost: number }[]> = {
  electrician: ELECTRICIAN_DEFAULT_MATERIALS,
  plumber:     PLUMBER_DEFAULT_MATERIALS,
  carpenter:   CARPENTER_DEFAULT_MATERIALS,
  roofer:      ROOFER_DEFAULT_MATERIALS,
};

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician",
  plumber:     "Plumber",
  carpenter:   "Carpenter",
  roofer:      "Roofer",
};

export default function MaterialPricingPanel({ trades }: { trades: string[] }) {
  const [activeTrade, setActiveTrade]   = useState(trades[0] ?? "electrician");
  const [materials,   setMaterials]     = useState<MaterialRow[]>([]);
  const [loading,     setLoading]       = useState(true);
  const [saving,      setSaving]        = useState(false);
  const [saved,       setSaved]         = useState(false);
  const [error,       setError]         = useState<string | null>(null);
  const [csvError,    setCsvError]      = useState<string | null>(null);
  const [csvSuccess,  setCsvSuccess]    = useState<string | null>(null);

  const loadMaterials = useCallback(async (trade: string) => {
    setLoading(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("material_items")
      .select("item_key, label, unit_cost, trade")
      .eq("profile_id", user.id)
      .eq("trade", trade)
      .order("label");

    if (data && data.length > 0) {
      setMaterials(data);
    } else {
      // Seed defaults if nothing in DB yet
      const defaults = TRADE_DEFAULTS[trade] ?? [];
      setMaterials(defaults.map((m) => ({ ...m, trade })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadMaterials(activeTrade); }, [activeTrade, loadMaterials]);

  function updateRow(item_key: string, field: "label" | "unit_cost", value: string) {
    setMaterials((prev) => prev.map((m) =>
      m.item_key === item_key
        ? { ...m, [field]: field === "unit_cost" ? parseFloat(value) || 0 : value }
        : m
    ));
  }

  async function saveAll() {
    setSaving(true); setSaved(false); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setSaving(false); return; }

    const rows = materials.map((m) => ({
      profile_id: user.id,
      trade: activeTrade,
      item_key: m.item_key,
      label: m.label,
      unit_cost: m.unit_cost,
    }));

    const { error: upsertError } = await supabase
      .from("material_items")
      .upsert(rows, { onConflict: "profile_id,item_key" });

    if (upsertError) { setError(upsertError.message); }
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  async function resetToDefaults() {
    const defaults = TRADE_DEFAULTS[activeTrade] ?? [];
    setMaterials(defaults.map((m) => ({ ...m, trade: activeTrade })));
  }

  function downloadTemplate() {
    const defaults = TRADE_DEFAULTS[activeTrade] ?? [];
    const rows = [
      "item_key,label,unit_cost",
      ...defaults.map((m) => `${m.item_key},"${m.label}",${m.unit_cost}`),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quotease-materials-${activeTrade}.csv`;
    a.click();
  }

  function downloadCurrent() {
    const rows = [
      "item_key,label,unit_cost",
      ...materials.map((m) => `${m.item_key},"${m.label}",${m.unit_cost}`),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quotease-materials-${activeTrade}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null); setCsvSuccess(null);

    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { setCsvError("CSV is empty or has no data rows."); return; }

    const header = lines[0].toLowerCase().split(",").map((h) => h.replace(/"/g, "").trim());
    const labelIdx    = header.indexOf("label");
    const costIdx     = header.indexOf("unit_cost");
    const keyIdx      = header.indexOf("item_key");

    if (labelIdx === -1 || costIdx === -1) {
      setCsvError('CSV must have "label" and "unit_cost" columns. Download the template above to see the format.');
      return;
    }

    const parsed: MaterialRow[] = [];
    for (const line of lines.slice(1)) {
      // Handle quoted CSV fields
      const cols: string[] = [];
      let inQuote = false, cur = "";
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());

      const label    = cols[labelIdx]?.replace(/"/g, "").trim();
      const costRaw  = cols[costIdx]?.replace(/[^0-9.]/g, "");
      const cost     = parseFloat(costRaw);
      const key      = keyIdx >= 0 ? (cols[keyIdx]?.replace(/"/g, "").trim() || label?.toLowerCase().replace(/\s+/g, "_")) : label?.toLowerCase().replace(/\s+/g, "_");

      if (!label || isNaN(cost)) continue;
      parsed.push({ item_key: key!, label, unit_cost: cost, trade: activeTrade });
    }

    if (parsed.length === 0) { setCsvError("No valid rows found. Check the CSV format."); return; }

    setMaterials(parsed);
    setCsvSuccess(`${parsed.length} items loaded from CSV. Review the prices below, then click Save.`);
    e.target.value = "";
  }

  const avgCost = materials.length > 0
    ? (materials.reduce((s, m) => s + m.unit_cost, 0) / materials.length).toFixed(2)
    : "0";

  return (
    <div>
      {/* Trade tabs */}
      {trades.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {trades.map((t) => (
            <button key={t} onClick={() => setActiveTrade(t)}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors ${
                activeTrade === t
                  ? "bg-[var(--navy)] text-white"
                  : "bg-[var(--app-bg)] text-[var(--ink-soft)] border border-[var(--line)] hover:border-[var(--navy)]/40"
              }`}>
              {TRADE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {/* Explainer */}
      <div className="bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3 mb-5">
        <p className="text-[13.5px] font-bold text-[var(--amber-deep)] mb-1">How material pricing works</p>
        <p className="text-[13px] text-[var(--amber-deep)]/80 leading-snug">
          These are your supplier costs for each item. When you build a quote, Quotease adds your
          materials margin on top (set in Settings). Keep these updated and every quote
          calculates off what you actually pay - not a guess.
        </p>
      </div>

      {/* CSV actions */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="btn-secondary text-[13px] py-2 cursor-pointer">
          <Upload size={14} /> Import CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
        </label>
        <button onClick={downloadCurrent} className="btn-secondary text-[13px] py-2">
          <Download size={14} /> Export current
        </button>
        <button onClick={downloadTemplate} className="text-[12.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] flex items-center gap-1.5 transition-colors">
          <Download size={12} /> Download blank template
        </button>
      </div>

      {/* CSV format hint */}
      <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-xl px-4 py-3 mb-5 text-[12.5px] text-[var(--ink-soft)]">
        <p className="font-bold mb-1">CSV format:</p>
        <code className="text-[11.5px] bg-white border border-[var(--line)] rounded px-2 py-0.5 font-mono">
          item_key, label, unit_cost
        </code>
        <p className="mt-1.5 text-[var(--ink-faint)]">
          item_key = short unique ID (e.g. <code className="font-mono">dl_builder</code>).
          label = what shows on the quote.
          unit_cost = your cost ex-GST in dollars.
          Download the template above for the full list with pre-filled defaults.
        </p>
      </div>

      {/* Feedback */}
      {csvError && (
        <div className="flex items-start gap-2.5 bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3 mb-4 text-[13px] text-[var(--red)]">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="font-semibold">{csvError}</span>
        </div>
      )}
      {csvSuccess && (
        <div className="flex items-start gap-2.5 bg-[var(--green-bg)] border border-green-200 rounded-xl px-4 py-3 mb-4 text-[13px] text-[var(--green)]">
          <Check size={15} className="shrink-0 mt-0.5" />
          <span className="font-semibold">{csvSuccess}</span>
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="flex items-center gap-6 mb-4 text-[13px] text-[var(--ink-faint)]">
          <span><strong className="text-[var(--ink)]">{materials.length}</strong> items</span>
          <span>Avg cost: <strong className="text-[var(--ink)]">${avgCost}</strong></span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-[var(--ink-faint)] text-[14px]">Loading...</div>
      ) : (
        <div className="border border-[var(--line)] rounded-2xl overflow-hidden mb-4">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_140px] gap-0 bg-[var(--app-bg)] border-b border-[var(--line)] px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Item name</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] w-24 text-right">Your cost</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] text-right">Key</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-[var(--line-subtle)] max-h-[480px] overflow-y-auto">
            {materials.map((m) => (
              <div key={m.item_key} className="grid grid-cols-[1fr_auto_140px] gap-0 px-4 py-2 items-center hover:bg-[var(--app-bg)]">
                <input
                  value={m.label}
                  onChange={(e) => updateRow(m.item_key, "label", e.target.value)}
                  className="text-[13.5px] text-[var(--ink)] bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[var(--amber)] rounded px-1 py-0.5 w-full"
                />
                <div className="flex items-center gap-1 w-28">
                  <span className="text-[var(--ink-faint)] text-[13px]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={m.unit_cost}
                    onChange={(e) => updateRow(m.item_key, "unit_cost", e.target.value)}
                    className="text-[13.5px] font-semibold text-[var(--ink)] bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[var(--amber)] rounded px-1 py-0.5 w-full text-right"
                  />
                </div>
                <span className="text-[11px] text-[var(--ink-faint)] font-mono truncate text-right pl-4">{m.item_key}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={saveAll} disabled={saving || loading} className="btn-primary">
          {saving ? "Saving..." : <><Save size={14} /> Save prices</>}
        </button>
        <button onClick={resetToDefaults} className="btn-secondary text-[13px] py-2">
          <RotateCcw size={13} /> Reset to defaults
        </button>
        {saved && (
          <span className="text-[13px] text-[var(--green)] font-semibold flex items-center gap-1.5">
            <Check size={14} /> Saved
          </span>
        )}
        {error && <span className="text-[13px] text-[var(--red)] font-semibold">{error}</span>}
      </div>

      <p className="text-[12px] text-[var(--ink-faint)] mt-3">
        Changes take effect on your next new quote. Existing saved quotes are not affected.
      </p>
    </div>
  );
}
