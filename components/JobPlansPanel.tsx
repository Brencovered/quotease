"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, FileImage } from "lucide-react";
import PlanMarkup, { type PlanAnnotation } from "./PlanMarkup";

type Plan = { id: string; file_name: string; annotations: PlanAnnotation[]; signedUrl?: string };

export default function JobPlansPanel({ quoteId, clientId, plans: initial }: { quoteId: string; clientId: string | null; plans: Plan[] }) {
  const [plans, setPlans] = useState<Plan[]>(initial);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  async function updateAnnotations(planId: string, annotations: PlanAnnotation[]) {
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, annotations } : p)));
    const supabase = createClient();
    await supabase.from("client_plans").update({ annotations }).eq("id", planId);
  }

  async function addToChecklist(text: string) {
    const supabase = createClient();
    const { data: quote } = await supabase.from("quotes").select("materials_checklist").eq("id", quoteId).single();
    const current = (quote?.materials_checklist as Array<{ label: string; checked: boolean }>) ?? [];
    const next = [...current, { label: text, checked: false }];
    await supabase.from("quotes").update({ materials_checklist: next }).eq("id", quoteId);
    setAddedMessage(`Added "${text}" to materials checklist`);
    setTimeout(() => setAddedMessage(null), 3000);
  }

  if (!clientId) return null;
  const openPlan = plans.find((p) => p.id === openPlanId);

  return (
    <div className="card">
      <p className="section-tag mb-1">Site plans</p>
      <p className="font-semibold text-[var(--ink)] mb-1">From this client&apos;s plan library</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Mark up a plan and add notes straight into this job&apos;s materials checklist - no need to leave the page.
      </p>

      {plans.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] flex items-center gap-2">
          <FileImage size={14} /> No plans on file for this client yet - upload one from their client page.
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
            </button>
          ))}
        </div>
      )}

      {addedMessage && (
        <p className="text-[12.5px] text-[var(--green)] font-semibold mt-3">{addedMessage}</p>
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
              onAddToChecklist={addToChecklist}
            />
          </div>
        </div>
      )}
    </div>
  );
}
