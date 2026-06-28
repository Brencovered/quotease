"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, FileImage, Check } from "lucide-react";
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
}: {
  quoteId: string;
  clientId: string | null;
  plans: Plan[];
  materials: MaterialItem[];
  marginPct: number;
}) {
  const [plans,       setPlans]       = useState<Plan[]>(initial);
  const [openPlanId,  setOpenPlanId]  = useState<string | null>(null);
  const [savedMsg,    setSavedMsg]    = useState<string | null>(null);

  const save = useCallback(async (planId: string, shapes: PlanShape[], calibration: CalibrationLine | null) => {
    const supabase = createClient();
    await supabase.from("client_plans")
      .update({ annotations: shapes, calibration })
      .eq("id", planId);
  }, []);

  async function handleShapesChange(planId: string, shapes: PlanShape[], cal: CalibrationLine | null) {
    // Update local state
    setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, shapes, calibration: cal } : p));
    // Persist shapes to plan
    await save(planId, shapes, cal);
    // Roll up total across all plans and push to quote
    const allShapes = plans.map((p) => p.id === planId ? { ...p, shapes } : p).flatMap(p => p.shapes);
    const total = allShapes.reduce((s, sh) => s + Math.round(sh.qty * sh.unit_cost * (1 + sh.margin_pct / 100)), 0);
    const supabase = createClient();
    await supabase.from("quotes").update({ markup_materials: total }).eq("id", quoteId);
    setSavedMsg(`Drawing costs updated: $${total.toLocaleString()}`);
    setTimeout(() => setSavedMsg(null), 3000);
  }

  if (!clientId) return null;
  const openPlan = plans.find((p) => p.id === openPlanId);

  return (
    <div className="card">
      <p className="section-tag mb-1">Site plans</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Mark up drawings and build your materials list</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Drop pins, trace cable runs or outline areas. Link each shape to a material from your library and the cost feeds into this quote automatically.
      </p>

      {plans.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] flex items-center gap-2">
          <FileImage size={14} /> No plans on file for this client yet - upload one from their client page.
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
