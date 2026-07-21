"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Plus, CheckCircle2, Send, FileClock, Copy, Check, Trash2, Search, Receipt, Loader2 } from "lucide-react";
import type { Docket, DocketItem, DocketRateItem, DocketInvoice } from "@/lib/dockets";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-50 text-amber-800",
  signed: "bg-green-50 text-green-700",
  invoiced: "bg-blue-50 text-blue-700",
};
const STATUS_ICON: Record<string, typeof FileClock> = {
  draft: FileClock,
  sent: Send,
  signed: CheckCircle2,
  invoiced: CheckCircle2,
};

type CatalogMaterial = { item_key: string; label: string; unit_cost: number };

type LabourRow = { key: string; source_rate_item_id: string | null; label: string; person_name: string; quantity: string; rate: string };
type PlantRow = { key: string; source_rate_item_id: string | null; label: string; quantity: string; rate: string };
type MaterialRow = { key: string; label: string; quantity: string; rate: string };
type CustomRow = { key: string; label: string; quantity: string; rate: string };

const today = () => new Date().toISOString().slice(0, 10);
const rid = () => Math.random().toString(36).slice(2);
const num = (v: string) => Number(v) || 0;

function emptyHeader() {
  return { work_date: today(), weather: "", client_name: "", client_email: "", description: "" };
}

export default function DocketsPanel({
  jobId,
  dockets: initial,
  docketInvoices: initialInvoices,
  labourCatalog,
  plantCatalog,
  materialsCatalog,
}: {
  jobId: string;
  dockets: Docket[];
  docketInvoices: DocketInvoice[];
  labourCatalog: DocketRateItem[];
  plantCatalog: DocketRateItem[];
  materialsCatalog: CatalogMaterial[];
  defaultHourlyRate?: number;
}) {
  const [dockets, setDockets] = useState(initial);
  const [docketInvoices, setDocketInvoices] = useState(initialInvoices);
  const [bundling, setBundling] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [header, setHeader] = useState(emptyHeader());
  const [labourRows, setLabourRows] = useState<LabourRow[]>([]);
  const [plantRows, setPlantRows] = useState<PlantRow[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialSearchOpen, setMaterialSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Record<string, string>>({});

  const materialResults = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return materialsCatalog.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 8);
  }, [materialQuery, materialsCatalog]);

  const grandTotal =
    labourRows.reduce((s, r) => s + num(r.quantity) * num(r.rate), 0) +
    plantRows.reduce((s, r) => s + num(r.quantity) * num(r.rate), 0) +
    materialRows.reduce((s, r) => s + num(r.quantity) * num(r.rate), 0) +
    customRows.reduce((s, r) => s + num(r.quantity) * num(r.rate), 0);

  const unbilledTotal = dockets.filter((d) => d.status !== "invoiced").reduce((sum, d) => sum + d.total_cost, 0);
  const signedReady = dockets.filter((d) => d.status === "signed");
  const signedReadyTotal = signedReady.reduce((sum, d) => sum + d.total_cost, 0);
  const awaitingSignature = dockets.filter((d) => d.status === "draft" || d.status === "sent");

  async function bundleToInvoice() {
    setBundling(true);
    setBundleError(null);
    try {
      const res = await fetch("/api/dockets/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create invoice");
      setDocketInvoices((prev) => [body.invoice, ...prev]);
      setDockets((prev) => prev.map((d) => (d.status === "signed" ? { ...d, status: "invoiced", docket_invoice_id: body.invoice.id } : d)));
    } catch (err) {
      setBundleError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setBundling(false);
    }
  }

  function resetForm() {
    setHeader(emptyHeader());
    setLabourRows([]);
    setPlantRows([]);
    setMaterialRows([]);
    setCustomRows([]);
    setMaterialQuery("");
  }

  function addLabourRow() {
    setLabourRows((r) => [...r, { key: rid(), source_rate_item_id: null, label: "", person_name: "", quantity: "", rate: "" }]);
  }
  function addPlantRow() {
    setPlantRows((r) => [...r, { key: rid(), source_rate_item_id: null, label: "", quantity: "", rate: "" }]);
  }
  function addCustomRow() {
    setCustomRows((r) => [...r, { key: rid(), label: "", quantity: "1", rate: "" }]);
  }
  function pickMaterial(m: CatalogMaterial) {
    setMaterialRows((r) => [...r, { key: rid(), label: m.label, quantity: "1", rate: String(m.unit_cost) }]);
    setMaterialQuery("");
    setMaterialSearchOpen(false);
  }

  function pickLabourCatalogItem(rowKey: string, rateItemId: string) {
    const item = labourCatalog.find((c) => c.id === rateItemId);
    setLabourRows((rows) => rows.map((r) => r.key === rowKey ? { ...r, source_rate_item_id: rateItemId, label: item?.label ?? "", rate: item ? String(item.default_rate) : r.rate } : r));
  }
  function pickPlantCatalogItem(rowKey: string, rateItemId: string) {
    const item = plantCatalog.find((c) => c.id === rateItemId);
    setPlantRows((rows) => rows.map((r) => r.key === rowKey ? { ...r, source_rate_item_id: rateItemId, label: item?.label ?? "", rate: item ? String(item.default_rate) : r.rate } : r));
  }

  async function saveDocket() {
    if (!header.work_date) { setError("Date of work is required"); return; }
    const hasAnyLine = labourRows.length + plantRows.length + materialRows.length + customRows.length > 0;
    if (!hasAnyLine) { setError("Add at least one labour, plant, materials or custom line"); return; }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);

    const { data: docket, error: docketErr } = await supabase
      .from("dockets")
      .insert({ job_id: jobId, profile_id: businessId, work_date: header.work_date, weather: header.weather || null, client_name: header.client_name || null, client_email: header.client_email || null, description: header.description || null, status: "draft" })
      .select()
      .single();
    if (docketErr || !docket) { setError(docketErr?.message ?? "Could not save docket"); setSaving(false); return; }

    let sortOrder = 0;
    const itemRows = [
      ...labourRows.filter((r) => r.label.trim()).map((r) => ({ docket_id: docket.id, profile_id: businessId, category: "labour", source_rate_item_id: r.source_rate_item_id, label: r.label.trim(), person_name: r.person_name.trim() || null, quantity: num(r.quantity), rate: num(r.rate), sort_order: sortOrder++ })),
      ...plantRows.filter((r) => r.label.trim()).map((r) => ({ docket_id: docket.id, profile_id: businessId, category: "plant", source_rate_item_id: r.source_rate_item_id, label: r.label.trim(), person_name: null, quantity: num(r.quantity), rate: num(r.rate), sort_order: sortOrder++ })),
      ...materialRows.filter((r) => r.label.trim()).map((r) => ({ docket_id: docket.id, profile_id: businessId, category: "material", source_rate_item_id: null, label: r.label.trim(), person_name: null, quantity: num(r.quantity), rate: num(r.rate), sort_order: sortOrder++ })),
      ...customRows.filter((r) => r.label.trim()).map((r) => ({ docket_id: docket.id, profile_id: businessId, category: "custom", source_rate_item_id: null, label: r.label.trim(), person_name: null, quantity: num(r.quantity), rate: num(r.rate), sort_order: sortOrder++ })),
    ];

    const { error: itemsErr } = await supabase.from("docket_items").insert(itemRows);
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }

    // Re-fetch so we get the trigger-computed total_cost and full item rows.
    const { data: fullDocket } = await supabase.from("dockets").select("*, docket_items(*)").eq("id", docket.id).single();
    setDockets((prev) => [fullDocket ?? docket, ...prev]);
    setShowForm(false);
    resetForm();
    setSaving(false);
  }

  async function markSent(id: string) {
    const supabase = createClient();
    await supabase.from("dockets").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", id);
    setDockets((prev) => prev.map((d) => (d.id === id ? { ...d, status: "sent" } : d)));
  }

  function copyLink(docket: Docket) {
    const url = `${window.location.origin}/docket/${docket.public_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(docket.id);
    if (docket.status === "draft") markSent(docket.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function sendDocket(docket: Docket) {
    if (!docket.client_email) {
      setSendError((prev) => ({ ...prev, [docket.id]: "Add an email for this docket to send it - use Copy link instead for now" }));
      return;
    }
    setSendingId(docket.id);
    setSendError((prev) => ({ ...prev, [docket.id]: "" }));
    try {
      const res = await fetch("/api/dockets/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docketId: docket.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not send");
      setDockets((prev) => prev.map((d) => (d.id === docket.id ? { ...d, status: "sent" } : d)));
      if (body.warning) setSendError((prev) => ({ ...prev, [docket.id]: body.warning }));
      else setSentId(docket.id);
    } catch (err) {
      setSendError((prev) => ({ ...prev, [docket.id]: err instanceof Error ? err.message : "Could not send" }));
    } finally {
      setSendingId(null);
      setTimeout(() => setSentId((cur) => (cur === docket.id ? null : cur)), 3000);
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold">Dayworks dockets</p>
        <button onClick={() => { setShowForm(true); setError(null); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2.5 py-1">
          <Plus size={12} /> Log a docket
        </button>
      </div>
      <p className="font-semibold text-[var(--ink)] mb-1">Signed, per-day work records</p>

      {unbilledTotal > 0 && (
        <div className="mb-3 space-y-2">
          {signedReady.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[13px] font-semibold text-green-900">
                  ${signedReadyTotal.toLocaleString()} across {signedReady.length} signed docket{signedReady.length === 1 ? "" : "s"} - ready to invoice
                </p>
                <button onClick={bundleToInvoice} disabled={bundling} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold bg-green-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                  {bundling ? <><Loader2 size={12} className="animate-spin" /> Bundling...</> : <><Receipt size={12} /> Bundle into invoice</>}
                </button>
              </div>
              {bundleError && <p className="text-[12px] text-red-600 mt-1.5">{bundleError}</p>}
            </div>
          )}
          {awaitingSignature.length > 0 && (
            <div className="bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-[13px] font-semibold">
              {awaitingSignature.length} docket{awaitingSignature.length === 1 ? "" : "s"} still awaiting signature
            </div>
          )}
        </div>
      )}

      {docketInvoices.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--ink-faint)] mb-1.5">Invoiced</p>
          <div className="space-y-1.5">
            {docketInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between border border-[var(--line)] rounded-lg px-3 py-2 text-[13px]">
                <span className="font-semibold text-[var(--ink)]">{inv.invoice_number}</span>
                <span className="text-[var(--ink-faint)]">
                  {new Date(inv.period_start).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} - {new Date(inv.period_end).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  {" · "}{inv.docket_count} docket{inv.docket_count === 1 ? "" : "s"}
                </span>
                <span className="font-bold text-[var(--ink)]">${inv.total_cost.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--app-bg)] rounded-xl p-3 mb-4 space-y-4">
          {/* Header */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Date of work *</span>
              <input type="date" value={header.work_date} onChange={(e) => setHeader((h) => ({ ...h, work_date: e.target.value }))} className="app-field" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Weather</span>
              <input value={header.weather} onChange={(e) => setHeader((h) => ({ ...h, weather: e.target.value }))} className="app-field" placeholder="e.g. Sunny" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Client / site contact (who&apos;ll sign)</span>
              <input value={header.client_name} onChange={(e) => setHeader((h) => ({ ...h, client_name: e.target.value }))} className="app-field" placeholder="Site supervisor or client name" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Their email (to send for signature)</span>
              <input type="email" value={header.client_email} onChange={(e) => setHeader((h) => ({ ...h, client_email: e.target.value }))} className="app-field" placeholder="supervisor@builder.com.au" />
            </label>
          </div>
          <label className="block">
            <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Description of work</span>
            <textarea value={header.description} onChange={(e) => setHeader((h) => ({ ...h, description: e.target.value }))} rows={2} className="app-field text-[13px]" placeholder="What was done on site today..." />
          </label>

          {/* Labour */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide">Labour</span>
              <button type="button" onClick={addLabourRow} className="text-[12px] font-semibold text-[var(--navy)]">+ Add person</button>
            </div>
            {labourRows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                <select value={row.source_rate_item_id ?? ""} onChange={(e) => e.target.value ? pickLabourCatalogItem(row.key, e.target.value) : setLabourRows((rows) => rows.map((r) => r.key === row.key ? { ...r, source_rate_item_id: null } : r))} className="app-field col-span-4 text-[12.5px]">
                  <option value="">Custom role...</option>
                  {labourCatalog.map((c) => <option key={c.id} value={c.id}>{c.label} (${c.default_rate}/h)</option>)}
                </select>
                {!row.source_rate_item_id && (
                  <input value={row.label} onChange={(e) => setLabourRows((rows) => rows.map((r) => r.key === row.key ? { ...r, label: e.target.value } : r))} placeholder="Role" className="app-field col-span-3 text-[12.5px]" />
                )}
                <input value={row.person_name} onChange={(e) => setLabourRows((rows) => rows.map((r) => r.key === row.key ? { ...r, person_name: e.target.value } : r))} placeholder="Person" className={`app-field text-[12.5px] ${row.source_rate_item_id ? "col-span-4" : "col-span-2"}`} />
                <input type="number" min={0} step={0.25} value={row.quantity} onChange={(e) => setLabourRows((rows) => rows.map((r) => r.key === row.key ? { ...r, quantity: e.target.value } : r))} placeholder="Hrs" className="app-field col-span-2 text-[12.5px]" />
                <input type="number" min={0} value={row.rate} onChange={(e) => setLabourRows((rows) => rows.map((r) => r.key === row.key ? { ...r, rate: e.target.value } : r))} placeholder="$/h" className="app-field col-span-2 text-[12.5px]" />
                <button type="button" onClick={() => setLabourRows((rows) => rows.filter((r) => r.key !== row.key))} className="col-span-1 flex justify-center text-[var(--ink-faint)] hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {/* Plant */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide">Plant &amp; equipment</span>
              <button type="button" onClick={addPlantRow} className="text-[12px] font-semibold text-[var(--navy)]">+ Add item</button>
            </div>
            {plantRows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                <select value={row.source_rate_item_id ?? ""} onChange={(e) => e.target.value ? pickPlantCatalogItem(row.key, e.target.value) : setPlantRows((rows) => rows.map((r) => r.key === row.key ? { ...r, source_rate_item_id: null } : r))} className="app-field col-span-5 text-[12.5px]">
                  <option value="">Custom item...</option>
                  {plantCatalog.map((c) => <option key={c.id} value={c.id}>{c.label} (${c.default_rate}/h)</option>)}
                </select>
                {!row.source_rate_item_id && (
                  <input value={row.label} onChange={(e) => setPlantRows((rows) => rows.map((r) => r.key === row.key ? { ...r, label: e.target.value } : r))} placeholder="Item" className="app-field col-span-4 text-[12.5px]" />
                )}
                <input type="number" min={0} step={0.25} value={row.quantity} onChange={(e) => setPlantRows((rows) => rows.map((r) => r.key === row.key ? { ...r, quantity: e.target.value } : r))} placeholder="Hrs" className={`app-field text-[12.5px] ${row.source_rate_item_id ? "col-span-3" : "col-span-2"}`} />
                <input type="number" min={0} value={row.rate} onChange={(e) => setPlantRows((rows) => rows.map((r) => r.key === row.key ? { ...r, rate: e.target.value } : r))} placeholder="$/h" className="col-span-2 app-field text-[12.5px]" />
                <button type="button" onClick={() => setPlantRows((rows) => rows.filter((r) => r.key !== row.key))} className="col-span-1 flex justify-center text-[var(--ink-faint)] hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {/* Materials */}
          <div>
            <span className="block text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide mb-1.5">Materials</span>
            {materialsCatalog.length > 0 && (
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
                <input value={materialQuery} onChange={(e) => { setMaterialQuery(e.target.value); setMaterialSearchOpen(true); }} onFocus={() => setMaterialSearchOpen(true)} placeholder="Search price book..." className="app-field pl-8 text-[12.5px]" />
                {materialSearchOpen && materialQuery.trim().length >= 2 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {materialResults.length === 0 ? (
                      <p className="text-[12px] text-[var(--ink-faint)] px-3 py-2">No matches.</p>
                    ) : materialResults.map((m) => (
                      <button key={m.item_key} type="button" onClick={() => pickMaterial(m)} className="w-full flex items-center justify-between text-left px-3 py-2 hover:bg-[var(--app-bg)] border-b border-[var(--line)] last:border-0">
                        <span className="text-[12px] text-[var(--ink)] truncate pr-2">{m.label}</span>
                        <span className="text-[12px] font-semibold text-[var(--ink-faint)] whitespace-nowrap">${m.unit_cost}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {materialRows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                <input value={row.label} onChange={(e) => setMaterialRows((rows) => rows.map((r) => r.key === row.key ? { ...r, label: e.target.value } : r))} placeholder="Material" className="app-field col-span-6 text-[12.5px]" />
                <input type="number" min={0} value={row.quantity} onChange={(e) => setMaterialRows((rows) => rows.map((r) => r.key === row.key ? { ...r, quantity: e.target.value } : r))} placeholder="Qty" className="app-field col-span-2 text-[12.5px]" />
                <input type="number" min={0} value={row.rate} onChange={(e) => setMaterialRows((rows) => rows.map((r) => r.key === row.key ? { ...r, rate: e.target.value } : r))} placeholder="$ each" className="app-field col-span-3 text-[12.5px]" />
                <button type="button" onClick={() => setMaterialRows((rows) => rows.filter((r) => r.key !== row.key))} className="col-span-1 flex justify-center text-[var(--ink-faint)] hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {/* Custom / outlier */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold text-[var(--ink-soft)] uppercase tracking-wide">Custom / outlier item</span>
              <button type="button" onClick={addCustomRow} className="text-[12px] font-semibold text-[var(--navy)]">+ Add line</button>
            </div>
            <p className="text-[11.5px] text-[var(--ink-faint)] mb-1.5">For anything one-off that doesn&apos;t fit labour, plant or materials.</p>
            {customRows.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                <input value={row.label} onChange={(e) => setCustomRows((rows) => rows.map((r) => r.key === row.key ? { ...r, label: e.target.value } : r))} placeholder="Description" className="app-field col-span-6 text-[12.5px]" />
                <input type="number" min={0} value={row.quantity} onChange={(e) => setCustomRows((rows) => rows.map((r) => r.key === row.key ? { ...r, quantity: e.target.value } : r))} placeholder="Qty" className="app-field col-span-2 text-[12.5px]" />
                <input type="number" min={0} value={row.rate} onChange={(e) => setCustomRows((rows) => rows.map((r) => r.key === row.key ? { ...r, rate: e.target.value } : r))} placeholder="$ each" className="app-field col-span-3 text-[12.5px]" />
                <button type="button" onClick={() => setCustomRows((rows) => rows.filter((r) => r.key !== row.key))} className="col-span-1 flex justify-center text-[var(--ink-faint)] hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {grandTotal > 0 && <p className="text-[13.5px] font-bold text-[var(--ink)]">Docket total: ${grandTotal.toLocaleString()}</p>}
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={saveDocket} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save docket"}</button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {dockets.length === 0 && !showForm && (
        <p className="text-[13px] text-[var(--ink-faint)] mt-2">No dockets yet. Log one at the end of each day on site.</p>
      )}

      <div className="space-y-2 mt-2">
        {dockets.map((d) => {
          const Icon = STATUS_ICON[d.status];
          const items: DocketItem[] = d.items ?? (d as unknown as { docket_items?: DocketItem[] }).docket_items ?? [];
          const isExpanded = expandedId === d.id;
          return (
            <div key={d.id} className="border border-[var(--line)] rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ink)]">{new Date(d.work_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</p>
                  {d.description && <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5 line-clamp-2">{d.description}</p>}
                  <p className="text-[13px] font-semibold text-[var(--ink)] mt-1">{items.length} line{items.length === 1 ? "" : "s"} - ${d.total_cost.toLocaleString()}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 whitespace-nowrap ${STATUS_STYLE[d.status]}`}>
                  <Icon size={11} />{d.status}
                </span>
              </div>

              {isExpanded && items.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-[var(--line)] pt-2">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-[var(--ink-soft)]">
                        {it.category === "labour" && it.person_name ? `${it.person_name} - ${it.label}` : it.label}
                        {it.category !== "material" && it.category !== "custom" ? ` (${it.quantity}h)` : it.quantity > 1 ? ` x${it.quantity}` : ""}
                      </span>
                      <span className="font-semibold text-[var(--ink)]">${it.line_total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {d.status === "signed" && d.signed_by_name && (
                <p className="text-[11px] text-green-700 mt-1">Signed by {d.signed_by_name}{d.signed_at ? ` on ${new Date(d.signed_at).toLocaleDateString("en-AU")}` : ""} - ready to invoice</p>
              )}
              {(d.status === "draft" || d.status === "sent") && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => sendDocket(d)} disabled={sendingId === d.id} className="inline-flex items-center gap-1 text-[12.5px] font-bold bg-[var(--navy)] text-white rounded-lg px-3 py-1 disabled:opacity-50">
                      {sentId === d.id ? <><Check size={12} /> Sent</> : sendingId === d.id ? "Sending..." : <><Send size={12} /> {d.status === "sent" ? "Resend" : "Send"} for signature</>}
                    </button>
                    <button onClick={() => copyLink(d)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1">
                      {copiedId === d.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                    </button>
                  </div>
                  {sendError[d.id] && <p className="text-[11.5px] text-amber-700 mt-1.5">{sendError[d.id]}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
