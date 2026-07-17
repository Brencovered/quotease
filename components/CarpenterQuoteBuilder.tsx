"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { Paperclip, X, ChevronRight, ChevronLeft, Check, Sparkles, AlertTriangle } from "lucide-react";
import { calcCarpenterQuote, CARPENTER_DEFAULT_MATERIALS, type CarpenterIntake } from "@/lib/calcCarpenter";
import MaterialsEditor from "@/components/MaterialsEditor";
import CalcKeyPricingPanel from "@/components/CalcKeyPricingPanel";
import { resolveCalcCosts, hasRealPriceBook, serializeLinkedItemKeys } from "@/lib/resolveCalcCosts";
import StepCustomer from "./StepCustomer";
import PackagePicker from "@/components/PackagePicker";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import PlanMarkupQuickAdd from "./PlanMarkupQuickAdd";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import ExtraJobLines, { type ExtraLine, extraLinesTotals } from "./ExtraJobLines";
import { resolveClientId } from "@/lib/resolveClientId";
import { getActiveBusinessId } from "@/lib/team";
import LiveSiteAnnotation from "@/components/LiveSiteAnnotation";
import DrawingAnalysisReviewTable, { type DetectedItem, type ReviewLineItem } from "@/components/DrawingAnalysisReviewTable";
import { siteItemsLabourTotal, siteItemsMaterialsTotal, siteItemsLabourHours, markupMaterialsToScopeItems } from "@/lib/quotePricing";
import { persistAnnotationFrames } from "@/lib/siteAnnotations";
import JobDescriptionField from "@/components/JobDescriptionField";
import { MaterialSearchAdd, ScopeItemsList, type ScopeItem } from "@/components/ScopeOfWorkStep";
import PeripheralsPanel from "@/components/PeripheralsPanel";
import type { SiteConditionTemplateRow } from "@/lib/peripherals";

type MaterialRow = { item_key: string; label: string; unit_cost: number };

const DEFAULT_INTAKE: CarpenterIntake = {
  jobType: "na",
  internalDoors: 0, externalDoors: 0, doorFramesOnly: 0,
  skirtingMetres: 0, architraveMetres: 0,
  newWallFrames: 0, framingTimberLm: 0, plywoodSheets: 0,
  deckingSqm: 0, deckingBeamLm: 0,
  robeShelvingLm: 0, fasciaLm: 0,
  workingAtHeight: false, siteAccess: "na", multistorey: false, callout: false, notes: "",
};

const STEPS = [
  { id: "customer",  label: "Customer"  },
  { id: "drawing",   label: "Files"     },
  { id: "job",       label: "Job"       },
  { id: "scope",     label: "Scope"     },
  { id: "materials", label: "Materials" },
  { id: "send",      label: "Send"      },
];

export default function CarpenterQuoteBuilder({
  profile, materials, preClientId, preMarkupMaterials, preMarkupSource,
  pricingTiers, jobSizeTiers, siteConditions, teamMembers,
}: {
  profile: { hourly_rate: number; materials_margin_pct: number; archetype_defaults?: Record<string, string> };
  materials: MaterialRow[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number }>;
  preMarkupSource?: "package" | "plan markup" | "material bundle";
  pricingTiers?: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers?: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
  siteConditions?: SiteConditionTemplateRow[];
  teamMembers?: Array<{ id: string; name: string | null; email: string }>;
}) {
  const [step,   setStep]   = useState(0);
  const [intake, setIntake] = useState<CarpenterIntake>(DEFAULT_INTAKE);
  const [rate,   setRate]   = useState(profile.hourly_rate ?? 85);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  const [lib, setLib] = useState<MaterialRow[]>(
    materials.length > 0 ? materials : CARPENTER_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );
  const [archetypeDefaults, setArchetypeDefaults] = useState<Record<string, string>>(
    profile.archetype_defaults ?? {}
  );
  async function saveArchetypeDefault(archetypeKey: string, itemKey: string) {
    const key = `carpenter:${archetypeKey}`;
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
  function saveCalcDefault(calcKey: string, itemKeys: string[]) {
    saveArchetypeDefault(`calc:${calcKey}`, serializeLinkedItemKeys(itemKeys));
  }

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

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [clientId, setClientId] = useState<string | null>(preClientId ?? null);
  const [plannedCrew, setPlannedCrew] = useState<string[]>([]);
  const [termsPreset, setTermsPreset] = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">("full_on_completion");
  const [customTerms] = useState<PaymentTerm[]>([
    { label: "Deposit", percent: 50, trigger: "acceptance", days: 0 },
    { label: "Final",   percent: 50, trigger: "completion",  days: 7 },
  ]);
  const paymentTerms = termsPreset === "custom" ? customTerms : PAYMENT_TERM_PRESETS[termsPreset];
  const customTermsTotal = customTerms.reduce((s, t) => s + (Number(t.percent)||0), 0);
  const [siteItems,     setSiteItems]     = useState<ScopeItem[]>(
    () => markupMaterialsToScopeItems(preMarkupMaterials, preMarkupSource ?? "plan markup")
  );
  const [annotationMeta, setAnnotationMeta] = useState<{id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string;roomName?:string}[]>([]);
  const [siteNotes, setSiteNotes] = useState("");
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);
  // Direct manual override for anything the formula doesn't capture -
  // roof cavity time, confined-space work, or the calculated hours just
  // being wrong for this job.
  const [manualLabourHrs, setManualLabourHrs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [analysisResult, setAnalysisResult] = useState<{ confidence: string; notes: string } | null>(null);
  const [analysisSource, setAnalysisSource] = useState<"drawing" | "voice">("drawing");
  const [usageLimitReached, setUsageLimitReached] = useState(false);

  // Restore draft state from sessionStorage (survives camera navigation)
  useMemo(() => {
    try {
      const raw = sessionStorage.getItem("swiftscope_quote_draft");
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
      if (saved.manualLabourHrs != null) setManualLabourHrs(saved.manualLabourHrs);
      if (saved.siteNotes)   setSiteNotes(saved.siteNotes);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const costs = useMemo(
    () => resolveCalcCosts("carpenter", CARPENTER_DEFAULT_MATERIALS, lib, archetypeDefaults),
    [lib, archetypeDefaults]
  );
  const result = useMemo(() => calcCarpenterQuote(intake, costs, rate, effectiveMargin), [intake, costs, rate, effectiveMargin]);
  // Package / plan-markup / bundle materials are seeded into siteItems on
  // mount, so siteTotal below already covers them - no separate markup*
  // bucket needed any more.
  const siteLabour   = siteItemsLabourTotal(siteItems, rate);
  const siteMaterials = siteItemsMaterialsTotal(siteItems, effectiveMargin);
  const siteTotal    = Math.round(siteLabour + siteMaterials);

  const extraTotalsForDisplay = extraLinesTotals(extraLines, rate, effectiveMargin);
  const extraHoursForDisplay  = extraLines.reduce((s, l) => s + l.hours, 0);
  const displayLabourHours = Math.round((result.labourHours + extraHoursForDisplay + manualLabourHrs) * 10) / 10;
  const displayLabourDollar = Math.round(result.labourHours * rate) + extraTotalsForDisplay.labour + Math.round(manualLabourHrs * rate);
  const displayMaterialsDollar = Math.round(result.materialsCost + extraTotalsForDisplay.materials);

  // Sticky header only: no room there for a separate "on-site items" chip
  // (that breakdown appears further down), so its Labour/Materials figures
  // must fold in package/plan-markup/site items too, or a package-only
  // quote shows misleading near-zero Labour/Materials up top while Total
  // (which already includes siteTotal) looks correct.
  const headerLabourHours = Math.round((displayLabourHours + siteItemsLabourHours(siteItems)) * 10) / 10;
  const headerLabourDollar = displayLabourDollar + Math.round(siteLabour);
  const headerMaterialsDollar = displayMaterialsDollar + Math.round(siteMaterials);

  function set<K extends keyof CarpenterIntake>(k: K, v: CarpenterIntake[K]) { setIntake((p) => ({...p,[k]:v})); }

  async function runAiAnalysis() {
    if (!drawingFiles.length) return;
    setAnalyzing(true); setAnalysisError(null); setAnalysisResult(null); setAnalysisSource("drawing");
    try {
      const fd = new FormData();
      const fileForAnalysis = await normalizeForAnalysis(drawingFiles[0]);
      fd.append("file", fileForAnalysis);
      fd.append("trade", "carpenter");
      fd.append("instructions", "This is a carpentry job. Focus on doors, framing, timber runs, and joinery.");
      const res = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: fd });
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
        body: JSON.stringify({ transcript, trade: "carpenter", instructions: "This is a carpentry job. Focus on doors, framing, timber runs, and joinery." }),
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

  function saveDraft() {
    try {
      sessionStorage.setItem("swiftscope_quote_draft", JSON.stringify({ clientName, clientEmail, siteAddress, intake, step, extraLines, siteItems, annotationMeta, manualLabourHrs, siteNotes }));
      if (lib) sessionStorage.setItem("swiftscope_price_book", JSON.stringify(lib));
    } catch {}
  }

  async function saveAndSend(sendEmail: boolean) {
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
        supabase.from("price_book_items").insert({ profile_id: businessId, supplier: "Custom", description: m.label, cost_price: m.unit_cost, trade: "carpenter", unit: "ea" }),
        supabase.from("material_items").upsert({ profile_id: businessId, trade: "carpenter", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost }, { onConflict: "profile_id,item_key" }),
      ])
    );
    const extraTotals = extraLinesTotals(extraLines, rate, effectiveMargin);
    const siteLabourSave   = siteItemsLabourHours(siteItems);
    const siteMatlsSave    = siteItemsMaterialsTotal(siteItems, effectiveMargin);
    const siteTotalSave    = Math.round(siteLabourSave * rate + siteMatlsSave);
    const persistedAnnotations = await persistAnnotationFrames(supabase, businessId, annotationMeta);
    const { data: quote, error } = await supabase.from("quotes").insert({
      profile_id: businessId,
      client_id: resolvedClientId,
      client_name: clientName,
      client_email: clientEmail,
      site_address: siteAddress,
      site_notes: siteNotes || null,
      trade: "carpenter",
      job_type: intake.jobType,
      planned_crew_member_ids: plannedCrew,
      intake_data: { ...intake, site_items: siteItems, manual_labour_hours: manualLabourHrs, annotation_meta: persistedAnnotations },
      labour_hours: result.labourHours + extraLines.reduce((s,l) => s + l.hours, 0) + siteLabourSave + manualLabourHrs,
      materials_cost: result.materialsCost + extraTotals.materials + siteMatlsSave,
      total_cost: result.totalCost + extraTotals.total + siteTotalSave + Math.round(manualLabourHrs * rate),
      payment_terms: paymentTerms,
      pricing_tier_id: selectedPricingTierId,
      job_size_tier_id: selectedJobSizeTierId,
      // Package/plan/bundle materials now live in site_items (above) so
      // they show up as itemized, editable lines in the Scope step.
      markup_materials: [],
      status: sendEmail ? "sent" : "draft",
      sent_at: sendEmail ? new Date().toISOString() : null,
    }).select().single();
    if (error) { setSaveMessage(error.message); setSaving(false); return; }
    setSavedQuoteId(quote.id);
    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
      const { error: upErr } = await supabase.storage.from("job-files").upload(`${businessId}/${quote.id}/${Date.now()}-${safeName}`, file);
      if (!upErr) await supabase.from("job_attachments").insert({ quote_id: quote.id, profile_id: businessId, file_name: file.name, storage_path: `${businessId}/${quote.id}/${Date.now()}-${safeName}`, file_type: file.type, file_size: file.size });
    }
    if (sendEmail) {
      const res = await fetch("/api/quotes/send", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ quoteId: quote.id }) });
      if (!res.ok) { const b = await res.json().catch(()=>({})); await supabase.from("quotes").update({ status: "draft", sent_at: null }).eq("id", quote.id); setSaveMessage(`Saved - sending failed: ${b.error ?? res.statusText}`); setSaving(false); return; }
      setSaveMessage(`Sent to ${clientEmail}`);
    } else { setSaveMessage("Saved as draft"); }
    setSaving(false);
  }

  const stepId = STEPS[step].id;

  return (
    <div className="page-wrap-narrow">
      <div className="sticky top-12 sm:top-0 z-30 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="bg-[var(--navy)] rounded-none sm:rounded-2xl px-5 py-3 flex items-center justify-between" style={{boxShadow:"0 4px 20px rgba(10,23,34,.18)"}}>
          <div className="flex gap-5">
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Labour</p><p className="font-display text-[18px] text-white leading-tight">{headerLabourHours}h</p></div>
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Materials</p><p className="font-display text-[18px] text-white leading-tight">${headerMaterialsDollar.toLocaleString()}</p></div>
          </div>
          <div className="text-right"><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p><p className="font-display text-[24px] text-[var(--amber)] leading-tight">${(result.totalCost + siteTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total + Math.round(manualLabourHrs * rate)).toLocaleString()}</p></div>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {STEPS.map((s,i) => <button key={s.id} onClick={() => setStep(i)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap ${i===step ? "bg-[var(--navy)] text-white" : i<step ? "bg-[var(--amber-light)] text-[var(--amber-deep)]" : "bg-[var(--surface)] text-[var(--ink-faint)] border border-[var(--line)]"}`}>{i<step && <Check size={11}/>}{s.label}</button>)}
        <div className="w-2 shrink-0" aria-hidden="true" />
      </div>

      {stepId === "customer" && (
        <StepCustomer
          clientName={clientName} setClientName={setClientName}
          clientEmail={clientEmail} setClientEmail={setClientEmail}
          siteAddress={siteAddress} setSiteAddress={setSiteAddress}
          setClientId={setClientId}
        />
      )}

      {stepId === "drawing" && (
        <div className="space-y-4">
          <LiveSiteAnnotation
            trade="carpenter"
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

          <div className="card">
            <p className="section-tag mb-1">Step 1</p>
            <p className="font-semibold text-[17px] mb-4">Upload drawings or site photos</p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-8 cursor-pointer hover:border-[var(--amber)] bg-[var(--app-bg)]">
              <Paperclip size={18} className="text-[var(--ink-faint)]"/><span className="text-[14px] font-semibold text-[var(--ink-soft)]">Add files</span>
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files??[]); setDrawingFiles((p) => [...p, ...f.filter((x) => !p.some((y) => y.name===x.name))]); e.target.value=""; }} />
            </label>
            {drawingFiles.map((f) => <div key={f.name} className="flex items-center gap-3 bg-[var(--app-bg)] rounded-lg px-3 py-2.5 mt-2"><Paperclip size={14} className="text-[var(ink-faint)] shrink-0"/><span className="text-[13.5px] flex-1 truncate">{f.name}</span><button onClick={() => setDrawingFiles((p) => p.filter((x) => x.name!==f.name))}><X size={14} className="text-[var(--ink-faint)]"/></button></div>)}
          </div>

          <PlanMarkupQuickAdd
            lib={lib}
            marginPct={effectiveMargin}
            trade="carpenter"
            onAddItems={(items) => {
              setSiteItems((prev) => [
                ...prev,
                ...items.map((item) => ({
                  id: Math.random().toString(36).slice(2),
                  label: item.label,
                  qty: item.quantity,
                  unit: item.unit,
                  note: "from plan markup",
                  materialsCost: item.totalCost,
                  labourHrs: 0,
                  source: "plan_markup" as const,
                })),
              ]);
            }}
            onFileReady={(file) => setDrawingFiles((prev) => (prev.some((f) => f.name === file.name) ? prev : [...prev, file]))}
          />

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
                  <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">AI reads the drawing and notes what it can. You review everything.</p>
                </div>
              </div>
              <button onClick={runAiAnalysis} disabled={analyzing} className="btn-secondary w-full justify-center"><Sparkles size={15} className="text-[var(--amber-deep)]" />{analyzing ? "Reading..." : "Analyse with AI"}</button>
              {analysisError && <p className="text-[13px] text-[var(--red)] mt-2">{analysisError}</p>}
              {detectedItems.length > 0 && analysisResult && (
                <DrawingAnalysisReviewTable
                  trade="carpenter"
                  detectedItems={detectedItems}
                  confidence={analysisResult.confidence as "high" | "medium" | "low"}
                  notes={analysisResult.notes}
                  lib={lib as { item_key: string; label: string; unit_cost: number }[]}
                  archetypeDefaults={archetypeDefaults}
                  onSaveDefault={saveArchetypeDefault}
                  onAccept={(items: ReviewLineItem[]) => {
                    setSiteItems((prev: {id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[]) => [
                      ...prev,
                      ...items.map(item => ({
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
          )}
        </div>
      )}

      {stepId === "job" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Job details</p>
            <Field label="Job type" className="mb-3"><select value={intake.jobType} onChange={(e) => set("jobType", e.target.value as CarpenterIntake["jobType"])} className="app-field"><option value="na">N/A</option><option value="reno">Renovation / alteration</option><option value="newbuild">New build</option><option value="deck">Deck / outdoor</option><option value="framing">Framing only</option><option value="fitout">Fitout / joinery</option><option value="repair">Repair</option></select></Field>
            {pricingTiers && pricingTiers.length > 0 && (
              <div className="mb-3">
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Customer type</label>
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
              <div className="mb-3">
                <label className="block text-[12.5px] font-semibold text-[var(ink-soft)] mb-1.5">Job size</label>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hourly rate ($)"><input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="app-field"/></Field>
              <Field label="Materials margin (%)"><input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="app-field"/></Field>
            </div>
            <div className="mt-3 divide-y divide-[var(--line-subtle)]">
              <Chk checked={intake.callout} onChange={(v) => set("callout", v)} label="Include call-out / measure fee"/>
              <Chk checked={intake.workingAtHeight} onChange={(v) => set("workingAtHeight", v)} label="Working at height (scaffolding needed)"/>
              <Chk checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey"/>
            </div>
          </div>
          {teamMembers && teamMembers.length > 0 && (
            <div className="card">
              <p className="section-tag mb-1">Staff for this job</p>
              <p className="text-[13px] text-[var(--ink-faint)] mb-3">
                Who this quote assumes will do the work - carries straight over to the job&apos;s crew once accepted.
              </p>
              {plannedCrew.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {plannedCrew.map((id) => {
                    const member = teamMembers.find((m) => m.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-bg)] border border-[var(--line)] pl-3 pr-1.5 py-1 text-[12.5px] font-medium text-[var(--ink)]">
                        {member?.name || member?.email || "Unknown"}
                        <button onClick={() => setPlannedCrew((prev) => prev.filter((p) => p !== id))} className="rounded-full p-0.5 hover:bg-[var(--line)] transition-colors" aria-label={`Remove ${member?.name || member?.email}`}>
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <select value="" onChange={(e) => { if (e.target.value) setPlannedCrew((prev) => [...prev, e.target.value]); }} className="app-field">
                <option value="">Add someone to this job...</option>
                {teamMembers.filter((m) => !plannedCrew.includes(m.id)).map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
          )}
          <div className="card">
            <p className="section-tag mb-3">Site access</p>
            <Field label="Overall site access">
              <select
                value={intake.siteAccess}
                onChange={(e) => {
                  const v = e.target.value as CarpenterIntake["siteAccess"];
                  set("siteAccess", v);
                  if (v !== "custom") set("siteAccessNote", "");
                }}
                className="app-field"
              >
                <option value="na">N/A</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="difficult">Difficult</option>
                <option value="custom">Custom</option>
              </select>
              {intake.siteAccess === "custom" && (
                <input
                  type="text"
                  value={intake.siteAccessNote ?? ""}
                  onChange={(e) => set("siteAccessNote", e.target.value)}
                  placeholder="Describe overall site access"
                  className="app-field mt-2"
                />
              )}
            </Field>
            <div className="mt-4 pt-4 border-t border-[var(--line-subtle)]">
              <Field label="Extra labour hours (manual adjustment)">
                <Num value={manualLabourHrs} onChange={setManualLabourHrs} step={0.5} />
              </Field>
              <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
                Working at height above already adjusts hours automatically, but if this job needs more (or less) time - roof cavity access, a confined space, anything the formula doesn&apos;t capture - add it here. Added straight to the quote total, on top of everything else.
              </p>
            </div>
          </div>
        </div>
      )}

      {stepId === "scope" && (
        <div className="space-y-4">
          <PackagePicker trade="carpenter" />
          <PeripheralsPanel templates={siteConditions ?? []} siteItems={siteItems} setSiteItems={setSiteItems} />
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
        </div>
      )}

      {stepId === "materials" && hasRealPriceBook(lib) && (
        <CalcKeyPricingPanel
          trade="carpenter"
          defaults={CARPENTER_DEFAULT_MATERIALS}
          lib={lib}
          archetypeDefaults={archetypeDefaults}
          onSaveDefault={saveCalcDefault}
        />
      )}
      {stepId === "materials" && !hasRealPriceBook(lib) && <MaterialsEditor lib={lib} setLib={setLib} trade="carpenter" defaults={CARPENTER_DEFAULT_MATERIALS} />}

      {stepId === "send" && (
        <div className="space-y-4">
          <JobDescriptionField value={siteNotes} onChange={setSiteNotes} />
          <div className="bg-[var(--navy)] rounded-2xl p-5">
            <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
            {/* Labour/Materials/hours here match the sticky header and the
                Job detail page: on-site items (site conditions, plan
                markup, packages) are folded into these totals rather than
                broken out as a separate bucket - same fix applied to the
                electrician builder, extended here since this exact same
                discrepancy exists in every trade builder, not just one. */}
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Labour ({headerLabourHours}h)</span><span className="text-white font-semibold tabular">${headerLabourDollar.toLocaleString()}</span></div>
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Materials</span><span className="text-white font-semibold tabular">${headerMaterialsDollar.toLocaleString()}</span></div>
              <div className="border-t border-white/10 pt-2 flex justify-between"><span className="text-white font-bold">Total</span><span className="font-display text-[24px] text-[var(--amber)] tabular">${(result.totalCost + siteTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total + Math.round(manualLabourHrs * rate)).toLocaleString()}</span></div>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-1">Sending to</p>
            <p className="font-semibold text-[var(ink)]">{clientName || "No client name set"}</p>
            <p className="text-[13px] text-[var(ink-faint)]">{clientEmail || "No email set - can still save as draft"}</p>
            <p className="text-[13px] text-[var(ink-faint)]">{siteAddress || "No site address set"}</p>
          </div>
          <ExtraJobLines
            lines={extraLines}
            onChange={setExtraLines}
            hourlyRate={rate}
            marginPct={effectiveMargin}
          />
          <div className="card">
            <p className="section-tag mb-3">Payment terms</p>
            <select value={termsPreset} onChange={(e) => setTermsPreset(e.target.value as keyof typeof PAYMENT_TERM_PRESETS | "custom")} className="app-field mb-3">
              <option value="full_on_completion">100% on completion (14 days)</option>
              <option value="deposit_50_50">50% deposit, 50% on completion</option>
              <option value="deposit_30_70">30% deposit, 70% on completion</option>
              <option value="due_on_invoice">100% due on invoice (7 days)</option>
              <option value="custom">Custom split</option>
            </select>
            <div className="bg-[var(--app-bg)] rounded-xl p-3 space-y-1.5">
              {paymentTerms.map((t,i) => <div key={i} className="flex justify-between text-[13.5px]"><span className="text-[var(ink-soft)]">{t.label}</span><span className="font-bold tabular">{t.percent}% - ${Math.round((result.totalCost + siteTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total + Math.round(manualLabourHrs * rate))*t.percent/100).toLocaleString()}</span></div>)}
            </div>
            {termsPreset === "custom" && customTermsTotal !== 100 && <p className="text-[12.5px] text-[var(--red)] font-semibold mt-1">Adds up to {customTermsTotal}% - must total 100%</p>}
          </div>
          <div className="space-y-3">
            <button onClick={() => saveAndSend(true)} disabled={saving||!clientEmail} className="btn-primary">{saving ? "Sending..." : "Send quote to client"}</button>
            {!clientEmail && !saving && (
              <p className="text-[12.5px] font-semibold text-[var(--amber-deep)] text-center -mt-2">Add a client email (Customer &amp; site step) to send - or save as a draft for now</p>
            )}
            <button onClick={() => saveAndSend(false)} disabled={saving} className="btn-secondary w-full justify-center">Save as draft</button>
            {saveMessage && <div className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold text-center ${saveMessage.includes("fail") ? "bg-[var(--red-bg)] text-[var(--red)]" : "bg-green-50 text-green-600"}`}>{saveMessage}</div>}
            {savedQuoteId && (<a href={`/api/quotes/${savedQuoteId}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center block text-center">Download PDF</a>)}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 0 && <button onClick={() => setStep(step-1)} className="btn-secondary flex-1"><ChevronLeft size={16}/> Back</button>}
        {step < STEPS.length-1 && <button onClick={() => setStep(step+1)} className="btn-primary flex-1">{STEPS[step+1].label} <ChevronRight size={16}/></button>}
      </div>
    </div>
  );
}

function Field({ label, children, className="" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="block text-[12.5px] font-semibold text-[var(ink-soft)] mb-1.5">{label}</span>{children}</label>;
}
function Num({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" inputMode="numeric" min={0} step={step ?? 1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="app-field"/>;
}
function Chk({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-3 py-2.5 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}/><span className="text-[14.5px] text-[var(ink)]">{label}</span></label>;
}
