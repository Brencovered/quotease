"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronUp, Plus, Trash2, PenLine, Image, FileText, MessageSquare, Maximize2, Camera, SquareCheck, Phone, ArrowRight, Loader2, PlusCircle, X } from "lucide-react";

// -- Types -----------------------------------------------------------

export interface JobDetail {
  id: string;
  area: number;
  pitchType: "low" | "medium" | "steep";
  roofStyle: "gable" | "hip" | "flat" | "complex";
  description: string;
  photos: File[];
  photosLoaded: boolean;
  voiceNote?: File;
  annotations: string[];
}

export interface Measurements {
  totalArea: number;
  pitchFactor: number;
  ridgeLength: number;
  valleyCount: number;
  flashingLength: number;
}

export type LabourRate = "standard" | "complex" | "heritage";

export type MaterialType = "colourbond" | "concrete_tile" | "terracotta" | "slate" | "zinc";

export type ColorPreference = "basalt" | "surfmist" | "monument" | "dune" | "other";

export type ExtrasKey = "insulation" | "gutter_replacement" | "sarking" | "whirlybird" | "skylight";

export interface ExtrasState {
  insulation: boolean;
  gutter_replacement: boolean;
  sarking: boolean;
  whirlybird: boolean;
  skylight: boolean;
}

export type PricingTier = "standard" | "premium";

// -- Constants -------------------------------------------------------

export const RATES: Record<LabourRate, { label: string; rate: number; min: number }> = {
  standard: { label: "Standard ($55/m\u00B2)", rate: 55, min: 2000 },
  complex:  { label: "Complex access ($70/m\u00B2)", rate: 70, min: 3000 },
  heritage: { label: "Heritage slate ($95/m\u00B2)", rate: 95, min: 5000 },
};

export const MATERIALS: Record<MaterialType, { label: string; costPerSqm: number; description: string }> = {
  colourbond:     { label: "Colorbond Steel", costPerSqm: 28, description: "Most popular in Australia - 25yr warranty" },
  concrete_tile:  { label: "Concrete Tiles",  costPerSqm: 35, description: "Classic look, great insulation" },
  terracotta:     { label: "Terracotta",      costPerSqm: 48, description: "Premium baked clay - 50yr lifespan" },
  slate:          { label: "Natural Slate",   costPerSqm: 75, description: "Heritage luxury - 100yr lifespan" },
  zinc:           { label: "Zinc/VM Zinc",    costPerSqm: 65, description: "Contemporary European finish" },
};

export const EXTRAS: Record<ExtrasKey, { label: string; unitCost: number; unit: string; description: string }> = {
  insulation:       { label: "Ceiling insulation upgrade", unitCost: 12, unit: "m\u00B2", description: "R4.0 batt insulation" },
  gutter_replacement: { label: "Gutter replacement", unitCost: 45, unit: "lm", description: "Colorbond gutters & downpipes" },
  sarking:          { label: "Sarking/foil barrier", unitCost: 8,  unit: "m\u00B2", description: "Required under tiles in some councils" },
  whirlybird:       { label: "Whirlybird ventilator", unitCost: 350, unit: "each", description: "Reduces attic heat by up to 30%" },
  skylight:         { label: "Roof window/skylight", unitCost: 1200, unit: "each", description: "Velux or similar" },
};

// -- Helper: generate quote number ----------------------------------

function generateQuoteNumber(): string {
  const prefix = "RF";
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${date}-${random}`;
}

// -- Main component -------------------------------------------------

interface RooferQuoteBuilderProps {
  profile: { hourly_rate: number; materials_margin_pct: number; trades?: string[]; onboarded_at?: string | null };
  materials: { item_key: string; label: string; unit_cost: number }[];
  preClientId?: string;
  preMarkupMaterials?: { label: string; quantity: number; unit: string; unitCost: number; totalCost: number }[];
}

export default function RooferQuoteBuilder({
  profile,
  materials: lib,
  preClientId,
  preMarkupMaterials,
}: RooferQuoteBuilderProps) {

  // -- State -------------------------------------------------------
  const [jobs, setJobs] = useState<JobDetail[]>([]);
  const [material, setMaterial] = useState<MaterialType>("colourbond");
  const [color, setColor] = useState<ColorPreference>("monument");
  const [tier, setTier] = useState<PricingTier>("standard");
  const [labourRate, setLabourRate] = useState<LabourRate>("standard");
  const [extras, setExtras] = useState<ExtrasState>({
    insulation: false, gutter_replacement: false, sarking: false,
    whirlybird: false, skylight: false,
  });
  const [notes, setNotes] = useState("");
  const [warranty, setWarranty] = useState("10-year manufacturer warranty + 5-year workmanship guarantee");
  const [saving, setSaving] = useState(false);

  // -- New job form ----------------------------------------------
  const [newArea, setNewArea] = useState(0);
  const [newPitch, setNewPitch] = useState<"low" | "medium" | "steep">("medium");
  const [newStyle, setNewStyle] = useState<"gable" | "hip" | "flat" | "complex">("gable");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const canAdd = newArea > 0 && newDesc.length > 5;

  function addJob() {
    if (!canAdd) return;
    const job: JobDetail = {
      id: crypto.randomUUID(),
      area: newArea,
      pitchType: newPitch,
      roofStyle: newStyle,
      description: newDesc,
      photos: [],
      photosLoaded: false,
      annotations: [],
    };
    setJobs(prev => [...prev, job]);
    setNewArea(0); setNewPitch("medium"); setNewStyle("gable"); setNewDesc("");
    setAdding(false);
  }

  function removeJob(id: string) {
    setJobs(prev => prev.filter(j => j.id !== id));
  }

  function updateJob(id: string, patch: Partial<JobDetail>) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }

  // -- Cost calculations -------------------------------------------
  const summary = useMemo(() => {
    const totalArea = jobs.reduce((s, j) => s + j.area, 0);
    if (totalArea === 0) return null;

    const m = MATERIALS[material];
    const r = RATES[labourRate];
    const labour   = Math.max(totalArea * r.rate, r.min);
    const matCost  = totalArea * m.costPerSqm;
    const tierMult = tier === "premium" ? 1.15 : 1;

    // Colour surcharge for premium colours
    const colorSurcharge = (color === "surfmist" || color === "monument") && tier === "premium" ? totalArea * 2 : 0;

    let extrasTotal = 0;
    if (extras.insulation)       extrasTotal += totalArea * EXTRAS.insulation.unitCost;
    if (extras.sarking)          extrasTotal += totalArea * EXTRAS.sarking.unitCost;
    if (extras.gutter_replacement) {
      const gutterLm = Math.ceil(totalArea / 8);
      extrasTotal += gutterLm * EXTRAS.gutter_replacement.unitCost;
    }
    if (extras.whirlybird)       extrasTotal += 2 * EXTRAS.whirlybird.unitCost;
    if (extras.skylight)         extrasTotal += 1 * EXTRAS.skylight.unitCost;

    const subtotal = (labour + matCost + extrasTotal + colorSurcharge) * tierMult;
    const gst      = subtotal * 0.10;
    const total    = subtotal + gst;

    return {
      totalArea, labour, matCost, extrasTotal, colorSurcharge,
      subtotal, gst, total, tierMult,
      breakdown: {
        labourPerSqm: Math.round((labour / totalArea) * 100) / 100,
        materialPerSqm: m.costPerSqm,
      },
    };
  }, [jobs, material, labourRate, tier, color, extras]);

  // -- Job card component ------------------------------------------
  function JobCard({ job, index }: { job: JobDetail; index: number }) {
    const [expanded, setExpanded] = useState(false);

    return (
      <div className="border border-[#f1ede8] rounded-2xl overflow-hidden bg-white">
        {/* Header */}
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-5 text-left hover:bg-[#faf8f5] transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--amber-light)] flex items-center justify-center text-[var(--amber-deep)] font-bold text-[14px]">
              #{index + 1}
            </div>
            <div>
              <p className="font-semibold text-[14px] text-[var(--ink)]">{job.area} m&sup2; - {job.roofStyle.charAt(0).toUpperCase() + job.roofStyle.slice(1)} roof</p>
              <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">{job.pitchType} pitch - {job.description.slice(0, 60)}{job.description.length > 60 ? "..." : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); removeJob(job.id); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-faint)] hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 size={15} />
            </button>
            {expanded ? <ChevronUp size={18} className="text-[var(--ink-faint)]" /> : <ChevronDown size={18} className="text-[var(--ink-faint)]" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-[#f1ede8] p-5 space-y-4">
            {/* Area editor */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field text-[11px]">Area (m&sup2;)</label>
                <input type="number" value={job.area} onChange={e => updateJob(job.id, { area: Number(e.target.value) || 0 })}
                  className="app-field text-[13px]" />
              </div>
              <div>
                <label className="label-field text-[11px]">Pitch</label>
                <select value={job.pitchType} onChange={e => updateJob(job.id, { pitchType: e.target.value as JobDetail["pitchType"] })}
                  className="app-field text-[13px]">
                  <option value="low">Low (&lt;15&deg;)</option>
                  <option value="medium">Medium (15-30&deg;)</option>
                  <option value="steep">Steep (&gt;30&deg;)</option>
                </select>
              </div>
            </div>

            {/* Roof style */}
            <div>
              <label className="label-field text-[11px]">Roof style</label>
              <div className="grid grid-cols-4 gap-2">
                {(["gable", "hip", "flat", "complex"] as const).map(s => (
                  <button key={s} onClick={() => updateJob(job.id, { roofStyle: s })}
                    className={`px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all capitalize ${job.roofStyle === s ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="label-field text-[11px]">Description</label>
              <textarea value={job.description} onChange={e => updateJob(job.id, { description: e.target.value })}
                rows={3} className="app-field text-[13px] resize-none" />
            </div>

            {/* Photos */}
            <div>
              <label className="label-field text-[11px]">Site photos</label>
              <div className="flex flex-wrap gap-2">
                {job.photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                    <img src={URL.createObjectURL(p)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => updateJob(job.id, { photos: job.photos.filter((_, pi) => pi !== i) })}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--line)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--ink-faint)] transition-colors">
                  <Camera size={16} className="text-[var(--ink-faint)] mb-1" />
                  <span className="text-[9px] text-[var(--ink-faint)] font-semibold">Add</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      updateJob(job.id, { photos: [...job.photos, ...files] });
                    }} />
                </label>
              </div>
            </div>

            {/* Annotations */}
            <div>
              <label className="label-field text-[11px]">Annotations / mark-ups</label>
              <div className="space-y-1.5">
                {job.annotations.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <PenLine size={12} className="text-[var(--ink-faint)] shrink-0" />
                    <span className="text-[12px] text-[var(--ink-soft)] flex-1">{a}</span>
                    <button onClick={() => updateJob(job.id, { annotations: job.annotations.filter((_, ai) => ai !== i) })}
                      className="text-[var(--ink-faint)] hover:text-red-500"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button onClick={() => {
                  const text = prompt("Add annotation:");
                  if (text) updateJob(job.id, { annotations: [...job.annotations, text] });
                }} className="text-[12px] font-semibold text-[var(--amber-deep)] hover:underline flex items-center gap-1">
                  <PenLine size={12} /> Add annotation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -- Build + send quote ------------------------------------------
  async function buildQuote() {
    if (!summary || jobs.length === 0) return;

    const quotePayload = {
      quoteNumber: generateQuoteNumber(),
      clientId: preClientId || null,
      clientName: "",
      clientAddress: "",
      date: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      jobs: jobs.map((j, i) => ({
        index: i + 1,
        area: j.area,
        pitch: j.pitchType,
        style: j.roofStyle,
        description: j.description,
        photos: j.photos.length,
        annotations: j.annotations,
      })),
      material: MATERIALS[material],
      color,
      labourRate: RATES[labourRate],
      tier,
      extras,
      notes,
      warranty,
      summary: {
        totalArea: summary.totalArea,
        labour: summary.labour,
        materials: summary.matCost,
        extras: summary.extrasTotal,
        colorSurcharge: summary.colorSurcharge,
        subtotal: summary.subtotal,
        gst: summary.gst,
        total: summary.total,
      },
    };

    return quotePayload;
  }

  async function handleSave() {
    const payload = await buildQuote();
    if (!payload) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("quotes").insert({ ...payload, profile_id: "TODO" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    const payload = await buildQuote();
    if (!payload) return;
    console.log("Send quote:", payload);
  }

  // -- Render ------------------------------------------------------

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[1.6rem] text-[var(--ink)]">Roofer Quote Builder</h2>
          <p className="text-[13px] text-[var(--ink-soft)]">Scope, measure and price re-roofing jobs</p>
        </div>
        {summary && (
          <div className="text-right">
            <p className="font-display text-[2rem] text-[var(--amber-deep)]">${Math.round(summary.total).toLocaleString()}</p>
            <p className="text-[11px] text-[var(--ink-faint)] font-semibold">inc. GST - {summary.totalArea} m&sup2; total</p>
          </div>
        )}
      </div>

      {/* -- Jobs section ---------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--amber-deep)]" /> Jobs ({jobs.length})
          </h3>
          <button onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--amber-deep)] hover:underline">
            <PlusCircle size={14} /> {adding ? "Cancel" : "Add job"}
          </button>
        </div>

        {adding && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-[13px] text-[var(--ink)]">New job</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field text-[11px]">Roof area (m&sup2;)</label>
                <input type="number" value={newArea || ""} onChange={e => setNewArea(Number(e.target.value))}
                  placeholder="e.g. 150" className="app-field text-[13px]" />
              </div>
              <div>
                <label className="label-field text-[11px]">Pitch</label>
                <select value={newPitch} onChange={e => setNewPitch(e.target.value as JobDetail["pitchType"])}
                  className="app-field text-[13px]">
                  <option value="low">Low (&lt;15&deg;)</option>
                  <option value="medium">Medium (15-30&deg;)</option>
                  <option value="steep">Steep (&gt;30&deg;)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label-field text-[11px]">Roof style</label>
              <div className="grid grid-cols-4 gap-2">
                {(["gable", "hip", "flat", "complex"] as const).map(s => (
                  <button key={s} onClick={() => setNewStyle(s)}
                    className={`px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all capitalize ${newStyle === s ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label-field text-[11px]">Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="e.g. Full re-roof on 1970s weatherboard. Existing tiles to be removed. Need new sarking."
                rows={3} className="app-field text-[13px] resize-none" />
            </div>
            <button onClick={addJob} disabled={!canAdd}
              className="flex items-center gap-2 bg-[var(--navy)] text-white font-bold text-[13px] px-5 py-2.5 rounded-xl hover:bg-[#121f2b] transition-colors disabled:opacity-40">
              <Plus size={15} /> Add job
            </button>
          </div>
        )}

        {jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}

        {jobs.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-[var(--line)] rounded-2xl">
            <FileText size={28} className="text-[var(--ink-faint)] mx-auto mb-2" />
            <p className="text-[13px] text-[var(--ink-faint)] font-semibold">No jobs added yet</p>
            <p className="text-[11px] text-[var(--ink-faint)] mt-1">Click &quot;Add job&quot; to start scoping</p>
          </div>
        )}
      </div>

      {/* -- Materials ------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
          <Image size={16} className="text-[var(--amber-deep)]" /> Material
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.entries(MATERIALS) as [MaterialType, typeof MATERIALS[MaterialType]][]).map(([key, m]) => (
            <button key={key} onClick={() => setMaterial(key)}
              className={`p-3 rounded-xl border text-left transition-all ${material === key ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-gray-400"}`}>
              <p className="font-bold text-[13px]">{m.label}</p>
              <p className={`text-[11px] mt-1 ${material === key ? "text-white/70" : "text-[var(--ink-faint)]"}`}>{m.description}</p>
              <p className={`text-[12px] font-bold mt-2 ${material === key ? "text-[var(--amber)]" : "text-[var(--amber-deep)]"}`}>${m.costPerSqm}/m&sup2;</p>
            </button>
          ))}
        </div>
      </div>

      {/* -- Colour ---------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
          <SquareCheck size={16} className="text-[var(--amber-deep)]" /> Colour
        </h3>
        <div className="flex flex-wrap gap-2">
          {(["basalt", "surfmist", "monument", "dune", "other"] as ColorPreference[]).map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`px-4 py-2 rounded-xl border text-[13px] font-semibold capitalize transition-all ${color === c ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
              {c}
            </button>
          ))}
        </div>
        {(color === "surfmist" || color === "monument") && tier === "premium" && (
          <p className="text-[11px] text-amber-600 font-medium">+ $2/m&sup2; premium colour surcharge</p>
        )}
      </div>

      {/* -- Labour rate ----------------------------------------- */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
          <ArrowRight size={16} className="text-[var(--amber-deep)]" /> Labour rate
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(RATES) as [LabourRate, typeof RATES[LabourRate]][]).map(([key, r]) => (
            <button key={key} onClick={() => setLabourRate(key)}
              className={`p-3 rounded-xl border text-center transition-all ${labourRate === key ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-gray-400"}`}>
              <p className="font-bold text-[12.5px]">{r.label.split("(")[0]}</p>
              <p className={`text-[11px] mt-1 ${labourRate === key ? "text-white/70" : "text-[var(--ink-faint)]"}`}>Min ${r.min.toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      {/* -- Tier ------------------------------------------------ */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
          <Maximize2 size={16} className="text-[var(--amber-deep)]" /> Pricing tier
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(["standard", "premium"] as PricingTier[]).map(t => (
            <button key={t} onClick={() => setTier(t)}
              className={`p-4 rounded-xl border text-center transition-all ${tier === t ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-gray-400"}`}>
              <p className="font-bold text-[14px] capitalize">{t}</p>
              <p className={`text-[11px] mt-1 ${tier === t ? "text-white/70" : "text-[var(--ink-faint)]"}`}>{t === "standard" ? "Base pricing" : "+15% - Premium fixings &amp; warranty"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* -- Extras ---------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
          <PlusCircle size={16} className="text-[var(--amber-deep)]" /> Extras
        </h3>
        <div className="space-y-2">
          {(Object.entries(EXTRAS) as [ExtrasKey, typeof EXTRAS[ExtrasKey]][]).map(([key, e]) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--line)] bg-white cursor-pointer hover:border-gray-400 transition-colors">
              <input type="checkbox" checked={extras[key]} onChange={ev => setExtras(prev => ({ ...prev, [key]: ev.target.checked }))}
                className="w-4 h-4 rounded accent-[var(--navy)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13px] text-[var(--ink)]">{e.label}</p>
                <p className="text-[11px] text-[var(--ink-faint)]">{e.description}</p>
              </div>
              <span className="text-[12px] font-bold text-[var(--amber-deep)] shrink-0">${e.unitCost}/{e.unit}</span>
            </label>
          ))}
        </div>
      </div>

      {/* -- Notes ----------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
          <MessageSquare size={16} className="text-[var(--amber-deep)]" /> Notes &amp; conditions
        </h3>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Any special conditions, access notes, or client requests..."
          rows={4} className="app-field text-[13px] resize-none" />
        <div>
          <label className="label-field text-[11px]">Warranty text</label>
          <input type="text" value={warranty} onChange={e => setWarranty(e.target.value)}
            className="app-field text-[13px]" />
        </div>
      </div>

      {/* -- Summary --------------------------------------------- */}
      {summary && (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6 space-y-3">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--amber-deep)]" /> Quote summary
          </h3>

          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[var(--ink-soft)]">Labour ({RATES[labourRate].label})</span>
              <span className="font-semibold">${Math.round(summary.labour).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-soft)]">Materials ({MATERIALS[material].label})</span>
              <span className="font-semibold">${Math.round(summary.matCost).toLocaleString()}</span>
            </div>
            {summary.extrasTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Extras</span>
                <span className="font-semibold">${Math.round(summary.extrasTotal).toLocaleString()}</span>
              </div>
            )}
            {summary.colorSurcharge > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Colour premium</span>
                <span className="font-semibold">${Math.round(summary.colorSurcharge).toLocaleString()}</span>
              </div>
            )}
            {tier === "premium" && (
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Premium tier (+15%)</span>
                <span className="font-semibold text-amber-600">Included</span>
              </div>
            )}
            <div className="border-t border-[var(--line)] pt-2 flex justify-between">
              <span className="text-[var(--ink-soft)]">Subtotal</span>
              <span className="font-bold">${Math.round(summary.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-soft)]">GST (10%)</span>
              <span className="font-semibold">${Math.round(summary.gst).toLocaleString()}</span>
            </div>
            <div className="border-t-2 border-[var(--navy)] pt-2 flex justify-between">
              <span className="font-bold text-[var(--ink)]">Total inc. GST</span>
              <span className="font-display text-[1.4rem] text-[var(--amber-deep)]">${Math.round(summary.total).toLocaleString()}</span>
            </div>
          </div>

          <p className="text-[11px] text-[var(--ink-faint)]">
            Based on {summary.totalArea} m&sup2; @ ${summary.breakdown.labourPerSqm}/m&sup2; labour + ${summary.breakdown.materialPerSqm}/m&sup2; materials
          </p>
        </div>
      )}

      {/* -- Actions --------------------------------------------- */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button onClick={handleSave} disabled={saving || !summary}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--navy)] text-white font-bold text-[14px] py-3.5 rounded-xl hover:bg-[#121f2b] transition-colors disabled:opacity-40">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          {saving ? "Saving..." : "Save quote"}
        </button>
        <button onClick={handleSend} disabled={!summary}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[14px] py-3.5 rounded-xl hover:bg-[var(--amber-deep)] transition-colors disabled:opacity-40">
          <Phone size={15} /> Send to client
        </button>
      </div>
    </div>
  );
}
