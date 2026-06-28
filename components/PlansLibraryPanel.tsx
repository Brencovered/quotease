"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, X } from "lucide-react";
import PlanMarkup, { type PlanAnnotation } from "./PlanMarkup";

type Plan = { id: string; file_name: string; storage_path: string; label: string | null; annotations: PlanAnnotation[]; signedUrl?: string };

export default function PlansLibraryPanel({ clientId, plans: initial }: { clientId: string; plans: Plan[] }) {
  const [plans, setPlans] = useState<Plan[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setUploading(false); return; }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${userData.user.id}/plans/${clientId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) { setUploading(false); return; }

    const { data: plan } = await supabase
      .from("client_plans")
      .insert({ client_id: clientId, profile_id: userData.user.id, file_name: file.name, storage_path: path })
      .select()
      .single();

    if (plan) {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24 * 7);
      setPlans((prev) => [{ ...plan, signedUrl: signed?.signedUrl }, ...prev]);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function updateAnnotations(planId: string, annotations: PlanAnnotation[]) {
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, annotations } : p)));
    const supabase = createClient();
    await supabase.from("client_plans").update({ annotations }).eq("id", planId);
  }

  const openPlan = plans.find((p) => p.id === openPlanId);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <p className="section-tag">Plans &amp; drawings</p>
        <label className="btn-secondary text-[12px] py-1.5 px-3 cursor-pointer">
          <Upload size={12} /> {uploading ? "Uploading..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Upload once - every future quote and job for this client can reuse and mark up the same plan.
      </p>

      {plans.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] py-2">No plans uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPlanId(p.id)}
              className="aspect-square rounded-lg overflow-hidden border border-[var(--line)] relative bg-[var(--app-bg)]"
            >
              {p.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.signedUrl} alt={p.file_name} className="w-full h-full object-cover" />
              )}
              {p.annotations.length > 0 && (
                <span className="absolute top-1 right-1 bg-[var(--amber)] text-[var(--navy)] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {p.annotations.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {openPlan && openPlan.signedUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpenPlanId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-4 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-[var(--ink)] truncate">{openPlan.file_name}</p>
              <button onClick={() => setOpenPlanId(null)} className="text-[var(--ink-faint)] shrink-0"><X size={18} /></button>
            </div>
            <PlanMarkup
              imageUrl={openPlan.signedUrl}
              annotations={openPlan.annotations}
              onAnnotationsChange={(next) => updateAnnotations(openPlan.id, next)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
