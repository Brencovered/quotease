"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Upload, X } from "lucide-react";
import PlanMarkup, { type PlanShape, type CalibrationLine } from "./PlanMarkup";

type Plan = {
  id: string;
  file_name: string;
  storage_path: string;
  label: string | null;
  shapes: PlanShape[];
  calibration: CalibrationLine | null;
  signedUrl?: string;
};

export default function PlansLibraryPanel({ clientId, plans: initial }: { clientId: string; plans: Plan[] }) {
  const [plans,      setPlans]      = useState<Plan[]>(initial);
  const [uploading,  setUploading]  = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setUploading(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${userData.user.id}/plans/${clientId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
    if (uploadError) { setUploading(false); return; }

    const { data: plan } = await supabase
      .from("client_plans")
      .insert({ client_id: clientId, profile_id: businessId, file_name: file.name, storage_path: path })
      .select()
      .single();

    if (plan) {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24 * 7);
      setPlans((prev) => [{ ...plan, shapes: [], calibration: null, signedUrl: signed?.signedUrl }, ...prev]);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleShapesChange(planId: string, shapes: PlanShape[], calibration: CalibrationLine | null) {
    setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, shapes, calibration } : p));
    const supabase = createClient();
    await supabase.from("client_plans").update({ shapes, calibration }).eq("id", planId);
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
            <button key={p.id} onClick={() => setOpenPlanId(p.id)}
              className="aspect-square rounded-lg overflow-hidden border border-[var(--line)] relative bg-[var(--app-bg)] hover:border-[var(--navy)] transition-colors">
              {p.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.signedUrl} alt={p.file_name} className="w-full h-full object-cover" />
              )}
              {p.shapes.length > 0 && (
                <span className="absolute top-1 right-1 bg-[var(--amber)] text-[var(--navy)] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {p.shapes.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {openPlan && openPlan.signedUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-3 overflow-y-auto" onClick={() => setOpenPlanId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-[var(--ink)] truncate">{openPlan.file_name}</p>
              <button onClick={() => setOpenPlanId(null)} className="text-[var(--ink-faint)] shrink-0 ml-2"><X size={18} /></button>
            </div>
            <PlanMarkup
              imageUrl={openPlan.signedUrl}
              shapes={openPlan.shapes}
              calibration={openPlan.calibration}
              onShapesChange={(shapes) => handleShapesChange(openPlan.id, shapes, openPlan.calibration)}
              onCalibrationChange={(cal) => handleShapesChange(openPlan.id, openPlan.shapes, cal)}
              materials={[]}
              marginPct={20}
            />
          </div>
        </div>
      )}
    </div>
  );
}
