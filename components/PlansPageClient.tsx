"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PlanMarkup, { type PlanShape, type CalibrationLine, type MaterialItem } from "./PlanMarkup";
import { Upload, X, Plus, FileText, ChevronRight, Check, User } from "lucide-react";

type Client = { id: string; name: string; billing_address: string | null };
type Plan   = { id: string; client_id: string; file_name: string; storage_path: string; shapes: PlanShape[]; calibration: CalibrationLine | null; signedUrl: string | null };
type Quote  = { id: string; client_id: string | null; client_name: string | null; site_address: string | null; status: string; total_cost: number | null; trade: string | null };
type MatWithTrade = MaterialItem & { trade: string };

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician", plumber: "Plumber", carpenter: "Carpenter",
  roofer: "Roofer", painter: "Painter", tiler: "Tiler", landscaper: "Landscaper",
  arborist: "Arborist", concreter: "Concreter", fencer: "Fencer",
  aircon: "Air conditioning", surveyor: "Surveyor", custom: "Custom",
};

export default function PlansPageClient({
  clients: initialClients, plans: initial, materials: allMaterials, marginPct, openQuotes, trades,
}: {
  clients: Client[];
  plans: Plan[];
  materials: MatWithTrade[];
  marginPct: number;
  openQuotes: Quote[];
  trades: string[];
}) {
  const router = useRouter();
  const [plans,        setPlans]        = useState<Plan[]>(initial);
  const [clients,      setClients]      = useState<Client[]>(initialClients);
  const [openPlanId,   setOpenPlanId]   = useState<string | null>(null);

  const [linking,      setLinking]      = useState(false);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [linkedMsg,    setLinkedMsg]    = useState<string | null>(null);
  const [totalCost,    setTotalCost]    = useState<Record<string, number>>({});
  const [activeTrade,  setActiveTrade]  = useState<string>(trades[0] ?? 'electrician');

  // Quick upload flow state
  const [showUpload,   setShowUpload]   = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddr, setNewClientAddr] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("__new__");
  const [uploadFile,   setUploadFile]   = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openPlan = plans.find(p => p.id === openPlanId);
  const planCost = openPlanId ? (totalCost[openPlanId] ?? 0) : 0;
  const clientQuotes = openPlan ? openQuotes.filter(q => q.client_id === openPlan.client_id) : [];
  const tradeMaterials = allMaterials.filter(m => m.trade === activeTrade);

  async function submitUpload() {
    if (!uploadFile) return;
    setUploadSaving(true); setUploadError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError("Not signed in"); setUploadSaving(false); return; }

    let clientId = selectedClientId;
    if (selectedClientId === "__new__") {
      if (!newClientName.trim()) { setUploadError("Enter a client name"); setUploadSaving(false); return; }
      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({ profile_id: user.id, name: newClientName.trim(), billing_address: newClientAddr.trim() || null })
        .select().single();
      if (clientErr || !newClient) { setUploadError(clientErr?.message ?? "Failed to create client"); setUploadSaving(false); return; }
      clientId = newClient.id;
      setClients(prev => [...prev, newClient]);
    }

    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/plans/${clientId}/${Date.now()}-${safeName}`;
    const { error: storageErr } = await supabase.storage.from("job-files").upload(path, uploadFile);
    if (storageErr) { setUploadError(storageErr.message); setUploadSaving(false); return; }

    const { data: plan, error: planErr } = await supabase.from("client_plans")
      .insert({ client_id: clientId, profile_id: user.id, file_name: uploadFile.name, storage_path: path })
      .select().single();
    if (planErr || !plan) { setUploadError(planErr?.message ?? "Failed to save plan"); setUploadSaving(false); return; }

    const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24);
    const newPlan = { ...plan, shapes: [], calibration: null, signedUrl: signed?.signedUrl ?? null };
    setPlans(prev => [newPlan, ...prev]);
    setOpenPlanId(newPlan.id);
    setUploadSaving(false); setShowUpload(false);
    setUploadFile(null); setNewClientName(""); setNewClientAddr(""); setSelectedClientId("__new__");
  }

  async function saveShapes(planId: string, shapes: PlanShape[], calibration: CalibrationLine | null) {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, shapes, calibration } : p));
    const supabase = createClient();
    await supabase.from("client_plans").update({ shapes, calibration }).eq("id", planId);
  }

  async function addToQuote(quoteId: string, cost: number) {
    setLinking(true);
    const supabase = createClient();
    await supabase.from("quotes").update({ markup_materials: cost }).eq("id", quoteId);
    setLinkedMsg(`Drawing costs ($${cost.toLocaleString()}) added to quote`);
    setLinking(false);
    setTimeout(() => setLinkedMsg(null), 3000);
  }

  // Group plans by client
  const byClient: Record<string, Plan[]> = {};
  for (const p of plans) {
    if (!byClient[p.client_id]) byClient[p.client_id] = [];
    byClient[p.client_id].push(p);
  }

  return (
    <div className="space-y-5">

      {/* Upload CTA - always visible at top */}
      {!showUpload ? (
        <button onClick={() => setShowUpload(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[var(--amber)] rounded-2xl py-6 text-[14px] font-bold text-[var(--amber-deep)] hover:bg-[var(--amber-light)] transition-colors">
          <Upload size={18} /> Upload a plan or drawing
        </button>
      ) : (
        <div className="card border-2 border-[var(--amber)]/40">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-[15px] text-[var(--ink)]">Upload a plan</p>
            <button onClick={() => setShowUpload(false)} className="text-[var(--ink-faint)]"><X size={16} /></button>
          </div>

          {/* File picker */}
          <div className="mb-4">
            <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 cursor-pointer transition-colors ${uploadFile ? "border-[var(--green)] bg-[var(--green-bg)]" : "border-[var(--line)] hover:border-[var(--navy)]"}`}>
              <Upload size={20} className={uploadFile ? "text-[var(--green)]" : "text-[var(--ink-faint)]"} />
              <span className="text-[13.5px] font-semibold text-[var(--ink-soft)]">
                {uploadFile ? uploadFile.name : "Tap to choose a file"}
              </span>
              <span className="text-[11px] text-[var(--ink-faint)]">JPG, PNG or PDF</span>
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Client */}
          <div className="mb-3">
            <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Client</label>
            <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="app-field">
              <option value="__new__">+ New client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedClientId === "__new__" && (
            <div className="space-y-2 mb-4 bg-[var(--app-bg)] rounded-xl p-3 border border-[var(--line)]">
              <div className="flex items-center gap-2 mb-1">
                <User size={13} className="text-[var(--ink-faint)]" />
                <span className="text-[12px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">New client</span>
              </div>
              <input value={newClientName} onChange={e => setNewClientName(e.target.value)}
                className="app-field" placeholder="Client name (required)" />
              <input value={newClientAddr} onChange={e => setNewClientAddr(e.target.value)}
                className="app-field" placeholder="Address (optional - shows on quotes)" />
            </div>
          )}

          {uploadError && (
            <div className="mb-3 bg-[var(--red-bg)] border border-red-200 rounded-xl px-4 py-3 text-[13px] text-[var(--red)] font-semibold">
              {uploadError}
            </div>
          )}

          <button
            onClick={submitUpload}
            disabled={uploadSaving || !uploadFile || (selectedClientId === "__new__" && !newClientName.trim())}
            className="btn-primary w-full justify-center">
            {uploadSaving ? "Uploading..." : "Upload and start marking up"}
          </button>
        </div>
      )}

      {/* Plans grouped by client */}
      {Object.entries(byClient).map(([clientId, clientPlans]) => {
        const client = clients.find(c => c.id === clientId);
        return (
          <div key={clientId} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[15px] text-[var(--ink)]">{client?.name ?? "Unknown client"}</p>
                {client?.billing_address && <p className="text-[12px] text-[var(--ink-faint)]">{client.billing_address}</p>}
              </div>
              <label className="btn-secondary text-[12px] py-1.5 cursor-pointer">
                <Upload size={12} /> Add plan
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploadFile(file);
                    setSelectedClientId(clientId);
                    // Auto-submit for existing client
                    setUploadSaving(true);
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) { setUploadSaving(false); return; }
                    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
                    const path = `${user.id}/plans/${clientId}/${Date.now()}-${safeName}`;
                    await supabase.storage.from("job-files").upload(path, file);
                    const { data: plan } = await supabase.from("client_plans")
                      .insert({ client_id: clientId, profile_id: user.id, file_name: file.name, storage_path: path })
                      .select().single();
                    if (plan) {
                      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24);
                      const newPlan = { ...plan, shapes: [], calibration: null, signedUrl: signed?.signedUrl ?? null };
                      setPlans(prev => [newPlan, ...prev]);
                      setOpenPlanId(newPlan.id);
                    }
                    setUploadSaving(false);
                    e.target.value = "";
                  }} />
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {clientPlans.map(p => (
                <button key={p.id} onClick={() => setOpenPlanId(p.id)}
                  className="aspect-square rounded-xl overflow-hidden border-2 border-[var(--line)] relative bg-[var(--app-bg)] hover:border-[var(--navy)] transition-colors group">
                  {p.signedUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.signedUrl} alt={p.file_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[var(--ink-faint)]"><FileText size={20} /></div>
                  }
                  {p.shapes.length > 0 && (
                    <span className="absolute top-1 right-1 bg-[var(--amber)] text-[var(--navy)] text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {p.shapes.length}
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[9px] text-white truncate">{p.file_name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {plans.length === 0 && !showUpload && (
        <div className="text-center py-4">
          <p className="text-[13px] text-[var(--ink-faint)]">No plans yet - tap the button above to upload your first one.</p>
        </div>
      )}

      {/* Markup modal */}
      {openPlan && openPlan.signedUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 overflow-y-auto" onClick={() => setOpenPlanId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
              <div>
                <p className="font-bold text-[var(--ink)]">{openPlan.file_name}</p>
                <p className="text-[12px] text-[var(--ink-faint)]">{clients.find(c => c.id === openPlan.client_id)?.name}</p>
              </div>
              <button onClick={() => setOpenPlanId(null)} className="text-[var(--ink-faint)] ml-2"><X size={18} /></button>
            </div>

            <div className="p-4">
              {/* Trade selector */}
              {trades.length > 1 && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[11.5px] font-semibold text-[var(--ink-soft)]">Drawing as:</span>
                  {trades.map(t => (
                    <button key={t} onClick={() => setActiveTrade(t)}
                      className={`px-3 py-1 rounded-lg text-[12px] font-bold border transition-colors ${
                        activeTrade === t ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "border-[var(--line)] text-[var(--ink-soft)]"
                      }`}>
                      {TRADE_LABELS[t] ?? t}
                    </button>
                  ))}
                </div>
              )}
              <PlanMarkup
                imageUrl={openPlan.signedUrl}
                shapes={openPlan.shapes}
                calibration={openPlan.calibration}
                onShapesChange={(shapes) => saveShapes(openPlan.id, shapes, openPlan.calibration)}
                onCalibrationChange={(cal) => saveShapes(openPlan.id, openPlan.shapes, cal)}
                materials={tradeMaterials}
                marginPct={marginPct}
                trade={activeTrade}
                onCostChange={(cost) => setTotalCost(prev => ({ ...prev, [openPlan.id]: cost }))}
              />
            </div>

            {/* Quote actions */}
            <div className="border-t border-[var(--line)] p-4 bg-[var(--app-bg)] rounded-b-2xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Drawing costs</p>
                <p className="font-display text-[20px] text-[var(--amber)]">${planCost.toLocaleString()}</p>
              </div>

              {/* Attach to existing quote */}
              {clientQuotes.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold text-[var(--ink-soft)] mb-2">Add to existing quote or job:</p>
                  {clientQuotes.map(q => (
                    <button key={q.id}
                      onClick={() => planCost > 0 && addToQuote(q.id, planCost)}
                      disabled={planCost === 0 || linking}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--line)] hover:border-[var(--navy)] bg-white disabled:opacity-40 transition-colors mb-2 text-left">
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--ink)]">{q.client_name} - {q.site_address}</p>
                        <p className="text-[11px] text-[var(--ink-faint)] capitalize">{q.status} - ${(q.total_cost ?? 0).toLocaleString()}</p>
                      </div>
                      <ChevronRight size={16} className="text-[var(--ink-faint)] shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Raise new quote */}
              <button
                onClick={() => router.push(`/electrician?client_id=${openPlan.client_id}&markup_materials=${planCost}`)}
                className="btn-primary w-full justify-center">
                <Plus size={15} /> Raise a new quote from this plan
              </button>

              {linkedMsg && (
                <p className="text-[12.5px] text-[var(--green)] font-semibold flex items-center gap-1.5 justify-center">
                  <Check size={13} /> {linkedMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
