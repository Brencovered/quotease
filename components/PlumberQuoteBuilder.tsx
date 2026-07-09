"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { AlertTriangle, Paperclip, X, Sparkles, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import { calcPlumberQuote, PLUMBER_DEFAULT_MATERIALS, type PlumberIntake } from "@/lib/calcPlumber";
import MaterialsEditor from "@/components/MaterialsEditor";
import CalcKeyPricingPanel from "@/components/CalcKeyPricingPanel";
import { resolveCalcCosts, hasRealPriceBook, serializeLinkedItemKeys } from "@/lib/resolveCalcCosts";
import StepCustomer from "./StepCustomer";
import PackagePicker from "@/components/PackagePicker";
import ExtraJobLines, { type ExtraLine, extraLinesTotals } from "./ExtraJobLines";
import { resolveClientId } from "@/lib/resolveClientId";
import { getActiveBusinessId } from "@/lib/team";
import LiveSiteAnnotation from "@/components/LiveSiteAnnotation";
import DrawingAnalysisReviewTable, { type DetectedItem, type ReviewLineItem } from "@/components/DrawingAnalysisReviewTable";
import { siteItemsLabourTotal, siteItemsMaterialsTotal, siteItemsLabourHours, markupMaterialsToScopeItems } from "@/lib/quotePricing";
import { MaterialSearchAdd, ScopeItemsList, type ScopeItem } from "@/components/ScopeOfWorkStep";

type MaterialRow = { item_key: string; label: string; unit_cost: number };

const DEFAULT_INTAKE: PlumberIntake = {
  jobType: "reno",
  basinTaps: 0, kitchenTaps: 0, showerMixers: 0, bathMixers: 0, toilets: 0,
  hwuReplacement: false, hwuType: "none",
  newBathroomRoughin: false, newKitchenRoughin: false, newLaundryRoughin: false,
  gasPoints: 0, gasCertRequired: false,
  copperMetres: 0, pexMetres: 0, drainageMetres: 0,
  blockageClear: false, cctv: false,
  subfloorAccess: "none", slabPenetrations: 0, multistorey: false,
  callout: false, certRequired: false, siteAccess: "easy", notes: "",
};

const STEPS = [
  { id: "customer",  label: "Customer"  },
  { id: "drawing",   label: "Files"     },
  { id: "job",       label: "Job"       },
  { id: "scope",     label: "Scope"     },
  { id: "materials", label: "Materials" },
  { id: "send",      label: "Send"      },
];

export default function PlumberQuoteBuilder({
  profile, materials, preClientId, preMarkupMaterials, preMarkupSource,
  pricingTiers, jobSizeTiers,
}: {
  profile: { hourly_rate: number; materials_margin_pct: number; archetype_defaults?: Record<string, string> };
  materials: MaterialRow[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number }>;
  preMarkupSource?: "package" | "plan markup" | "material bundle";
  pricingTiers?: Array<{ id: string; name: string; markup_pct: number; sort_order: number }>;
  jobSizeTiers?: Array<{ id: string; name: string; max_days: number | null; markup_pct: number; sort_order: number }>;
}) {
  const [step,   setStep]   = useState(0);
  const [intake, setIntake] = useState<PlumberIntake>(DEFAULT_INTAKE);
  const [rate,   setRate]   = useState(profile.hourly_rate ?? 95);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  const [lib, setLib] = useState<MaterialRow[]>(
    materials.length > 0 ? materials : PLUMBER_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );
  // Remembered archetype -> real price book product mappings (shared column
  // across trades, keyed "trade:archetypeKey" / "trade:calc:calcKey").
  const [archetypeDefaults, setArchetypeDefaults] = useState<Record<string, string>>(
    profile.archetype_defaults ?? {}
  );
  async function saveArchetypeDefault(archetypeKey: string, itemKey: string) {
    const key = `plumber:${archetypeKey}`;
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

  const [clientName,    setClientName]    = useState("");
  const [clientEmail,   setClientEmail]   = useState("");
  const [siteAddress,   setSiteAddress]   = useState("");
  const [clientId, setClientId] = useState<string | null>(preClientId ?? null);
  const [termsPreset,   setTermsPreset]   = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">("full_on_completion");
  const [customTerms,   setCustomTerms]   = useState<PaymentTerm[]>([
    { label: "Deposit", percent: 50, trigger: "acceptance", days: 0 },
    { label: "Final",   percent: 50, trigger: "completion",  days: 7 },
  ]);
  const paymentTerms      = termsPreset === "custom" ? customTerms : PAYMENT_TERM_PRESETS[termsPreset];
  const customTermsTotal  = customTerms.reduce((s, t) => s + (Number(t.percent) || 0), 0);

  const [siteItems,     setSiteItems]     = useState<ScopeItem[]>(
    () => markupMaterialsToScopeItems(preMarkupMaterials, preMarkupSource ?? "plan markup")
  );
  const [annotationMeta, setAnnotationMeta] = useState<{id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string;roomName?:string}[]>([]);
  const [extraLines, setExtraLines]   = useState<ExtraLine[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ confidence: string; notes: string } | null>(null);
  const [analysisError,  setAnalysisError]  = useState<string | null>(null);
  const [detectedItems,  setDetectedItems]  = useState<DetectedItem[]>([]);
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
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const costs = useMemo(
    () => resolveCalcCosts("plumber", PLUMBER_DEFAULT_MATERIALS, lib, archetypeDefaults),
    [lib, archetypeDefaults]
  );
  const result = useMemo(() => calcPlumberQuote(intake, costs, rate, effectiveMargin), [intake, costs, rate, effectiveMargin]);
  // Package / plan-markup / bundle materials are seeded into siteItems on
  // mount, so siteTotal below already covers them - no separate markup*
  // bucket needed any more.
  const siteLabour   = siteItemsLabourTotal(siteItems, rate);
  const siteMaterials = siteItemsMaterialsTotal(siteItems, effectiveMargin);
  const siteTotal    = Math.round(siteLabour + siteMaterials);

  const extraTotalsForDisplay = extraLinesTotals(extraLines, rate, effectiveMargin);
  const extraHoursForDisplay  = extraLines.reduce((s, l) => s + l.hours, 0);
  const displayLabourHours = Math.round((result.labourHours + extraHoursForDisplay) * 10) / 10;
  const displayLabourDollar = Math.round(result.labourHours * rate) + extraTotalsForDisplay.labour;
  const displayMaterialsDollar = Math.round(result.materialsCost + extraTotalsForDisplay.materials);

  function set<K extends keyof PlumberIntake>(k: K, v: PlumberIntake[K]) { setIntake((p) => ({ ...p, [k]: v })); }

  function handleDrawingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setDrawingFiles((prev) => { const ex = new Set(prev.map((f) => f.name)); return [...prev, ...files.filter((f) => !ex.has(f.name))]; });
    setAnalysisResult(null); setAnalysisError(null); e.target.value = "";
  }

  async function runAiAnalysis() {
    if (!drawingFiles.length) return;
    setAnalyzing(true); setAnalysisError(null); setAnalysisResult(null);
    try {
      const fd = new FormData();
      const fileForAnalysis = await normalizeForAnalysis(drawingFiles[0]);
      fd.append("file", fileForAnalysis);
      fd.append("trade", "plumber");
      fd.append("instructions", "This is a plumbing job. Focus on wet areas, fixture counts, pipe runs.");
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
    setAnalyzing(true); setAnalysisError(null); setAnalysisResult(null); setUsageLimitReached(false);
    try {
      const res = await fetch("/api/quotes/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, trade: "plumber", instructions: "This is a plumbing job. Focus on wet areas, fixture counts, pipe runs." }),
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
      sessionStorage.setItem("swiftscope_quote_draft", JSON.stringify({ clientName, clientEmail, siteAddress, intake, step, extraLines, siteItems, annotationMeta }));
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
        supabase.from("price_book_items").insert({ profile_id: businessId, supplier: "Custom", description: m.label, cost_price: m.unit_cost, trade: "plumber", unit: "ea" }),
        supabase.from("material_items").upsert({ profile_id: businessId, trade: "plumber", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost }, { onConflict: "profile_id,item_key" }),
      ])
    );
    const extraTotals = extraLinesTotals(extraLines, rate, effectiveMargin);
    const siteLabourSave   = siteItemsLabourHours(siteItems);
    const siteMatlsSave    = siteItemsMaterialsTotal(siteItems, effectiveMargin);
    const siteTotalSave    = Math.round(siteLabourSave * rate + siteMatlsSave);
    const { data: quote, error } = await supabase.from("quotes").insert({
      profile_id: businessId,
      client_id: resolvedClientId,
      client_name: clientName,
      client_email: clientEmail,
      site_address: siteAddress,
      trade: "plumber",
      job_type: intake.jobType,
      intake_data: { ...intake, site_items: siteItems, annotation_meta: annotationMeta.map(a => ({ ...a, frameData: "" })) },
      labour_hours: result.labourHours + extraLines.reduce((s,l) => s + l.hours, 0) + siteLabourSave,
      materials_cost: result.materialsCost + extraTotals.materials + siteMatlsSave,
      total_cost: result.totalCost + extraTotals.total + siteTotalSave,
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
    setSavedQuoteId(quote.id);
    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
      const path = `${businessId}/${quote.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("job-files").upload(path, file);
      if (!upErr) await supabase.from("job_attachments").insert({ quote_id: quote.id, profile_id: businessId, file_name: file.name, storage_path: path, file_type: file.type, file_size: file.size });
    }
    if (sendEmail) {
      const res = await fetch("/api/quotes/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.id }) });
      if (!res.ok) { const b = await res.json().catch(()=>({})); setSaveMessage(`Saved - sending failed: ${b.error ?? res.statusText}`); setSaving(false); return; }
      setSaveMessage(`Sent to ${clientEmail}`);
    } else { setSaveMessage("Saved as draft"); }
    setSaving(false);
  }

  const stepId = STEPS[step].id;

  return (
    <div className="page-wrap-narrow">
      {/* Live total */}
      <div className="sticky top-12 sm:top-0 z-30 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="bg-[var(--navy)] rounded-none sm:rounded-2xl px-5 py-3 flex items-center justify-between" style={{ boxShadow:"0 4px 20px rgba(10,23,34,.18)" }}>
          <div className="flex gap-5">
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Labour</p><p className="font-display text-[18px] text-white leading-tight">{displayLabourHours}h</p></div>
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Materials</p><p className="font-display text-[18px] text-white leading-tight">${displayMaterialsDollar.toLocaleString()}</p></div>
          </div>
          <div className="text-right"><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p><p className="font-display text-[24px] text-[var(--amber)] leading-tight">${(result.totalCost + siteTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total).toLocaleString()}</p></div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap transition-all ${i === step ? "bg-[var(--navy)] text-white" : i < step ? "bg-[var(--amber-light)] text-[var(--amber-deep)]" : "bg-[var(--surface)] text-[var(--ink-faint)] border border-[var(--line)]"}`}>
            {i < step && <Check size={11} />}{s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
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
            trade="plumber"
            lib={lib}
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
                })),
              ]);
            }}
          />

          <div className="card">
            <p className="section-tag mb-1">Step 1</p>
            <p className="font-semibold text-[17px] mb-1">Upload drawings</p>
            <p className="text-[13px] text-[var(--ink-faint)] mb-4">Floor plans, photos, existing plumbing layout.</p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-8 cursor-pointer hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
              <Paperclip size={18} className="text-[var(--ink-faint)]" />
              <span className="text-[14px] font-semibold text-[var(--ink-soft)]">Add drawings or photos</span>
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleDrawingUpload} />
            </label>
            {drawingFiles.length > 0 && <div className="mt-3 space-y-2">{drawingFiles.map((f) => <div key={f.name} className="flex items-center gap-3 bg-[var(--app-bg)] rounded-lg px-3 py-2.5"><Paperclip size={14} className="text-[var(--ink-faint)] shrink-0" /><span className="text-[13.5px] flex-1 truncate">{f.name}</span><button onClick={() => setDrawingFiles((p) => p.filter((x) => x.name !== f.name))}><X size={14} className="text-[var(--ink-faint)]" /></button></div>)}</div>}
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
              <div className="flex items-start gap-3 mb-3"><Sparkles size={18} className="text-[var(--amber-deep)] mt-0.5 shrink-0" /><div><p className="font-semibold">AI field pre-fill (optional)</p><p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">AI reads the drawing and notes what it can. You review everything.</p></div></div>
              <button onClick={runAiAnalysis} disabled={analyzing} className="btn-secondary w-full justify-center"><Sparkles size={15} className="text-[var(--amber-deep)]" />{analyzing ? "Reading..." : "Analyse with AI"}</button>
              {analysisError && <p className="text-[13px] text-[var(--red)] mt-2">{analysisError}</p>}
              {detectedItems.length > 0 && analysisResult && (
                <DrawingAnalysisReviewTable
                  trade="plumber"
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
                        note: "from drawing analysis",
                        materialsCost: item.total ?? 0,
                        labourHrs: item.labourHrs,
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
            <Field label="Job type" className="mb-3"><select value={intake.jobType} onChange={(e) => set("jobType", e.target.value as PlumberIntake["jobType"])} className="app-field"><option value="reno">Renovation / alteration</option><option value="newbuild">New build</option><option value="fault">Fault / leak repair</option><option value="gasfitting">Gas fitting</option><option value="drainage">Drainage / sewer</option><option value="compliance">Compliance check</option></select></Field>
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
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Job size</label>
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
              <Field label="Hourly rate ($)"><input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="app-field" /></Field>
              <Field label="Materials margin (%)"><input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="app-field" /></Field>
            </div>
            <div className="mt-3 divide-y divide-[var(--line-subtle)]">
              <Chk checked={intake.callout} onChange={(v) => set("callout", v)} label="Include call-out fee" />
              <Chk checked={intake.certRequired} onChange={(v) => set("certRequired", v)} label="Compliance certificate required" />
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Hot water</p>
            <Chk checked={intake.hwuReplacement} onChange={(v) => set("hwuReplacement", v)} label="Hot water unit replacement" />
            {intake.hwuReplacement && (
              <Field label="Type" className="mt-3"><select value={intake.hwuType} onChange={(e) => set("hwuType", e.target.value as PlumberIntake["hwuType"])} className="app-field"><option value="electric">Electric</option><option value="gas">Gas</option><option value="heatpump">Heat pump</option></select></Field>
            )}
          </div>
        </div>
      )}

      {stepId === "scope" && (
        <div className="space-y-4">
          <PackagePicker trade="plumber" />
          <div className="card">
            <p className="section-tag mb-3">Conditions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Subfloor access"><select value={intake.subfloorAccess} onChange={(e) => set("subfloorAccess", e.target.value as PlumberIntake["subfloorAccess"])} className="app-field"><option value="none">No subfloor work</option><option value="easy">Easy crawl</option><option value="tight">Tight crawl</option><option value="wet">Wet / very low</option></select></Field>
              <Field label="Overall site access"><select value={intake.siteAccess} onChange={(e) => set("siteAccess", e.target.value as PlumberIntake["siteAccess"])} className="app-field"><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option></select></Field>
            </div>
            <div className="mt-3">
              <Chk checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey" />
              <Chk checked={intake.gasCertRequired} onChange={(v) => set("gasCertRequired", v)} label="Gas compliance cert required" />
            </div>
          </div>
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
          trade="plumber"
          defaults={PLUMBER_DEFAULT_MATERIALS}
          lib={lib}
          archetypeDefaults={archetypeDefaults}
          onSaveDefault={saveCalcDefault}
        />
      )}
      {stepId === "materials" && !hasRealPriceBook(lib) && <MaterialsEditor lib={lib} setLib={setLib} trade="plumber" />}

      {stepId === "send" && (
        <div className="space-y-4">
          <div className="bg-[var(--navy)] rounded-2xl p-5">
            <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Labour ({displayLabourHours}h)</span><span className="text-white font-semibold tabular">${displayLabourDollar.toLocaleString()}</span></div>
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Materials</span><span className="text-white font-semibold tabular">${displayMaterialsDollar.toLocaleString()}</span></div>
              {siteTotal > 0 && <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">On-site items</span><span className="text-white font-semibold tabular">${siteTotal.toLocaleString()}</span></div>}
              <div className="border-t border-white/10 pt-2 flex justify-between"><span className="text-white font-bold text-[15px]">Total</span><span className="font-display text-[24px] text-[var(--amber)] tabular">${(result.totalCost + siteTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total).toLocaleString()}</span></div>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-1">Sending to</p>
            <p className="font-semibold text-[var(--ink)]">{clientName || "No client name set"}</p>
            <p className="text-[13px] text-[var(--ink-faint)]">{clientEmail || "No email set - can still save as draft"}</p>
            <p className="text-[13px] text-[var(--ink-faint)]">{siteAddress || "No site address set"}</p>
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
            {termsPreset !== "custom" ? (
              <div className="bg-[var(--app-bg)] rounded-xl p-3 space-y-1.5">
                {paymentTerms.map((t, i) => <div key={i} className="flex justify-between text-[13.5px]"><span className="text-[var(--ink-soft)]">{t.label}</span><span className="font-bold tabular">{t.percent}% - ${Math.round((result.totalCost + siteTotal + extraLinesTotals(extraLines, rate, effectiveMargin).total) * t.percent / 100).toLocaleString()}</span></div>)}
              </div>
            ) : (
              <div className="space-y-2">
                {customTerms.map((t, i) => <div key={i} className="grid grid-cols-[1fr_60px] gap-2 bg-[var(--app-bg)] rounded-xl p-3"><input value={t.label} onChange={(e) => setCustomTerms((p) => p.map((x,j) => j===i ? {...x,label:e.target.value} : x))} className="app-field py-2 text-[13px]" /><input type="number" value={t.percent} onChange={(e) => setCustomTerms((p) => p.map((x,j) => j===i ? {...x,percent:Number(e.target.value)} : x))} className="app-field py-2 text-[13px] text-center" /></div>)}
                {customTermsTotal !== 100 && <p className="text-[12.5px] text-[var(--red)] font-semibold">Adds up to {customTermsTotal}% - must total 100%</p>}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <button onClick={() => saveAndSend(true)} disabled={saving || !clientEmail} className="btn-primary">{saving ? "Sending..." : "Send quote to client"}</button>
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
  return <label className={`block ${className}`}><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">{label}</span>{children}</label>;
}
function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="app-field" />;
}
function Chk({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-3 py-2.5 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="text-[14.5px] text-[var(--ink)]">{label}</span></label>;
}
