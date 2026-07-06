"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { AlertTriangle, Paperclip, X, Sparkles, ChevronRight, ChevronLeft, Check, Upload, Plus } from "lucide-react";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import StepCustomer from "./StepCustomer";
import ExtraJobLines, { extraLinesTotals } from "./ExtraJobLines";
import { resolveClientId } from "@/lib/resolveClientId";
import { getActiveBusinessId } from "@/lib/team";
import MaterialsEditor from "@/components/MaterialsEditor";
import CalcKeyPricingPanel from "@/components/CalcKeyPricingPanel";
import { resolveCalcCosts, hasRealPriceBook } from "@/lib/resolveCalcCosts";
import LiveSiteAnnotation from "@/components/LiveSiteAnnotation";
import DrawingAnalysisReviewTable, { type DetectedItem, type ReviewLineItem } from "@/components/DrawingAnalysisReviewTable";
import SiteAnnotationReport from "@/components/SiteAnnotationReport";
import { siteItemsLabourTotal, siteItemsMaterialsTotal, siteItemsLabourHours, markupChargeTotal, markupMaterialsTotal, markupLabourHours } from "@/lib/quotePricing";
import {
  calcElectricianQuote,
  ELECTRICIAN_DEFAULT_MATERIALS,
  type ElectricianIntake,
  type MaterialCostMap,
} from "@/lib/calc";

type MaterialRow = { item_key: string; label: string; unit_cost: number };

const DEFAULT_INTAKE: ElectricianIntake = {
  jobType: "reno", ceilingType: "unknown",
  switchboardUpgrade: false, switchboardRcbo: false, switchboardRcboMode: "full_board", switchboardPoles: 12,
  threePhase: false,
  powerPoints: 0, lightPoints: 0, switches: 0,
  downlights: 0, downlightGrade: "builder", downlightSupply: "supply_and_fit", downlightProvisional: 0,
  exhaustFans: [],
  cableRuns: [],
  roofAccess: 1, subfloorAccess: 1, trenchMetres: 0,
  applianceOven: false, applianceCooktop: false, applianceHwc: false,
  applianceAircon: false, appliancePool: false,
  customAppliances: [],
  evCharger: false, solarConnection: false, externalCircuits: 0,
  dataPoints: 0, nbn: false,
  siteAccess: "easy", multistorey: false,
  smokeAlarms: 0, callout: false, ccew: false, notes: "",
};

const STEPS = [
  { id: "customer",   label: "Customer" },
  { id: "drawing",    label: "Files" },
  { id: "job",        label: "Job" },
  { id: "electrical", label: "Electrical" },
  { id: "site",       label: "Site" },
  { id: "send",       label: "Send" },
];

export default function QuoteBuilder({
  profile, materials, preClientId, preMarkupMaterials,
  pricingTiers, jobSizeTiers,
}: {
  profile: { hourly_rate: number; materials_margin_pct: number; default_deposit_pct?: number | null; default_expiry_days?: number; archetype_defaults?: Record<string, string> };
  materials: MaterialRow[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number }>;
  pricingTiers?: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers?: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
}) {
  const [step, setStep]     = useState(0);
  const [intake, setIntake] = useState<ElectricianIntake>(DEFAULT_INTAKE);
  const [rate, setRate]     = useState(profile.hourly_rate ?? 95);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  // Remembered archetype -> real price book product mappings. Updated
  // optimistically when the tradie picks a product in the review step and
  // persisted to profiles.archetype_defaults in the background.
  const [archetypeDefaults, setArchetypeDefaults] = useState<Record<string, string>>(
    profile.archetype_defaults ?? {}
  );
  async function saveArchetypeDefault(archetypeKey: string, itemKey: string) {
    const key = `electrician:${archetypeKey}`;
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
  function saveCalcDefault(calcKey: string, itemKey: string) {
    saveArchetypeDefault(`calc:${calcKey}`, itemKey);
  }
  const [lib, setLib]       = useState<MaterialRow[]>(
    materials.length > 0 ? materials : ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );

  // Pricing tier selection
  const [selectedPricingTierId, setSelectedPricingTierId] = useState<string | null>(null);
  const [selectedJobSizeTierId, setSelectedJobSizeTierId] = useState<string | null>(null);

  // Derive selected tiers and effective margin
  const selectedPricingTier = useMemo(() =>
    pricingTiers?.find(t => t.id === selectedPricingTierId) ?? null,
  [pricingTiers, selectedPricingTierId]);

  const selectedJobSizeTier = useMemo(() =>
    jobSizeTiers?.find(t => t.id === selectedJobSizeTierId) ?? null,
  [jobSizeTiers, selectedJobSizeTierId]);

  // Effective margin = pricing tier markup + job size tier markup
  const effectiveMargin = useMemo(() => {
    const base = selectedPricingTier?.markup_pct ?? profile.materials_margin_pct ?? 20;
    const adjustment = selectedJobSizeTier?.markup_pct ?? 0;
    return base + adjustment;
  }, [selectedPricingTier, selectedJobSizeTier, profile.materials_margin_pct]);

  const [clientName, setClientName]   = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [clientId, setClientId] = useState<string | null>(preClientId ?? null);

  const initialDeposit = profile.default_deposit_pct;
  const [termsPreset, setTermsPreset] = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">(
    initialDeposit === 50 ? "deposit_50_50" : initialDeposit === 30 ? "deposit_30_70" : initialDeposit ? "custom" : "full_on_completion"
  );
  const [customTerms, setCustomTerms] = useState<PaymentTerm[]>(
    initialDeposit && initialDeposit !== 50 && initialDeposit !== 30
      ? [
          { label: "Deposit", percent: initialDeposit, trigger: "acceptance", days: 0 },
          { label: "Final payment", percent: 100 - initialDeposit, trigger: "completion", days: 7 },
        ]
      : [
    { label: "Deposit", percent: 50, trigger: "acceptance", days: 0 },
    { label: "Final", percent: 50, trigger: "completion", days: 7 },
  ]);
  const paymentTerms = termsPreset === "custom" ? customTerms : PAYMENT_TERM_PRESETS[termsPreset];
  const customTermsTotal = customTerms.reduce((s, t) => s + (Number(t.percent) || 0), 0);

  const [extraLines, setExtraLines]   = useState<{id:string;label:string;hours:number;materialsCost:number;note:string}[]>([]);
  const [siteItems, setSiteItems]     = useState<{id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[]>([]);
  const [annotationMeta, setAnnotationMeta] = useState<{id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string}[]>([]);
  const [saving, setSaving]         = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  const [drawingFiles, setDrawingFiles]         = useState<File[]>([]);

  // Persist quote state to sessionStorage so camera navigation doesn't wipe it
  const STORAGE_KEY = "swiftscope_quote_draft";

  function saveDraft() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        clientName, clientEmail, siteAddress, intake, step, extraLines, siteItems, annotationMeta,
      }));
    } catch {}
  }

  // Restore state from sessionStorage on mount
  useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.clientName)  setClientName(saved.clientName);
      if (saved.clientEmail) setClientEmail(saved.clientEmail);
      if (saved.siteAddress) setSiteAddress(saved.siteAddress);
      if (saved.intake)      setIntake(saved.intake);
      if (saved.step != null) setStep(saved.step);
      if (saved.extraLines)  setExtraLines(saved.extraLines);
      if (saved.siteItems)   setSiteItems(saved.siteItems);
      if (saved.annotationMeta) setAnnotationMeta(saved.annotationMeta);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [drawingInstructions, setDrawingInstructions] = useState("");
  const [analyzing, setAnalyzing]       = useState(false);
  const [analysisResult,  setAnalysisResult]  = useState<{ confidence: string; notes: string } | null>(null);
  const [detectedItems,   setDetectedItems]   = useState<DetectedItem[]>([]);
  const [analysisError, setAnalysisError]   = useState<string | null>(null);
  const [usageLimitReached, setUsageLimitReached] = useState(false);

  const costs: MaterialCostMap = useMemo(
    () => resolveCalcCosts("electrician", ELECTRICIAN_DEFAULT_MATERIALS, lib, archetypeDefaults),
    [lib, archetypeDefaults]
  );

  const result = useMemo(() => calcElectricianQuote(intake, costs, rate, effectiveMargin), [intake, costs, rate, effectiveMargin]);
  // The wizard's running total needs to include this too, not just the
  // saved record - otherwise raising a quote from a $244 plan shows $0
  // the whole time you're filling it in, which looks broken.
  const markupTotal = markupChargeTotal(preMarkupMaterials, rate ?? 95, effectiveMargin);
  const siteLabour    = siteItemsLabourTotal(siteItems, rate ?? 95);
  const siteMaterials = siteItemsMaterialsTotal(siteItems, effectiveMargin ?? 20);
  const siteTotal     = Math.round(siteLabour + siteMaterials);

  function set<K extends keyof ElectricianIntake>(key: K, value: ElectricianIntake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  function handleDrawingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setDrawingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !existing.has(f.name))];
    });
    setAnalysisResult(null);
    setAnalysisError(null);
    e.target.value = "";
  }

  async function runAiAnalysis() {
    if (!drawingFiles.length) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setUsageLimitReached(false);
    try {
      const fd = new FormData();
      const fileForAnalysis = await normalizeForAnalysis(drawingFiles[0]);
      fd.append("file", fileForAnalysis);
      fd.append("trade", "electrician");
      if (drawingInstructions.trim()) fd.append("instructions", drawingInstructions.trim());
      const res  = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setAnalysisError(body.error ?? "Analysis failed");
        if (body.usageLimitReached) setUsageLimitReached(true);
        return;
      }
      const r = body.result;
      // New flow: show detected items in review table, not pre-fill
      if (Array.isArray(r.detected_items) && r.detected_items.length > 0) {
        setDetectedItems(r.detected_items);
        setAnalysisResult({ confidence: r.confidence ?? "medium", notes: r.notes ?? "" });
      } else {
        // Fallback to old pre-fill for backwards compatibility
        setAnalysisResult({ confidence: r.confidence ?? "medium", notes: r.notes ?? "No items detected in this drawing." });
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Could not reach the drawing analysis service.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runAiAnalysisFromVoice(transcript: string) {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setUsageLimitReached(false);
    try {
      const res = await fetch("/api/quotes/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, instructions: drawingInstructions.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAnalysisError(body.error ?? "Analysis failed");
        if (body.usageLimitReached) setUsageLimitReached(true);
        return;
      }
      const r = body.result;
      setIntake((prev) => ({
        ...prev,
        powerPoints:       r.power_points      ?? prev.powerPoints,
        lightPoints:       r.light_points       ?? prev.lightPoints,
        switches:          r.switches           ?? prev.switches,
        downlights:        r.downlights         ?? prev.downlights,
        switchboardUpgrade: r.switchboard_upgrade ?? prev.switchboardUpgrade,
        threePhase:        r.three_phase        ?? prev.threePhase,
        dataPoints:        r.data_points        ?? prev.dataPoints,
        smokeAlarms:       r.smoke_alarms       ?? prev.smokeAlarms,
      }));
      setAnalysisResult({ confidence: r.confidence ?? "medium", notes: r.notes ?? "" });
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Could not reach the voice analysis service.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAndSend(sendEmail: boolean) {
    setSaving(true);
    setSaveMessage(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSaveMessage("Not logged in"); setSaving(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);

    const resolvedClientId = await resolveClientId(supabase, businessId, clientId, clientName, clientEmail, siteAddress);

    for (const m of lib) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.item_key);
      if (isUuid) {
        await supabase.from("price_book_items").update({
          description: m.label, cost_price: m.unit_cost, trade: "electrician", unit: "ea",
        }).eq("id", m.item_key).eq("profile_id", businessId);
      } else {
        await supabase.from("price_book_items").insert({
          profile_id: businessId, supplier: "Custom", description: m.label, cost_price: m.unit_cost, trade: "electrician", unit: "ea",
        });
      }
    }
    for (const m of lib) {
      await supabase.from("material_items").upsert(
        { profile_id: businessId, trade: "electrician", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost },
        { onConflict: "profile_id,item_key" }
      );
    }

    const extraTotals    = extraLinesTotals(extraLines, rate, effectiveMargin);
    const siteLabourSave = siteItemsLabourHours(siteItems);
    const siteMatlsSave  = siteItemsMaterialsTotal(siteItems, effectiveMargin);
    const siteTotalSave  = Math.round(siteLabourSave * rate + siteMatlsSave);
    const markupLabourSave = markupLabourHours(preMarkupMaterials);
    const markupMatlsSave  = markupMaterialsTotal(preMarkupMaterials, effectiveMargin);
    const markupTotalSave  = Math.round(markupLabourSave * rate + markupMatlsSave);

    const quotePayload: Record<string, unknown> = {
      profile_id: businessId, client_id: resolvedClientId, client_name: clientName, client_email: clientEmail,
      site_address: siteAddress, trade: "electrician", job_type: intake.jobType,
      intake_data: {
        ...intake,
        site_items:      siteItems,
        annotation_meta: annotationMeta.map(a => ({ ...a, frameData: "" })),
      },
      labour_hours:   result.labourHours + extraLines.reduce((s, l) => s + l.hours, 0) + siteLabourSave + markupLabourSave,
      materials_cost: Math.round(result.materialsCost + extraTotals.materials + siteMatlsSave + markupMatlsSave),
      total_cost:     result.totalCost + extraTotals.total + siteTotalSave + markupTotalSave,
      payment_terms:  paymentTerms,
      quote_expires_at: new Date(Date.now() + (profile.default_expiry_days ?? 30) * 86400000).toISOString(),
      status:  sendEmail ? "sent" : "draft",
      sent_at: sendEmail ? new Date().toISOString() : null,
      markup_materials: preMarkupMaterials ?? [],
    };

    // Opt-in: only send tier IDs to DB if user explicitly selected them
    if (selectedPricingTierId) quotePayload.pricing_tier_id = selectedPricingTierId;
    if (selectedJobSizeTierId) quotePayload.job_size_tier_id = selectedJobSizeTierId;

    const { data: quote, error } = await supabase.from("quotes").insert(quotePayload).select().single();

    if (error) { setSaveMessage(error.message); setSaving(false); return; }
    setSavedQuoteId(quote.id);

    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${businessId}/${quote.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
      if (!uploadError) {
        await supabase.from("job_attachments").insert({
          quote_id: quote.id, profile_id: businessId, file_name: file.name,
          storage_path: path, file_type: file.type, file_size: file.size,
        });
      }
    }

    if (sendEmail) {
      const res = await fetch("/api/quotes/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.id }) });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setSaveMessage(`Saved - but sending failed: ${b.error ?? res.statusText}`);
        setSaving(false);
        return;
      }
      setSaveMessage(`Sent to ${clientEmail}`);
    } else {
      setSaveMessage("Saved as draft");
    }
    setSaving(false);
  }

  const stepId = STEPS[step].id;

  return (
    <div className="page-wrap-narrow">
      <div className="sticky top-12 sm:top-0 z-30 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="bg-[var(--navy)] rounded-none sm:rounded-2xl px-5 py-3 flex items-center justify-between gap-4"
             style={{ boxShadow: "0 4px 20px rgba(10,23,34,.18)" }}>
          <div className="flex gap-5">
            <div>
              <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Labour</p>
              <p className="font-display text-[18px] text-white leading-tight">{result.labourHours}h</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Materials</p>
              <p className="font-display text-[18px] text-white leading-tight">${(result.materialsCost + markupTotal + extraLinesTotals(extraLines, rate, effectiveMargin).materials + Math.round(siteMaterials)).toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p>
            <p className="font-display text-[24px] text-[var(--amber)] leading-tight tabular">${(result.totalCost + markupTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total + siteTotal).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {STEPS.map((s, i) => {
          const done    = i < step;
          const current = i === step;
          return (
            <button key={s.id} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap transition-all ${
                current ? "bg-[var(--navy)] text-white" :
                done    ? "bg-[var(--amber-light)] text-[var(--amber-deep)]" :
                          "bg-[var(--surface)] text-[var(--ink-faint)] border border-[var(--line)]"
              }`}
            >
              {done && <Check size={11} />}{s.label}
            </button>
          );
        })}
      </div>

      {stepId === "drawing" && (
        <StepDrawing
          drawingFiles={drawingFiles}
          drawingInstructions={drawingInstructions}
          setDrawingInstructions={setDrawingInstructions}
          analyzing={analyzing}
          analysisResult={analysisResult}
          detectedItems={detectedItems}
          analysisError={analysisError}
          usageLimitReached={usageLimitReached}
          archetypeDefaults={archetypeDefaults}
          onSaveArchetypeDefault={saveArchetypeDefault}
          onUpload={handleDrawingUpload}
          onRemove={(name) => { setDrawingFiles((p) => p.filter((f) => f.name !== name)); setAnalysisResult(null); setDetectedItems([]); }}
          onAnalyse={runAiAnalysis}
          onAcceptDetected={(items) => {
            // Map review line items into siteItems for the quote
            setSiteItems((prev) => [
              ...prev,
              ...items.map((item) => ({
                id:           Math.random().toString(36).slice(2),
                label:        item.label,
                qty:          item.quantity,
                unit:         item.unit,
                note:         "from drawing analysis",
                materialsCost: item.total ?? 0,
                labourHrs:    item.labourHrs,
              })),
            ]);
            setDetectedItems([]);
            setAnalysisResult(null);
          }}
          onDismissDetected={() => { setDetectedItems([]); setAnalysisResult(null); }}
          onVoiceTranscript={runAiAnalysisFromVoice}
          trade="electrician"
          lib={lib}
          onSaveDraft={saveDraft}
          onAnnotationMeta={(meta) => setAnnotationMeta(meta)}
          onAddLiveItems={(items) => {
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
              })),
            ]);
          }}
        />
      )}

      {stepId === "job" && (
        <StepJob
          intake={intake}
          rate={rate}
          margin={margin}
          effectiveMargin={effectiveMargin}
          set={set}
          setRate={setRate}
          setMargin={setMargin}
          pricingTiers={pricingTiers}
          jobSizeTiers={jobSizeTiers}
          selectedPricingTierId={selectedPricingTierId}
          setSelectedPricingTierId={setSelectedPricingTierId}
          selectedJobSizeTierId={selectedJobSizeTierId}
          setSelectedJobSizeTierId={setSelectedJobSizeTierId}
          selectedPricingTier={selectedPricingTier}
          selectedJobSizeTier={selectedJobSizeTier}
          profile={profile}
        />
      )}

      {stepId === "electrical" && (
        <StepElectrical intake={intake} set={set} lib={lib} setLib={setLib} archetypeDefaults={archetypeDefaults} saveCalcDefault={saveCalcDefault} />
      )}

      {stepId === "site" && (
        <StepSite intake={intake} set={set} />
      )}

      {stepId === "customer" && (
        <StepCustomer
          clientName={clientName} setClientName={setClientName}
          clientEmail={clientEmail} setClientEmail={setClientEmail}
          siteAddress={siteAddress} setSiteAddress={setSiteAddress}
          onCeilingHint={(hint) => set("ceilingType", hint as ElectricianIntake["ceilingType"])}
          setClientId={setClientId}
        />
      )}

      {stepId === "send" && (
        <StepSend
          intake={intake} result={result} paymentTerms={paymentTerms}
          termsPreset={termsPreset} setTermsPreset={setTermsPreset}
          customTerms={customTerms} setCustomTerms={setCustomTerms} customTermsTotal={customTermsTotal}
          clientName={clientName} clientEmail={clientEmail} siteAddress={siteAddress}
          saving={saving} saveMessage={saveMessage} savedQuoteId={savedQuoteId} onSave={saveAndSend}
          extraLines={extraLines} setExtraLines={setExtraLines} rate={rate} margin={margin}
          effectiveMargin={effectiveMargin}
          markupTotal={markupTotal} siteItems={siteItems} setSiteItems={setSiteItems} siteTotal={siteTotal} annotationMeta={annotationMeta}
          selectedPricingTier={selectedPricingTier}
          selectedJobSizeTier={selectedJobSizeTier}
        />
      )}

      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
            <ChevronLeft size={16} /> Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep(step + 1)} className="btn-primary flex-1">
            {STEPS[step + 1].label} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function StepDrawing({ drawingFiles, drawingInstructions, setDrawingInstructions, analyzing, analysisResult, detectedItems, analysisError, usageLimitReached, archetypeDefaults, onSaveArchetypeDefault, onUpload, onRemove, onAnalyse, onAcceptDetected, onDismissDetected, onVoiceTranscript, trade, lib, onSaveDraft, onAnnotationMeta, onAddLiveItems }: {
  drawingFiles: File[]; drawingInstructions: string; setDrawingInstructions: (v: string) => void;
  analyzing: boolean; analysisResult: { confidence: string; notes: string } | null;
  detectedItems: DetectedItem[];
  analysisError: string | null; usageLimitReached: boolean;
  archetypeDefaults: Record<string, string>;
  onSaveArchetypeDefault: (archetypeKey: string, itemKey: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (name: string) => void; onAnalyse: () => void;
  onAcceptDetected: (items: ReviewLineItem[]) => void;
  onDismissDetected: () => void;
  onVoiceTranscript: (transcript: string) => void;
  trade: string;
  lib: { item_key: string; unit_cost: number; label: string }[];
  onSaveDraft: () => void;
  onAnnotationMeta: (meta: {id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string}[]) => void;
  onAddLiveItems: (items: { description: string; quantity: number; unit: string; notes: string; materialsCost?: number; labourHrs?: number }[]) => void;
}) {
  return (
    <div className="space-y-4">
      <LiveSiteAnnotation trade={trade} lib={lib} onSaveDraft={onSaveDraft} onAnnotationMeta={onAnnotationMeta} onAddLineItems={onAddLiveItems} />
      <div className="card">
        <p className="section-tag mb-1">Step 1</p>
        <p className="font-semibold text-[var(--ink)] text-[17px] mb-1">Upload drawings</p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-4">Floor plans, site photos, electrical drawings - uploaded now, saved to the job. AI reading is optional.</p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-8 cursor-pointer hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
          <Paperclip size={18} className="text-[var(--ink-faint)]" />
          <span className="text-[14px] font-semibold text-[var(--ink-soft)]">Tap to add drawings or photos</span>
          <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onUpload} />
        </label>
        {drawingFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {drawingFiles.map((f) => (
              <div key={f.name} className="flex items-center gap-3 bg-[var(--app-bg)] rounded-lg px-3 py-2.5">
                <Paperclip size={14} className="text-[var(--ink-faint)] shrink-0" />
                <span className="text-[13.5px] text-[var(--ink)] flex-1 truncate">{f.name}</span>
                <span className="text-[11px] text-[var(--ink-faint)]">{(f.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => onRemove(f.name)} className="text-[var(--ink-faint)] hover:text-[var(--red)] ml-1 p-0.5">
                  <X size={14} />
                </button>
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
              <p className="font-semibold text-[var(--ink)]">AI field pre-fill</p>
              <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">Optional - AI reads the drawing and estimates quantities. You review everything before saving.</p>
            </div>
          </div>
          <textarea
            value={drawingInstructions}
            onChange={(e) => setDrawingInstructions(e.target.value)}
            rows={2}
            placeholder="Any instructions? e.g. only count rooms on ground floor, customer wants premium fittings"
            className="app-field text-[13px] mb-3"
          />
          <button onClick={onAnalyse} disabled={analyzing}
            className="btn-secondary w-full justify-center">
            <Sparkles size={15} className="text-[var(--amber-deep)]" />
            {analyzing ? "Reading drawing..." : "Analyse with AI"}
          </button>
          {analysisError && (
            <div className="mt-3 bg-[var(--red-bg)] rounded-lg px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle size={14} className="text-[var(--red)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] text-[var(--red)]">{analysisError}</p>
                {usageLimitReached && <Link href="/settings" className="text-[12.5px] font-semibold text-[var(--red)] underline">Upgrade in Settings →</Link>}
              </div>
            </div>
          )}
          {detectedItems.length > 0 && analysisResult && (
            <DrawingAnalysisReviewTable
              detectedItems={detectedItems}
              confidence={analysisResult.confidence as "high" | "medium" | "low"}
              notes={analysisResult.notes}
              lib={lib as { item_key: string; label: string; unit_cost: number }[]}
              trade={trade}
              archetypeDefaults={archetypeDefaults}
              onSaveDefault={onSaveArchetypeDefault}
              onAccept={onAcceptDetected}
              onDismiss={onDismissDetected}
            />
          )}
          {analysisResult && detectedItems.length === 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-[12.5px] font-semibold text-amber-800">{analysisResult.notes || "Analysis complete — no items detected. Try a clearer image."}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepJob({
  intake, rate, margin, effectiveMargin, set, setRate, setMargin,
  pricingTiers, jobSizeTiers,
  selectedPricingTierId, setSelectedPricingTierId,
  selectedJobSizeTierId, setSelectedJobSizeTierId,
  selectedPricingTier, selectedJobSizeTier,
  profile,
}: {
  intake: ElectricianIntake; rate: number; margin: number; effectiveMargin: number;
  set: <K extends keyof ElectricianIntake>(k: K, v: ElectricianIntake[K]) => void;
  setRate: (v: number) => void; setMargin: (v: number) => void;
  pricingTiers?: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers?: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
  selectedPricingTierId: string | null; setSelectedPricingTierId: (v: string | null) => void;
  selectedJobSizeTierId: string | null; setSelectedJobSizeTierId: (v: string | null) => void;
  selectedPricingTier: { id: string; name: string; markup_pct: number } | null;
  selectedJobSizeTier: { id: string; name: string; markup_pct: number } | null;
  profile: { hourly_rate: number; materials_margin_pct: number; default_deposit_pct?: number | null; default_expiry_days?: number };
}) {
  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-tag mb-3">Job details</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Job type" className="col-span-2">
            <select value={intake.jobType} onChange={(e) => set("jobType", e.target.value as ElectricianIntake["jobType"])} className="app-field">
              <option value="reno">Renovation / alteration</option>
              <option value="newbuild">New build</option>
              <option value="fault">Fault find / repair</option>
              <option value="compliance">Compliance / inspection</option>
            </select>
          </Field>
          <Field label="Ceiling type" className="col-span-2">
            <select value={intake.ceilingType} onChange={(e) => set("ceilingType", e.target.value as ElectricianIntake["ceilingType"])} className="app-field">
              <option value="unknown">Unknown - check on site</option>
              <option value="standard_plasterboard">Standard plasterboard</option>
              <option value="skillion">Skillion / cathedral</option>
              <option value="concrete_slab">Concrete slab</option>
              <option value="heritage_timber">Heritage / period timber</option>
            </select>
          </Field>
        </div>
        <Row>
          <Check2 checked={intake.callout}  onChange={(v) => set("callout", v)}  label="Include call-out fee" />
          <Check2 checked={intake.ccew}     onChange={(v) => set("ccew", v)}     label="CCEW certificate" />
        </Row>
      </div>
      <div className="card">
        <p className="section-tag mb-3">Customer &amp; job pricing</p>
        {pricingTiers && pricingTiers.length > 0 && (
          <div className="mb-3">
            <Field label="Customer type">
              <select value={selectedPricingTierId ?? ""} onChange={(e) => setSelectedPricingTierId(e.target.value || null)} className="app-field">
                <option value="">Custom margin ({profile.materials_margin_pct ?? 20}%)</option>
                {pricingTiers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.markup_pct >= 0 ? '+' : ''}{t.markup_pct}%)</option>
                ))}
              </select>
            </Field>
            {selectedPricingTier && (
              <p className="text-[11px] text-[var(--ink-faint)] mt-1">Materials marked up {selectedPricingTier.markup_pct}% for {selectedPricingTier.name.toLowerCase()} work</p>
            )}
          </div>
        )}
        {jobSizeTiers && jobSizeTiers.length > 0 && (
          <div className="mb-3">
            <Field label="Job size">
              <select value={selectedJobSizeTierId ?? ""} onChange={(e) => setSelectedJobSizeTierId(e.target.value || null)} className="app-field">
                <option value="">Select job size...</option>
                {jobSizeTiers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} {t.max_days ? `(< ${t.max_days} day${t.max_days !== 1 ? 's' : ''})` : '(3+ days)'} ({t.markup_pct >= 0 ? '+' : ''}{t.markup_pct}%)</option>
                ))}
              </select>
            </Field>
            {selectedJobSizeTier && selectedJobSizeTier.markup_pct !== 0 && (
              <p className="text-[11px] text-[var(--ink-faint)] mt-1">{selectedJobSizeTier.markup_pct > 0 ? 'Upward adjustment' : 'Discount'} of {Math.abs(selectedJobSizeTier.markup_pct)}% for {selectedJobSizeTier.name.toLowerCase()}</p>
            )}
          </div>
        )}
        <div className="border-t border-[var(--line-subtle)] pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hourly rate ($)"><input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="app-field" /></Field>
            <Field label={`Effective margin (${effectiveMargin}%)`}><input type="number" inputMode="decimal" value={effectiveMargin} className="app-field bg-[var(--amber-light)]" readOnly /></Field>
          </div>
          {selectedPricingTier && selectedJobSizeTier && (
            <p className="text-[11px] text-[var(--ink-faint)] mt-2">{selectedPricingTier.markup_pct}% (customer) {selectedJobSizeTier.markup_pct >= 0 ? '+' : ''}{selectedJobSizeTier.markup_pct}% (job size) = {effectiveMargin}% total</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StepElectrical({ intake, set, lib, setLib, archetypeDefaults, saveCalcDefault }: {
  intake: ElectricianIntake;
  set: <K extends keyof ElectricianIntake>(k: K, v: ElectricianIntake[K]) => void;
  lib: MaterialRow[];
  setLib: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
  archetypeDefaults: Record<string, string>;
  saveCalcDefault: (calcKey: string, itemKey: string) => void;
}) {
  const [showLib, setShowLib] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  function downloadCsvTemplate() {
    const rows = ["item_key,label,unit_cost", ...lib.map((m) => `${m.item_key},"${m.label}",${m.unit_cost}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "swiftscope-price-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const header = lines[0]?.toLowerCase().split(",") ?? [];
      const keyIdx = header.findIndex((h) => h.includes("key") || h.includes("item"));
      const costIdx = header.findIndex((h) => h.includes("cost") || h.includes("price"));
      if (keyIdx === -1 || costIdx === -1) { setCsvMessage("Couldn't find item and cost columns - try the template."); return; }
      let matched = 0; const updates = new Map<string, number>();
      for (const line of lines.slice(1)) {
        const cols = line.split(",");
        const key = cols[keyIdx]?.trim().replace(/^"|"$/g, "");
        const cost = parseFloat(cols[costIdx]?.replace(/[^0-9.]/g, "") ?? "");
        if (key && !isNaN(cost)) updates.set(key, cost);
      }
      setLib((prev) => prev.map((m) => { if (updates.has(m.item_key)) { matched++; return { ...m, unit_cost: updates.get(m.item_key)! }; } return m; }));
      setCsvMessage(matched > 0 ? `Updated ${matched} price${matched === 1 ? "" : "s"}.` : "No matching items found.");
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  const exhaustFans: import("@/lib/calc").ExhaustFanEntry[] = intake.exhaustFans ?? [];
  function setExhaustFan(type: import("@/lib/calc").ExhaustFanType, qty: number) {
    const updated = exhaustFans.filter(e => e.type !== type);
    if (qty > 0) updated.push({ type, qty });
    set("exhaustFans", updated);
  }
  function exhaustQty(type: import("@/lib/calc").ExhaustFanType) {
    return exhaustFans.find(e => e.type === type)?.qty ?? 0;
  }

  const cableRuns: import("@/lib/calc").CableRun[] = intake.cableRuns ?? [];
  function setCableRun(size: import("@/lib/calc").CableRun["size"], metres: number) {
    const updated = cableRuns.filter(r => r.size !== size);
    if (metres > 0) updated.push({ size, metres });
    set("cableRuns", updated);
  }
  function cableMetres(size: import("@/lib/calc").CableRun["size"]) {
    return cableRuns.find(r => r.size === size)?.metres ?? 0;
  }

  const customAppliances: import("@/lib/calc").CustomAppliance[] = intake.customAppliances ?? [];
  function addCustomAppliance() {
    set("customAppliances", [...customAppliances, { id: Math.random().toString(36).slice(2), label: "", phase: "single", amps: 20 }]);
  }
  function updateCustomAppliance(id: string, patch: Partial<import("@/lib/calc").CustomAppliance>) {
    set("customAppliances", customAppliances.map(a => a.id === id ? { ...a, ...patch } : a));
  }
  function removeCustomAppliance(id: string) {
    set("customAppliances", customAppliances.filter(a => a.id !== id));
  }

  return (
    <div className="space-y-4">

      {/* AI pre-fill summary -- show what was detected from drawing/voice */}
      {(intake.powerPoints > 0 || intake.lightPoints > 0 || intake.switches > 0 ||
        intake.downlights > 0 || intake.dataPoints > 0 || intake.smokeAlarms > 0 ||
        (intake.cableRuns ?? []).some((r) => r.metres > 0) ||
        (intake.exhaustFans ?? []).some((e) => e.qty > 0) ||
        intake.switchboardUpgrade || intake.threePhase) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">
            Detected from drawing or voice — review and adjust
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {([
              ["Power points",  intake.powerPoints],
              ["Light points",  intake.lightPoints],
              ["Switches",      intake.switches],
              ["Downlights",    intake.downlights],
              ["Data points",   intake.dataPoints],
              ["Smoke alarms",  intake.smokeAlarms],
              ["Ext. circuits", intake.externalCircuits],
              ["Cable (2.5mm)", (intake.cableRuns ?? []).find(r => r.size === "2.5")?.metres ?? 0],
              ["Exhaust fans",  (intake.exhaustFans ?? []).reduce((s, e) => s + e.qty, 0)],
            ] as [string, number][]).filter(([, v]) => v > 0).map(([label, val]) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-[12px] text-amber-700">{label}</span>
                <span className="text-[12.5px] font-bold text-amber-900">{val}</span>
              </div>
            ))}
            {intake.switchboardUpgrade && <div className="col-span-2 text-[12px] font-semibold text-amber-800 py-0.5">Switchboard upgrade detected</div>}
            {intake.threePhase && <div className="col-span-2 text-[12px] font-semibold text-amber-800 py-0.5">3-phase detected</div>}
          </div>
        </div>
      )}

      <div className="card">
        <p className="section-tag mb-3">Switchboard</p>
        <Row>
          <Check2 checked={intake.switchboardUpgrade} onChange={(v) => set("switchboardUpgrade", v)} label="Upgrade needed" />
          <Check2 checked={intake.threePhase}          onChange={(v) => set("threePhase", v)}          label="3-phase supply" />
        </Row>
        {intake.switchboardUpgrade && (
          <div className="mt-3 space-y-3 pt-3 border-t border-[var(--line-subtle)]">
            <Field label="RCBO type">
              <select value={intake.switchboardRcbo ? (intake.switchboardRcboMode ?? "full_board") : "rcd"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "rcd") { set("switchboardRcbo", false); }
                  else { set("switchboardRcbo", true); set("switchboardRcboMode", val as "full_board" | "per_pole"); }
                }} className="app-field">
                <option value="rcd">RCD upgrade only</option>
                <option value="full_board">Full RCBO board</option>
                <option value="per_pole">RCBO per pole</option>
              </select>
            </Field>
            {intake.switchboardRcbo && intake.switchboardRcboMode === "per_pole" && (
              <Field label="Number of poles"><Num value={intake.switchboardPoles ?? 12} onChange={(v) => set("switchboardPoles", v)} /></Field>
            )}
          </div>
        )}
      </div>
      <div className="card">
        <p className="section-tag mb-3">Points and circuits</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Field label="Power pts"><Num value={intake.powerPoints} onChange={(v) => set("powerPoints", v)} /></Field>
          <Field label="Light pts"><Num value={intake.lightPoints} onChange={(v) => set("lightPoints", v)} /></Field>
          <Field label="Switches"><Num value={intake.switches}    onChange={(v) => set("switches", v)}    /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data points"><Num value={intake.dataPoints} onChange={(v) => set("dataPoints", v)} /></Field>
          <Field label="Ext. circuits"><Num value={intake.externalCircuits} onChange={(v) => set("externalCircuits", v)} /></Field>
        </div>
        <div className="mt-3"><Check2 checked={intake.nbn} onChange={(v) => set("nbn", v)} label="NBN connection point" /></div>
      </div>
      <div className="card">
        <p className="section-tag mb-3">Lighting</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Downlights"><Num value={intake.downlights} onChange={(v) => set("downlights", v)} /></Field>
          <Field label="Supply">
            <select value={intake.downlightSupply ?? "supply_and_fit"}
              onChange={(e) => set("downlightSupply", e.target.value as ElectricianIntake["downlightSupply"])}
              className="app-field">
              <option value="supply_and_fit">Supply &amp; fit</option>
              <option value="wire_and_fit">Wire &amp; fit only (client supply)</option>
              <option value="provisional">Provisional sum</option>
            </select>
          </Field>
        </div>
        {intake.downlightSupply !== "wire_and_fit" && intake.downlightSupply !== "provisional" && (
          <Field label="Grade">
            <select value={intake.downlightGrade}
              onChange={(e) => set("downlightGrade", e.target.value as ElectricianIntake["downlightGrade"])}
              className="app-field">
              <option value="builder">Builder grade</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium / smart</option>
            </select>
          </Field>
        )}
        {intake.downlightSupply === "provisional" && (
          <Field label="Provisional sum ($)"><Num value={intake.downlightProvisional ?? 0} onChange={(v) => set("downlightProvisional", v)} /></Field>
        )}
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mt-4 mb-2">Exhaust fans</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ceiling"><Num value={exhaustQty("ceiling")} onChange={(v) => setExhaustFan("ceiling", v)} /></Field>
          <Field label="Ducted"><Num value={exhaustQty("ducted")}  onChange={(v) => setExhaustFan("ducted", v)}  /></Field>
          <Field label="Inline"><Num value={exhaustQty("inline")}  onChange={(v) => setExhaustFan("inline", v)}  /></Field>
        </div>
      </div>
      <div className="card">
        <p className="section-tag mb-3">Fixed appliances</p>
        <div className="grid grid-cols-2 gap-x-4 mb-3">
          <Check2 checked={intake.applianceOven}    onChange={(v) => set("applianceOven", v)}    label="Oven" />
          <Check2 checked={intake.applianceCooktop} onChange={(v) => set("applianceCooktop", v)} label="Cooktop" />
          <Check2 checked={intake.applianceHwc}     onChange={(v) => set("applianceHwc", v)}     label="Hot water" />
          <Check2 checked={intake.applianceAircon}  onChange={(v) => set("applianceAircon", v)}  label="Aircon" />
          <Check2 checked={intake.appliancePool}    onChange={(v) => set("appliancePool", v)}    label="Pool / spa" />
          <Check2 checked={intake.evCharger}        onChange={(v) => set("evCharger", v)}        label="EV charger" />
          <Check2 checked={intake.solarConnection}  onChange={(v) => set("solarConnection", v)}  label="Solar / battery" />
        </div>
        {customAppliances.length > 0 && (
          <div className="space-y-2 mb-3">
            {customAppliances.map(ca => (
              <div key={ca.id} className="flex items-center gap-2 bg-[var(--app-bg)] rounded-xl p-2">
                <input value={ca.label} onChange={e => updateCustomAppliance(ca.id, { label: e.target.value })}
                  placeholder="e.g. Sauna" className="app-field text-[13px] flex-1" />
                <select value={ca.phase} onChange={e => updateCustomAppliance(ca.id, { phase: e.target.value as "single"|"three" })}
                  className="app-field text-[13px] w-28">
                  <option value="single">Single phase</option>
                  <option value="three">3-phase</option>
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" value={ca.amps} onChange={e => updateCustomAppliance(ca.id, { amps: Number(e.target.value) })}
                    className="app-field text-[13px] w-16 text-right" min={1} />
                  <span className="text-[12px] text-[var(--ink-faint)]">A</span>
                </div>
                <button onClick={() => removeCustomAppliance(ca.id)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addCustomAppliance} className="btn-secondary text-[12.5px] py-2 w-full justify-center">
          <Plus size={13} /> Add custom appliance
        </button>
      </div>
      <div className="card">
        <p className="section-tag mb-3">Cabling</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {(["1.5","2.5","4","6","10"] as const).map(size => (
            <Field key={size} label={`${size}mm (m)`}><Num value={cableMetres(size)} onChange={(v) => setCableRun(size, v)} /></Field>
          ))}
        </div>
        <Field label="Trenching (m)"><Num value={intake.trenchMetres} onChange={(v) => set("trenchMetres", v)} /></Field>
      </div>
      <div className="card">
        <p className="section-tag mb-3">Safety and compliance</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Smoke alarms"><Num value={intake.smokeAlarms} onChange={(v) => set("smokeAlarms", v)} /></Field>
        </div>
        <Row>
          <Check2 checked={intake.ccew}    onChange={(v) => set("ccew", v)}    label="CCEW certificate" />
          <Check2 checked={intake.callout} onChange={(v) => set("callout", v)} label="Call-out fee" />
        </Row>
        <p className="text-[11.5px] text-[var(--ink-faint)] mt-2">COES is included automatically on all jobs.</p>
      </div>
      <button onClick={() => setShowLib(!showLib)} className="btn-secondary w-full justify-between">
        <span>Material unit prices</span>
        <ChevronRight size={15} className={`transition-transform ${showLib ? "rotate-90" : ""}`} />
      </button>
      {showLib && (
        <>
          <div className="card">
            <p className="section-tag mb-1">Sync from your supplier</p>
            <p className="text-[12px] text-[var(--ink-faint)] mb-3">
              Most suppliers (Middys, Rexel, Tradelink) let you export your trade pricing as CSV. Upload it here and every quote uses real prices.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary text-[12.5px] py-2 px-3 cursor-pointer">
                <Upload size={13} /> Upload supplier price CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              </label>
              <button onClick={downloadCsvTemplate} className="text-[12.5px] font-semibold text-[var(--navy)] underline px-2">
                Download template
              </button>
            </div>
            {csvMessage && <p className="text-[12.5px] text-[var(--ink-soft)] mt-3">{csvMessage}</p>}
          </div>
          {hasRealPriceBook(lib) && (
            <CalcKeyPricingPanel
              trade="electrician"
              defaults={ELECTRICIAN_DEFAULT_MATERIALS}
              lib={lib}
              archetypeDefaults={archetypeDefaults}
              onSaveDefault={saveCalcDefault}
            />
          )}
          {!hasRealPriceBook(lib) && <MaterialsEditor lib={lib} setLib={setLib} trade="electrician" />}
        </>
      )}
    </div>
  );
}

function StepSite({ intake, set }: {
  intake: ElectricianIntake;
  set: <K extends keyof ElectricianIntake>(k: K, v: ElectricianIntake[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-tag mb-3">Access</p>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Roof cavity access">
            <select value={intake.roofAccess} onChange={(e) => set("roofAccess", Number(e.target.value) as ElectricianIntake["roofAccess"])} className="app-field">
              <option value={1}>No roof work needed</option>
              <option value={1.3}>Easy access</option>
              <option value={1.7}>Tight crawl</option>
              <option value={2.3}>Extreme - very difficult</option>
            </select>
          </Field>
          <Field label="Subfloor access">
            <select value={intake.subfloorAccess} onChange={(e) => set("subfloorAccess", Number(e.target.value) as ElectricianIntake["subfloorAccess"])} className="app-field">
              <option value={1}>No subfloor work</option>
              <option value={1.3}>Easy crawl</option>
              <option value={1.8}>Tight crawl</option>
              <option value={2.4}>Wet / very low clearance</option>
            </select>
          </Field>
          <Field label="Overall site access">
            <select value={intake.siteAccess} onChange={(e) => set("siteAccess", e.target.value as ElectricianIntake["siteAccess"])} className="app-field">
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="difficult">Difficult</option>
            </select>
          </Field>
        </div>
      </div>
      <div className="card">
        <p className="section-tag mb-3">Compliance and alarms</p>
        <Field label="Smoke alarms to interconnect" className="mb-3"><Num value={intake.smokeAlarms} onChange={(v) => set("smokeAlarms", v)} /></Field>
        <Row><Check2 checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey" /></Row>
      </div>
    </div>
  );
}

function StepSend({ result, paymentTerms, termsPreset, setTermsPreset, customTerms, setCustomTerms, customTermsTotal,
  clientName, clientEmail, siteAddress,
  saving, saveMessage, savedQuoteId, onSave,
  extraLines, setExtraLines, rate, margin, effectiveMargin, markupTotal, siteItems, setSiteItems, siteTotal, annotationMeta,
  selectedPricingTier, selectedJobSizeTier }: {
  intake: ElectricianIntake;
  result: { labourHours: number; materialsCost: number; totalCost: number };
  paymentTerms: PaymentTerm[];
  termsPreset: string; setTermsPreset: (v: string) => void;
  customTerms: PaymentTerm[]; setCustomTerms: React.Dispatch<React.SetStateAction<PaymentTerm[]>>;
  customTermsTotal: number;
  clientName: string; clientEmail: string; siteAddress: string;
  saving: boolean; saveMessage: string | null; savedQuoteId: string | null;
  onSave: (send: boolean) => void;
  extraLines: {id:string;label:string;hours:number;materialsCost:number;note:string}[];
  setExtraLines: React.Dispatch<React.SetStateAction<{id:string;label:string;hours:number;materialsCost:number;note:string}[]>>;
  rate: number; margin: number; effectiveMargin: number; markupTotal: number;
  siteItems: {id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[];
  setSiteItems: React.Dispatch<React.SetStateAction<{id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[]>>;
  siteTotal: number;
  annotationMeta: {id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string}[];
  selectedPricingTier: { id: string; name: string; markup_pct: number } | null;
  selectedJobSizeTier: { id: string; name: string; markup_pct: number } | null;
}) {
  const siteMaterials = siteItemsMaterialsTotal(siteItems, effectiveMargin ?? 20);

  return (
    <div className="space-y-4">
      <SiteAnnotationReport annotations={annotationMeta} />
      {siteItems.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-tag">On-site items</p>
            <button onClick={() => setSiteItems([])} className="text-[11.5px] text-[var(--red)] font-semibold">Clear all</button>
          </div>
          <div className="space-y-2">
            {siteItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-[var(--app-bg)] rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13.5px] text-[var(--ink)] truncate">{item.label}</p>
                  <p className="text-[11.5px] text-[var(--ink-faint)]">{item.qty} {item.unit}{item.note ? ` · ${item.note}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[13px] text-[var(--ink)]">${Math.round(item.materialsCost + item.labourHrs * rate).toLocaleString()}</p>
                </div>
                <button onClick={() => setSiteItems(p => p.filter(i => i.id !== item.id))} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1"><X size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t border-[var(--line-subtle)]">
            <span className="text-[13px] font-bold text-[var(--ink-soft)]">Site items total</span>
            <span className="font-bold text-[14px] text-[var(--ink)]">${siteTotal.toLocaleString()}</span>
          </div>
        </div>
      )}
      {(selectedPricingTier || selectedJobSizeTier) && (
        <div className="card">
          <p className="section-tag mb-2">Applied pricing</p>
          {selectedPricingTier && (
            <div className="flex justify-between text-[13px]">
              <span className="text-[var(--ink-soft)]">Customer type: {selectedPricingTier.name}</span>
              <span className="font-semibold">+{selectedPricingTier.markup_pct}%</span>
            </div>
          )}
          {selectedJobSizeTier && (
            <div className="flex justify-between text-[13px]">
              <span className="text-[var(--ink-soft)]">Job size: {selectedJobSizeTier.name}</span>
              <span className="font-semibold">{selectedJobSizeTier.markup_pct >= 0 ? '+' : ''}{selectedJobSizeTier.markup_pct}%</span>
            </div>
          )}
          <div className="border-t border-[var(--line-subtle)] pt-1 mt-1 flex justify-between text-[13px]">
            <span className="text-[var(--ink)] font-semibold">Effective materials margin</span>
            <span className="font-bold text-[var(--amber-deep)]">{effectiveMargin}%</span>
          </div>
        </div>
      )}
      <div className="bg-[var(--navy)] rounded-2xl p-5">
        <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
        <div className="space-y-2">
          <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Labour</span><span className="text-white font-semibold tabular">${Math.round(result.labourHours * rate).toLocaleString()}</span></div>
          <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Materials</span><span className="text-white font-semibold tabular">${Math.round(result.materialsCost + markupTotal + extraLinesTotals(extraLines, rate, effectiveMargin).materials).toLocaleString()}</span></div>
          {siteTotal > 0 && <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">On-site items</span><span className="text-white font-semibold tabular">${siteTotal.toLocaleString()}</span></div>}
          {markupTotal > 0 && <div className="flex justify-between text-[12.5px]"><span className="text-[var(--steel-3)]">incl. ${markupTotal.toLocaleString()} from site plans</span></div>}
          <div className="border-t border-white/10 pt-2 flex justify-between">
            <span className="text-white font-bold text-[15px]">Total</span>
            <span className="font-display text-[24px] text-[var(--amber)] leading-tight tabular">${(result.totalCost + markupTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total + siteTotal).toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <p className="section-tag mb-1">Sending to</p>
        <p className="font-semibold text-[var(--ink)]">{clientName || "No client name set"}</p>
        <p className="text-[13px] text-[var(--ink-faint)]">{clientEmail || "No email set - can still save as draft"}</p>
        <p className="text-[13px] text-[var(--ink-faint)]">{siteAddress || "No site address set"}</p>
      </div>
      <ExtraJobLines lines={extraLines} onChange={setExtraLines} hourlyRate={rate} marginPct={effectiveMargin} />
      <div className="card">
        <p className="section-tag mb-3">Payment terms</p>
        <select value={termsPreset} onChange={(e) => setTermsPreset(e.target.value)} className="app-field mb-3">
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
                <span className="font-bold text-[var(--ink)] tabular">{t.percent}% - ${Math.round(((result.totalCost + markupTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total + (siteTotal ?? 0)) * t.percent) / 100).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {customTerms.map((t, i) => (
              <div key={i} className="bg-[var(--app-bg)] rounded-xl p-3 grid grid-cols-[1fr_60px] gap-2">
                <input value={t.label} onChange={(e) => setCustomTerms((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="app-field py-2 text-[13px]" placeholder="Label" />
                <input type="number" value={t.percent} onChange={(e) => setCustomTerms((p) => p.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) } : x))} className="app-field py-2 text-[13px] text-center" />
              </div>
            ))}
            {customTermsTotal !== 100 && <p className="text-[12.5px] text-[var(--red)] font-semibold">Adds up to {customTermsTotal}% - must total 100%</p>}
            <button onClick={() => setCustomTerms((p) => [...p, { label: "Payment", percent: 0, trigger: "completion", days: 7 }])} className="btn-secondary text-[13px] py-2">+ Add term</button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <button onClick={() => onSave(true)} disabled={saving || !clientEmail} className="btn-primary">{saving ? "Sending..." : "Send quote to client"}</button>
        <button onClick={() => onSave(false)} disabled={saving} className="btn-secondary w-full justify-center">Save as draft</button>
        {saveMessage && <div className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold text-center ${saveMessage.includes("fail") || saveMessage.includes("error") ? "bg-[var(--red-bg)] text-[var(--red)]" : "bg-[var(--green-bg)] text-[var(--green)]"}`}>{saveMessage}</div>}
        {savedQuoteId && <a href={`/api/quotes/${savedQuoteId}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center block text-center">Download PDF</a>}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">{label}</span>{children}</label>;
}
function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="app-field" />;
}
function Check2({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-3 py-2.5 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="text-[14.5px] text-[var(--ink)]">{label}</span></label>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--line-subtle)]">{children}</div>;
}
