"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { X, FileImage, Upload, Check } from "lucide-react";
import PlanMarkup, { type PlanShape, type CalibrationLine, type MaterialItem } from "./PlanMarkup";

type Plan = {
  id: string;
  file_name: string;
  shapes: PlanShape[];
  calibration: CalibrationLine | null;
  signedUrl?: string;
};

export default function JobPlansPanel({
  quoteId,
  clientId,
  plans: initial,
  materials,
  marginPct,
  trade,
}: {
  quoteId: string;
  clientId: string | null;
  plans: Plan[];
  materials: MaterialItem[];
  marginPct: number;
  trade?: string;
}) {
  const [plans,       setPlans]       = useState<Plan[]>(initial);
  const [openPlanId,  setOpenPlanId]  = useState<string | null>(null);
  const [savedMsg,    setSavedMsg]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setUploadError("Not signed in"); return; }
      const businessId = await getActiveBusinessId(supabase, userData.user.id);

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${userData.user.id}/plans/${clientId ?? "no-client"}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("job-files").upload(path, file);
      if (uploadErr) { setUploadError(uploadErr.message); return; }

      // Scoped to this quote (and therefore this job, since a job always
      // has exactly one originating quote) - not the client as a whole,
      // so this plan only ever shows up here, not on every other job this
      // same client happens to have.
      const { data: plan, error: insertErr } = await supabase
        .from("client_plans")
        .insert({ quote_id: quoteId, client_id: clientId, profile_id: businessId, file_name: file.name, storage_path: path })
        .select()
        .single();
      if (insertErr) { setUploadError(insertErr.message); return; }

      if (plan) {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600 * 24);
        setPlans((prev) => [{ ...plan, shapes: [], calibration: null, signedUrl: signed?.signedUrl }, ...prev]);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const save = useCallback(async (planId: string, shapes: PlanShape[], calibration: CalibrationLine | null) => {
    const supabase = createClient();
    await supabase.from("client_plans")
      .update({ annotations: shapes, calibration })
      .eq("id", planId);
  }, []);

  function shapesToMarkupItems(shapes: PlanShape[]) {
    return shapes
      .filter((s) => s.material_label || s.label)
      .map((s) => ({
        label: s.material_label || s.label,
        quantity: s.qty,
        unit: s.unit,
        // Raw cost only, no per-shape margin baked in - the quote's own
        // effective margin applies once, uniformly, wherever this total
        // gets used downstream.
        unitCost: s.unit_cost,
        totalCost: Math.round(s.qty * s.unit_cost),
      }));
  }

  async function handleShapesChange(planId: string, shapes: PlanShape[], cal: CalibrationLine | null) {
    // Update local state
    setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, shapes, calibration: cal } : p));
    // Persist shapes to plan
    await save(planId, shapes, cal);
    // Roll up itemized materials across ALL plans on this job (not just
    // the one just edited) and push the full array to the quote's
    // markup_materials - the shape every reader of this field expects
    // (Xero sync, invoice PDF, quote/job detail pages). Overwriting this
    // with a bare rolled-up number instead of an array silently broke
    // all of those.
    const allShapes = plans.map((p) => p.id === planId ? { ...p, shapes } : p).flatMap(p => p.shapes);
    const items = shapesToMarkupItems(allShapes);
    const total = items.reduce((s, i) => s + i.totalCost, 0);
    const supabase = createClient();
    await supabase.from("quotes").update({ markup_materials: items }).eq("id", quoteId);
    setSavedMsg(`Drawing costs updated: $${total.toLocaleString()}`);
    setTimeout(() => setSavedMsg(null), 3000);
  }

  const openPlan = plans.find((p) => p.id === openPlanId);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <p className="section-tag">Site plans</p>
        <label className="btn-secondary text-[12px] py-1.5 px-3 cursor-pointer">
          <Upload size={12} /> {uploading ? "Uploading..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      <p className="font-semibold text-[var(--ink)] mb-1">Mark up drawings and build your materials list</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Drop pins, trace cable runs or outline areas. Link each shape to a material from your library and the cost feeds into this quote automatically.
      </p>
      {uploadError && <p className="text-[12.5px] text-[var(--red)] mb-3">{uploadError}</p>}

      {plans.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] flex items-center gap-2">
          <FileImage size={14} /> No plans on this job yet - upload one above.
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {plans.map((p) => (
            <button key={p.id} onClick={() => setOpenPlanId(p.id)}
              className="aspect-square rounded-lg overflow-hidden border-2 border-[var(--line)] relative bg-[var(--app-bg)] hover:border-[var(--navy)] transition-colors">
              {p.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.signedUrl} alt={p.file_name} className="w-full h-full object-cover" />
              )}
              {p.shapes.length > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--amber)] text-[var(--navy)] text-[9px] font-bold flex items-center justify-center">
                  {p.shapes.length}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {savedMsg && (
        <p className="text-[12.5px] text-[var(--green)] font-semibold mt-3 flex items-center gap-1.5">
          <Check size={13} /> {savedMsg}
        </p>
      )}

      {/* Markup modal */}
      {openPlan && openPlan.signedUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-3 overflow-y-auto"
          onClick={() => setOpenPlanId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-2xl my-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-[var(--ink)] truncate">{openPlan.file_name}</p>
              <button onClick={() => setOpenPlanId(null)} className="text-[var(--ink-faint)] shrink-0 ml-2">
                <X size={18} />
              </button>
            </div>
            <PlanMarkup
              imageUrl={openPlan.signedUrl}
              shapes={openPlan.shapes}
              calibration={openPlan.calibration}
              onShapesChange={(shapes) => handleShapesChange(openPlan.id, shapes, openPlan.calibration)}
              onCalibrationChange={(cal) => handleShapesChange(openPlan.id, openPlan.shapes, cal)}
              materials={materials}
              marginPct={marginPct}
              trade={trade}
            />
          </div>
        </div>
      )}
    </div>
  );
}
