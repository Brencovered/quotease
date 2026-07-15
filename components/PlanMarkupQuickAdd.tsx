"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import PlanMarkup, { type PlanShape, type CalibrationLine, type MaterialItem } from "./PlanMarkup";

/**
 * "Mark up a plan" as a direct option inside quote creation, not a separate
 * step reached via the standalone Plans library. Deliberately does not
 * write to client_plans here - this quote doesn't have a resolved client_id
 * yet at this point in the wizard (that only happens via resolveClientId at
 * save time), so there's nothing to attach a persistent plan record to.
 * Instead: pick a file, mark it up entirely client-side (PlanMarkup only
 * needs an image URL, a local object URL works fine), convert the shapes
 * straight into quote line items - same shapesToMarkupItems conversion the
 * standalone Plans page uses - and hand the original file back up so it
 * gets uploaded through the same "Files" mechanism as any other drawing,
 * i.e. saved with the job like everything else at this step, not floating
 * in its own library.
 */

function shapesToItems(shapes: PlanShape[]) {
  return shapes
    .filter((s) => s.material_label || s.label)
    .map((s) => ({
      label: s.material_label || s.label,
      quantity: s.qty,
      unit: s.unit,
      totalCost: Math.round(s.qty * s.unit_cost * (1 + s.margin_pct / 100)),
    }));
}

export default function PlanMarkupQuickAdd({
  lib, marginPct, trade, onAddItems, onFileReady,
}: {
  lib: MaterialItem[];
  marginPct: number;
  trade?: string;
  onAddItems: (items: { label: string; quantity: number; unit: string; totalCost: number }[]) => void;
  onFileReady: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [shapes, setShapes] = useState<PlanShape[]>([]);
  const [calibration, setCalibration] = useState<CalibrationLine | null>(null);
  const [open, setOpen] = useState(false);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setShapes([]);
    setCalibration(null);
    setOpen(true);
  }

  function addToQuote() {
    if (shapes.length > 0) onAddItems(shapesToItems(shapes));
    if (file) onFileReady(file);
    setOpen(false);
    setFile(null);
    setImageUrl(null);
  }

  function cancel() {
    setOpen(false);
    setFile(null);
    setImageUrl(null);
    setShapes([]);
    setCalibration(null);
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Or mark up a plan</p>
      <p className="font-semibold text-[var(--ink)] text-[17px] mb-1">Trace over a floor plan</p>
      <p className="text-[13px] text-[var(--ink-faint)] mb-4">Upload a plan and draw directly on it to measure and price runs, rooms, or fixtures - the marked-up items go straight into this quote.</p>

      {!open && (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-8 cursor-pointer hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
          <Paperclip size={18} className="text-[var(--ink-faint)]" />
          <span className="text-[14px] font-semibold text-[var(--ink-soft)]">Tap to upload a plan to mark up</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      )}

      {open && imageUrl && (
        <div className="space-y-3">
          <PlanMarkup
            imageUrl={imageUrl}
            shapes={shapes}
            calibration={calibration}
            onShapesChange={setShapes}
            onCalibrationChange={setCalibration}
            materials={lib}
            marginPct={marginPct}
            trade={trade}
          />
          <div className="flex items-center gap-2">
            <button onClick={addToQuote} className="btn-primary flex-1">
              Add {shapes.length > 0 ? `${shapes.length} item${shapes.length > 1 ? "s" : ""} ` : ""}to quote
            </button>
            <button onClick={cancel} className="p-2.5 rounded-xl border-2 border-[var(--line)] text-[var(--ink-faint)] hover:text-[var(--ink)]" aria-label="Cancel">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
