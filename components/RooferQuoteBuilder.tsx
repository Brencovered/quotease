"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronUp, Plus, Trash2, PenLine, Image, FileText, MessageSquare, Maximize2, Camera, SquareCheck, Phone, ArrowRight, Loader2, PlusCircle, X, Paperclip, Sparkles } from "lucide-react";
import LiveSiteAnnotation from "@/components/LiveSiteAnnotation";
import DrawingAnalysisReviewTable, { type DetectedItem, type ReviewLineItem } from "@/components/DrawingAnalysisReviewTable";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import { siteItemsLabourTotal, siteItemsMaterialsTotal, siteItemsLabourHours, markupMaterialsToScopeItems } from "@/lib/quotePricing";
import StepCustomer from "./StepCustomer";
import PackagePicker from "@/components/PackagePicker";
import { resolveClientId } from "@/lib/resolveClientId";
import { getActiveBusinessId } from "@/lib/team";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { MaterialSearchAdd, ScopeItemsList } from "@/components/ScopeOfWorkStep";
import PeripheralsPanel from "@/components/PeripheralsPanel";

// ── Types ──────────────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────

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

// ── Helper: generate quote number ─────────────────────────────────

function generateQuoteNumber(): string {
  const prefix = "RF";
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${date}-${random}`;
}

// ── Main component ────────────────────────────────────────────────

interface RooferQuoteBuilderProps {
  profile: { hourly_rate: number; materials_margin_pct: number; trades?: string[]; onboarded_at?: string | null; archetype_defaults?: Record<string, string> };
  materials: { item_key: string; label: string; unit_cost: number }[];
  preClientId?: string;
  preMarkupMaterials?: { label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number }[];
  preMarkupSource?: "package" | "plan markup" | "material bundle";
  pricingTiers?: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers?: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
}

export default function RooferQuoteBuilder({
  profile,
  materials: lib,
  preClientId,
  preMarkupMaterials,
  preMarkupSource,
  pricingTiers,
  jobSizeTiers,
}: RooferQuoteBuilderProps) {

  // Remembered archetype -> real price book product mappings, so AI-detected
  // items auto-price from the tradie's previous picks instead of coming
  // back unpriced on every single quote.
  const [archetypeDefaults, setArchetypeDefaults] = useState<Record<string, string>>(
    profile.archetype_defaults ?? {}
  );
  async function saveArchetypeDefault(archetypeKey: string, itemKey: string) {
    const key = `roofer:${archetypeKey}`;
    const next = { ...archetypeDefaults, [key]: itemKey };
    setArchetypeDefaults(next);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      await supabase.from("profiles").update({ archetype_defaults: next }).eq("id", businessId);
    } catch (e) {
      console.error("Failed to save archetype default:", e);
    }
  }

  // ── State ──────────────────────────────────────────────────────
  const [siteItems, setSiteItems] = useState<{id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[]>(
    () => markupMaterialsToScopeItems(preMarkupMaterials, preMarkupSource ?? "plan markup")
  );
  const [annotationMeta, setAnnotationMeta] = useState<{id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string;roomName?:string}[]>([]);
  // Direct manual override for anything the formula doesn't capture -
  // confined roof-space access, steep pitch beyond the standard options,
  // or the calculated hours just being wrong for this job.
  const [manualLabourHrs, setManualLabourHrs] = useState(0);

  // ── Customer & site (was missing entirely -- save/send had no way to
  //    know who the quote was for) ──────────────────────────────────
  const [clientName,  setClientName]  = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [clientId, setClientId] = useState<string | null>(preClientId ?? null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [termsPreset, setTermsPreset] = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">("full_on_completion");
  const [customTerms, setCustomTerms] = useState<PaymentTerm[]>([
    { label: "Deposit", percent: 50, trigger: "acceptance", days: 0 },
    { label: "Final",   percent: 50, trigger: "completion", days: 7 },
  ]);
  const paymentTerms     = termsPreset === "custom" ? customTerms : PAYMENT_TERM_PRESETS[termsPreset];
  const customTermsTotal = customTerms.reduce((s, t) => s + (Number(t.percent) || 0), 0);

  // ── AI drawing / AI voice (Files) ─────────────────────────────
  const [drawingFiles, setDrawingFiles]     = useState<File[]>([]);
  const [detectedItems, setDetectedItems]   = useState<DetectedItem[]>([]);
  const [analyzing, setAnalyzing]           = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ confidence: string; notes: string } | null>(null);
  const [analysisError, setAnalysisError]   = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<"drawing" | "voice">("drawing");
  const [usageLimitReached, setUsageLimitReached] = useState(false);

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

  const [selectedPricingTierId, setSelectedPricingTierId] = useState<string | null>(null);
  const [selectedJobSizeTierId, setSelectedJobSizeTierId] = useState<string | null>(null);

  const selectedPricingTier = useMemo(() =>
    pricingTiers?.find(t => t.id === selectedPricingTierId) ?? null,
  [pricingTiers, selectedPricingTierId]);

  const selectedJobSizeTier = useMemo(() =>
    jobSizeTiers?.find(t => t.id === selectedJobSizeTierId) ?? null,
  [jobSizeTiers, selectedJobSizeTierId]);

  const effectiveMargin = useMemo(() => {
    const base = selectedPricingTier?.markup_pct ?? profile.materials_margin_pct ?? 20;
    const adjustment = selectedJobSizeTier?.markup_pct ?? 0;
    return base + adjustment;
  }, [selectedPricingTier, selectedJobSizeTier, profile.materials_margin_pct]);

  // ── New job form ───────────────────────────────────────────────
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

  function handleDrawingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setDrawingFiles((prev) => { const ex = new Set(prev.map((f) => f.name)); return [...prev, ...files.filter((f) => !ex.has(f.name))]; });
    setAnalysisResult(null); setAnalysisError(null); e.target.value = "";
  }

  async function runAiAnalysis() {
    if (!drawingFiles.length) return;
    setAnalyzing(true); setAnalysisError(null); setAnalysisResult(null); setAnalysisSource("drawing");
    try {
      const fd = new FormData();
      const fileForAnalysis = await normalizeForAnalysis(drawingFiles[0]);
      fd.append("file", fileForAnalysis);
      fd.append("trade", "roofer");
      fd.append("instructions", "This is a roofing job. Focus on roof area, guttering, ridge/valley lengths, and any roof-mounted extras.");
      const res  = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) { setAnalysisError(body.error ?? "Analysis failed"); if (body.usageLimitReached) setUsageLimitReached(true); return; }
      if (Array.isArray(body.result?.detected_items) && body.result.detected_items.length > 0) {
        setDetectedItems(body.result.detected_items);
      }
      setAnalysisResult({ confidence: body.result?.confidence ?? "low", notes: body.result?.notes ?? "" });
    } catch (err) { setAnalysisError(err instanceof Error ? err.message : "Could not reach analysis service."); }
    finally { setAnalyzing(false); }
  }

  async function onVoiceTranscript(transcript: string) {
    setAnalyzing(true); setAnalysisError(null); setAnalysisResult(null); setUsageLimitReached(false); setAnalysisSource("voice");
    try {
      const res = await fetch("/api/quotes/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, trade: "roofer", instructions: "This is a roofing job. Focus on roof area, guttering, ridge/valley lengths, and any roof-mounted extras." }),
      });
      const body = await res.json();
      if (!res.ok) { setAnalysisError(body.error ?? "Analysis failed"); if (body.usageLimitReached) setUsageLimitReached(true); return; }
      if (Array.isArray(body.result?.detected_items) && body.result.detected_items.length > 0) {
        setDetectedItems(body.result.detected_items);
      }
      setAnalysisResult({ confidence: body.result?.confidence ?? "low", notes: body.result?.notes ?? "" });
    } catch (err) { setAnalysisError(err instanceof Error ? err.message : "Could not reach analysis service."); }
    finally { setAnalyzing(false); }
  }

  function updateJob(id: string, patch: Partial<JobDetail>) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }

  // ── Cost calculations ──────────────────────────────────────────
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

  // ── Job card component ─────────────────────────────────────────
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

  // ── Build + send quote ─────────────────────────────────────────
  // Previously this was a stub: profile_id was hardcoded to "TODO", there
  // was no client name/email/address capture at all (hardcoded to ""), and
  // handleSend just did console.log -- nothing was ever actually saved
  // against a real account or sent to a client. Rebuilt to match the same
  // pattern the other 4 trades use.
  async function saveAndSend(sendEmail: boolean) {
    if (!summary || jobs.length === 0) return;
    setSaving(true); setSaveMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveMessage("Not logged in"); setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, user.id);
    const resolvedClientId = await resolveClientId(supabase, businessId, clientId, clientName, clientEmail, siteAddress);

    // See QuoteBuilder.tsx for the full explanation: only seed materials
    // that aren't already real price-book rows. Re-syncing the entire lib
    // unchanged, one sequential round trip per item, was the actual cause
    // of slow saves for anyone with a real price book.
    const isUuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const itemsNeedingSeed = lib.filter((m) => !isUuidRe.test(m.item_key));
    await Promise.all(
      itemsNeedingSeed.flatMap((m) => [
        supabase.from("price_book_items").insert({ profile_id: businessId, supplier: "Custom", description: m.label, cost_price: m.unit_cost, trade: "roofer", unit: "ea" }),
        supabase.from("material_items").upsert({ profile_id: businessId, trade: "roofer", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost }, { onConflict: "profile_id,item_key" }),
      ])
    );

    const rate = profile.hourly_rate ?? 95;
    const siteLabourSave   = siteItemsLabourHours(siteItems);
    const siteMatlsSave    = siteItemsMaterialsTotal(siteItems, effectiveMargin);
    const siteTotalSave    = Math.round(siteLabourSave * rate + siteMatlsSave);
    const formulaLabourHrs = summary.labour / rate;

    const { data: quote, error } = await supabase.from("quotes").insert({
      profile_id: businessId,
      client_id: resolvedClientId,
      client_name: clientName,
      client_email: clientEmail,
      site_address: siteAddress,
      trade: "roofer",
      job_type: `${MATERIALS[material].label} re-roof`,
      intake_data: {
        jobs: jobs.map((j, i) => ({
          index: i + 1, area: j.area, pitch: j.pitchType, style: j.roofStyle,
          description: j.description, annotations: j.annotations,
        })),
        material, color, labourRate, tier, extras, notes, warranty,
        site_items: siteItems,
        manual_labour_hours: manualLabourHrs,
        annotation_meta: annotationMeta.map(a => ({ ...a, frameData: "" })),
      },
      labour_hours: formulaLabourHrs + siteLabourSave + manualLabourHrs,
      materials_cost: Math.round(summary.matCost + summary.extrasTotal + summary.colorSurcharge + siteMatlsSave),
      total_cost: Math.round(summary.total + siteTotalSave + manualLabourHrs * rate),
      payment_terms: paymentTerms,
      pricing_tier_id: selectedPricingTierId,
      job_size_tier_id: selectedJobSizeTierId,
      status: sendEmail ? "sent" : "draft",
      sent_at: sendEmail ? new Date().toISOString() : null,
      // Package/plan/bundle materials now live in site_items (above) so
      // they show up as itemized, editable lines in the Scope step.
      markup_materials: [],
    }).select().single();

    if (error) { setSaveMessage(error.message); setSaving(false); return; }

    for (const job of jobs) {
      for (const file of job.photos) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${businessId}/${quote.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("job-files").upload(path, file);
        if (!upErr) await supabase.from("job_attachments").insert({ quote_id: quote.id, profile_id: businessId, file_name: file.name, storage_path: path, file_type: file.type, file_size: file.size });
      }
    }
    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${businessId}/${quote.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("job-files").upload(path, file);
      if (!upErr) await supabase.from("job_attachments").insert({ quote_id: quote.id, profile_id: businessId, file_name: file.name, storage_path: path, file_type: file.type, file_size: file.size });
    }

    if (sendEmail) {
      const res = await fetch("/api/quotes/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.id }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setSaveMessage(`Saved -- sending failed: ${b.error ?? res.statusText}`); setSaving(false); return; }
      setSaveMessage(`Sent to ${clientEmail}`);
    } else {
      setSaveMessage("Saved as draft");
    }
    setSaving(false);
  }

  // ── Render ─────────────────────────────────────────────────────

  const siteTotal = Math.round(
    siteItemsLabourTotal(siteItems, profile.hourly_rate ?? 95)
    + siteItemsMaterialsTotal(siteItems, effectiveMargin)
    + manualLabourHrs * (profile.hourly_rate ?? 95)
  );

  function saveDraft() {
    try {
      sessionStorage.setItem("swiftscope_quote_draft", JSON.stringify({ siteItems, annotationMeta, manualLabourHrs }));
      if (lib) sessionStorage.setItem("swiftscope_price_book", JSON.stringify(lib));
    } catch {}
  }

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
            <p className="font-display text-[2rem] text-[var(--amber-deep)]">${Math.round(summary.total + siteTotal).toLocaleString()}</p>
            <p className="text-[11px] text-[var(--ink-faint)] font-semibold">inc. GST - {summary.totalArea} m&sup2; total</p>
          </div>
        )}
      </div>

      {/* Customer & site -- previously missing entirely */}
      <StepCustomer
        clientName={clientName} setClientName={setClientName}
        clientEmail={clientEmail} setClientEmail={setClientEmail}
        siteAddress={siteAddress} setSiteAddress={setSiteAddress}
        setClientId={setClientId}
      />

      {/* Live site annotation */}
      <LiveSiteAnnotation
        trade="roofer"
        lib={lib}
        archetypeDefaults={archetypeDefaults}
        onSaveDefault={saveArchetypeDefault}
        onSaveDraft={saveDraft}
        onAnnotationMeta={(meta) => setAnnotationMeta(meta)}
        onAddLineItems={(items) => {
          setSiteItems((prev) => [
            ...prev,
            ...items.map((item) => ({
              id: Math.random().toString(36).slice(2),
              label: item.description,
              qty: item.quantity,
              unit: item.unit,
              note: item.notes,
              materialsCost: (item as {materialsCost?: number}).materialsCost ?? 0,
              labourHrs: (item as {labourHrs?: number}).labourHrs ?? 0,
              source: "annotation" as const,
            })),
          ]);
        }}
      />

      {/* ── Files: photos, AI drawing analysis, AI voice ────────── */}
      <div className="space-y-4">
        <div className="card">
          <p className="section-tag mb-1">Files</p>
          <p className="font-semibold text-[17px] mb-1">Upload photos or plans</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4">Roof photos, aerial shots, or existing plans.</p>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-8 cursor-pointer hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
            <Paperclip size={18} className="text-[var(--ink-faint)]" />
            <span className="text-[14px] font-semibold text-[var(--ink-soft)]">Add photos or plans</span>
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleDrawingUpload} />
          </label>
          {drawingFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {drawingFiles.map((f) => (
                <div key={f.name} className="flex items-center gap-3 bg-[var(--app-bg)] rounded-lg px-3 py-2.5">
                  <Paperclip size={14} className="text-[var(--ink-faint)] shrink-0" />
                  <span className="text-[13.5px] flex-1 truncate">{f.name}</span>
                  <button onClick={() => setDrawingFiles((p) => p.filter((x) => x.name !== f.name))}><X size={14} className="text-[var(--ink-faint)]" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <VoiceNoteRecorder
          onTranscriptReady={onVoiceTranscript}
          analyzing={analyzing}
          analysisError={analysisError}
          analysisResult={analysisResult}
          usageLimitReached={usageLimitReached}
        />

        {drawingFiles.length > 0 && (
          <div className="card border-2 border-[var(--amber-light)]">
            <div className="flex items-start gap-3 mb-3">
              <Sparkles size={18} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">AI field pre-fill (optional)</p>
                <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">AI reads the photo/plan and notes what it can. You review everything.</p>
              </div>
            </div>
            <button onClick={runAiAnalysis} disabled={analyzing} className="btn-secondary w-full justify-center">
              <Sparkles size={15} className="text-[var(--amber-deep)]" />{analyzing ? "Reading..." : "Analyse with AI"}
            </button>
            {analysisError && <p className="text-[13px] text-[var(--red)] mt-2">{analysisError}</p>}
          </div>
        )}

        {detectedItems.length > 0 && analysisResult && (
          <DrawingAnalysisReviewTable
            trade="roofer"
            detectedItems={detectedItems}
            confidence={analysisResult.confidence as "high" | "medium" | "low"}
            notes={analysisResult.notes}
            lib={lib as { item_key: string; label: string; unit_cost: number }[]}
            archetypeDefaults={archetypeDefaults}
            onSaveDefault={saveArchetypeDefault}
            onAccept={(items: ReviewLineItem[]) => {
              setSiteItems((prev) => [
                ...prev,
                ...items.map((item) => ({
                  id: Math.random().toString(36).slice(2),
                  label: item.label,
                  qty: item.quantity,
                  unit: item.unit,
                  note: analysisSource === "voice" ? "from voice quote" : "from drawing analysis",
                  materialsCost: item.total ?? 0,
                  labourHrs: item.labourHrs,
                  source: analysisSource,
                })),
              ]);
              setDetectedItems([]);
              setAnalysisResult(null);
            }}
            onDismiss={() => { setDetectedItems([]); setAnalysisResult(null); }}
          />
        )}
      </div>

      <PeripheralsPanel trade="roofer" siteItems={siteItems} setSiteItems={setSiteItems} />

      <div className="card">
        <p className="section-tag mb-3">Materials &amp; labour</p>
        <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
          Items from a package, plan markup, voice, live annotate, or drawing extract show up here automatically. Search below to add anything else, or build the whole scope manually.
        </p>
        <div className="mb-3">
          <MaterialSearchAdd lib={lib} onAdd={(item) => setSiteItems((prev) => [...prev, { ...item, id: Math.random().toString(36).slice(2) }])} />
        </div>
        <ScopeItemsList items={siteItems} setItems={setSiteItems} />
      </div>

      {/* ── Jobs section ─────────────────────────────────────── */}
      <div className="space-y-3">
        <PackagePicker trade="roofer" />
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

      {/* ── Materials ────────────────────────────────────────── */}
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

      {/* ── Colour ───────────────────────────────────────────── */}
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

      {/* ── Labour rate ──────────────────────────────────────── */}
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

      {/* ── Tier selectors ───────────────────────────────────── */}
      {pricingTiers && pricingTiers.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
            <Maximize2 size={16} className="text-[var(--amber-deep)]" /> Customer type
          </h3>
          <select
            value={selectedPricingTierId ?? ""}
            onChange={(e) => setSelectedPricingTierId(e.target.value || null)}
            className="app-field"
          >
            <option value="">Custom margin ({profile.materials_margin_pct ?? 20}%)</option>
            {pricingTiers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.markup_pct >= 0 ? "+" : ""}{t.markup_pct}%)
              </option>
            ))}
          </select>
        </div>
      )}

      {jobSizeTiers && jobSizeTiers.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-[14px] text-[var(--ink)] flex items-center gap-2">
            <Maximize2 size={16} className="text-[var(--amber-deep)]" /> Job size
          </h3>
          <select
            value={selectedJobSizeTierId ?? ""}
            onChange={(e) => setSelectedJobSizeTierId(e.target.value || null)}
            className="app-field"
          >
            <option value="">Select job size...</option>
            {jobSizeTiers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.max_days ? `(< ${t.max_days} day${t.max_days !== 1 ? "s" : ""})` : "(3+ days)"}
                ({t.markup_pct >= 0 ? "+" : ""}{t.markup_pct}%)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Pricing tier (legacy) ────────────────────────────── */}
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

      {/* ── Extras ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="font-semibold text-[14px] text-[var(ink)] flex items-center gap-2">
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

      {/* ── Notes ────────────────────────────────────────────── */}
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
        <div>
          <label className="label-field text-[11px]">Extra labour hours (manual adjustment)</label>
          <input type="number" min={0} step={0.5} value={manualLabourHrs}
            onChange={e => setManualLabourHrs(Math.max(0, Number(e.target.value) || 0))}
            className="app-field text-[13px]" />
          <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
            Steep pitch and roof style are already priced into the formula above, but if this job needs more time - confined roof-space access, an especially awkward site, anything the formula doesn&apos;t capture - add it here. Added straight to the quote total, on top of everything else.
          </p>
        </div>
      </div>

      {/* ── Summary ──────────────────────────────────────────── */}
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
                <span className="text-[var(ink-soft)]">Colour premium</span>
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
            {(siteTotal > 0) && (
              <div className="flex justify-between">
                <span className="text-[var(--ink-soft)]">Files &amp; annotation items</span>
                <span className="font-semibold">${Math.round(siteTotal).toLocaleString()}</span>
              </div>
            )}
            <div className="border-t-2 border-[var(--navy)] pt-2 flex justify-between">
              <span className="font-bold text-[var(--ink)]">Total inc. GST</span>
              <span className="font-display text-[1.4rem] text-[var(--amber-deep)]">${Math.round(summary.total + siteTotal).toLocaleString()}</span>
            </div>
          </div>

          <p className="text-[11px] text-[var(--ink-faint)]">
            Based on {summary.totalArea} m&sup2; @ ${summary.breakdown.labourPerSqm}/m&sup2; labour + ${summary.breakdown.materialPerSqm}/m&sup2; materials
          </p>
        </div>
      )}

      <div className="card">
        <p className="section-tag mb-3">Payment terms</p>
        <select value={termsPreset} onChange={(e) => setTermsPreset(e.target.value as keyof typeof PAYMENT_TERM_PRESETS | "custom")} className="app-field mb-3">
          <option value="full_on_completion">100% on completion (14 days)</option>
          <option value="deposit_50_50">50% deposit, 50% on completion</option>
          <option value="deposit_30_70">30% deposit, 70% on completion</option>
          <option value="due_on_invoice">100% due on invoice (7 days)</option>
          <option value="custom">Custom split</option>
        </select>
        {termsPreset !== "custom" ? (
          <div className="bg-[var(--app-bg)] rounded-xl p-3 space-y-1.5">
            {paymentTerms.map((t, i) => (
              <div key={i} className="flex justify-between text-[13.5px]">
                <span className="text-[var(--ink-soft)]">{t.label}</span>
                <span className="font-bold tabular">{t.percent}% - ${summary ? Math.round((summary.total + siteTotal) * t.percent / 100).toLocaleString() : 0}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {customTerms.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px] gap-2 bg-[var(--app-bg)] rounded-xl p-3">
                <input value={t.label} onChange={(e) => setCustomTerms((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="app-field py-2 text-[13px]" />
                <input type="number" value={t.percent} onChange={(e) => setCustomTerms((p) => p.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) } : x))} className="app-field py-2 text-[13px] text-center" />
              </div>
            ))}
            {customTermsTotal !== 100 && <p className="text-[12.5px] text-[var(--red)] font-semibold">Adds up to {customTermsTotal}% - must total 100%</p>}
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button onClick={() => saveAndSend(false)} disabled={saving || !summary}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--navy)] text-white font-bold text-[14px] py-3.5 rounded-xl hover:bg-[#121f2b] transition-colors disabled:opacity-40">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
          {saving ? "Saving..." : "Save as draft"}
        </button>
        <button onClick={() => saveAndSend(true)} disabled={saving || !summary || !clientEmail}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[14px] py-3.5 rounded-xl hover:bg-[var(--amber-deep)] transition-colors disabled:opacity-40">
          <Phone size={15} /> {saving ? "Sending..." : "Send quote to client"}
        </button>
      </div>
      {saveMessage && <p className="text-[13px] text-center text-[var(--ink-soft)]">{saveMessage}</p>}
    </div>
  );
}
