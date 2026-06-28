"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PlanMarkup, { type PlanShape, type CalibrationLine, type MaterialItem } from "./PlanMarkup";
import { Upload, X, Plus, FileText, Briefcase, ChevronRight, Check } from "lucide-react";

type Client = { id: string; name: string; address: string | null };
type Plan   = { id: string; client_id: string; file_name: string; storage_path: string; shapes: PlanShape[]; calibration: CalibrationLine | null; signedUrl: string | null };
type Quote  = { id: string; client_id: string | null; client_name: string | null; site_address: string | null; status: string; total_cost: number | null; trade: string | null };

export default function PlansPageClient({
  clients, plans: initial, materials, marginPct, openQuotes,
}: {
  clients: Client[];
  plans: Plan[];
  materials: MaterialItem[];
  marginPct: number;
  openQuotes: Quote[];
}) {
  const router = useRouter();
  const [plans,       setPlans]       = useState<Plan[]>(initial);
  const [openPlanId,  setOpenPlanId]  = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadFor,   setUploadFor]   = useState<string | null>(null); // client_id
  const [linking,     setLinking]     = useState(false);
  const [linkedMsg,   setLinkedMsg]   = useState<string | null>(null);
  const [totalCost,   setTotalCost]   = useState<Record<string, number>>({}); // planId -> cost

  const openPlan = plans.find(p => p.id === openPlanId);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, clientId: string) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/plans/${clientId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("job-files").upload(path, file);
    if (error) { setUploading(false); return; }
    const { data: plan } = await supabase.from("client_plans")
      .insert({ client_id: clientId, profile_id: user.id, file_name: file.name, storage_path: path })
      .select().single();
    if (plan) {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24);
      setPlans(prev => [{ ...plan, shapes: [], calibration: null, signedUrl: signed?.signedUrl ?? null }, ...prev]);
    }
    setUploading(false); setUploadFor(null);
    e.target.value = "";
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

  async function raiseNewQuote(clientId: string, planCost: number) {
    // Navigate to new quote page with client pre-selected
    router.push(`/electrician?client_id=${clientId}&markup_materials=${planCost}`);
  }

  // Group plans by client
  const byClient: Record<string, Plan[]> = {};
  for (const p of plans) {
    if (!byClient[p.client_id]) byClient[p.client_id] = [];
    byClient[p.client_id].push(p);
  }

  // Clients with no plans yet
  const clientsWithPlans  = new Set(Object.keys(byClient));
  const clientsWithoutPlans = clients.filter(c => !clientsWithPlans.has(c.id));

  const planCost = openPlanId ? (totalCost[openPlanId] ?? 0) : 0;
  const clientQuotes = openPlan ? openQuotes.filter(q => q.client_id === openPlan.client_id) : [];

  return (
    <div className="space-y-6">

      {/* Empty state */}
      {plans.length === 0 && clients.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-[var(--ink-faint)] text-[14px] mb-2">No plans yet.</p>
          <p className="text-[13px] text-[var(--ink-faint)]">Add clients first, then upload their site plans here.</p>
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
                {client?.address && <p className="text-[12px] text-[var(--ink-faint)]">{client.address}</p>}
              </div>
              <label className="btn-secondary text-[12px] py-1.5 cursor-pointer">
                <Upload size={12} /> Upload plan
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => handleUpload(e, clientId)} disabled={uploading} />
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {clientPlans.map(p => (
                <button key={p.id} onClick={() => setOpenPlanId(p.id)}
                  className="aspect-square rounded-xl overflow-hidden border-2 border-[var(--line)] relative bg-[var(--app-bg)] hover:border-[var(--navy)] transition-colors group">
                  {p.signedUrl
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

      {/* Upload for clients without plans */}
      {clientsWithoutPlans.length > 0 && (
        <div className="card">
          <p className="section-tag mb-2">Upload a plan for a client</p>
          <div className="space-y-2">
            {clientsWithoutPlans.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--line-subtle)] last:border-0">
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">{c.name}</span>
                <label className="btn-secondary text-[12px] py-1.5 cursor-pointer">
                  <Upload size={12} /> Upload
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => handleUpload(e, c.id)} disabled={uploading} />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markup modal */}
      {openPlan && openPlan.signedUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 overflow-y-auto" onClick={() => setOpenPlanId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
              <div>
                <p className="font-bold text-[var(--ink)]">{openPlan.file_name}</p>
                <p className="text-[12px] text-[var(--ink-faint)]">{clients.find(c => c.id === openPlan.client_id)?.name}</p>
              </div>
              <button onClick={() => setOpenPlanId(null)} className="text-[var(--ink-faint)] ml-2"><X size={18} /></button>
            </div>

            {/* Markup canvas */}
            <div className="p-4">
              <PlanMarkup
                imageUrl={openPlan.signedUrl}
                shapes={openPlan.shapes}
                calibration={openPlan.calibration}
                onShapesChange={(shapes) => saveShapes(openPlan.id, shapes, openPlan.calibration)}
                onCalibrationChange={(cal) => saveShapes(openPlan.id, openPlan.shapes, cal)}
                materials={materials}
                marginPct={marginPct}
                onCostChange={(cost) => setTotalCost(prev => ({ ...prev, [openPlan.id]: cost }))}
              />
            </div>

            {/* Quote actions footer */}
            <div className="border-t border-[var(--line)] p-4 bg-[var(--app-bg)] rounded-b-2xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-3">
                {planCost > 0 ? `$${planCost.toLocaleString()} in drawing costs` : "No costs marked up yet"}
              </p>

              <div className="space-y-2">

                {/* Add to existing quote */}
                {clientQuotes.length > 0 && (
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--ink-soft)] mb-1.5">Add drawing costs to an existing quote or job:</p>
                    {clientQuotes.map(q => (
                      <button key={q.id}
                        onClick={() => planCost > 0 && addToQuote(q.id, planCost)}
                        disabled={planCost === 0 || linking}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--line)] hover:border-[var(--navy)] bg-white disabled:opacity-40 transition-colors mb-1.5 text-left">
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
                  onClick={() => raiseNewQuote(openPlan.client_id, planCost)}
                  className="btn-primary w-full justify-center">
                  <Plus size={15} /> Raise new quote from this plan
                </button>

                {linkedMsg && (
                  <p className="text-[12.5px] text-[var(--green)] font-semibold flex items-center gap-1.5 justify-center">
                    <Check size={13} /> {linkedMsg}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
