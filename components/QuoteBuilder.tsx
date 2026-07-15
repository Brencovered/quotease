"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { AlertTriangle, Paperclip, X, Sparkles, ChevronRight, ChevronLeft, Check, Upload, Plus } from "lucide-react";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import PlanMarkupQuickAdd from "./PlanMarkupQuickAdd";
import StepCustomer from "./StepCustomer";
import ExtraJobLines, { extraLinesTotals } from "./ExtraJobLines";
import { resolveClientId } from "@/lib/resolveClientId";
import { getActiveBusinessId } from "@/lib/team";
import MaterialsEditor from "@/components/MaterialsEditor";
import CalcKeyPricingPanel from "@/components/CalcKeyPricingPanel";
import PriceHint from "@/components/PriceHint";
import PackagePicker from "@/components/PackagePicker";
import { resolveCalcCosts, hasRealPriceBook, serializeLinkedItemKeys } from "@/lib/resolveCalcCosts";
import LiveSiteAnnotation from "@/components/LiveSiteAnnotation";
import DrawingAnalysisReviewTable, { type DetectedItem, type ReviewLineItem } from "@/components/DrawingAnalysisReviewTable";
import SiteAnnotationReport from "@/components/SiteAnnotationReport";
import { siteItemsLabourTotal, siteItemsMaterialsTotal, siteItemsLabourHours, markupMaterialsToScopeItems } from "@/lib/quotePricing";
import { MaterialSearchAdd, ScopeItemsList, type ScopeItem } from "@/components/ScopeOfWorkStep";
import PeripheralsPanel from "@/components/PeripheralsPanel";
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
  { id: "scope",      label: "Scope" },
  { id: "send",       label: "Send" },
];

export default function QuoteBuilder({
  profile, materials, preClientId, preMarkupMaterials, preMarkupSource,
  pricingTiers, jobSizeTiers,
}: {
  profile: { hourly_rate: number; materials_margin_pct: number; default_deposit_pct?: number | null; default_expiry_days?: number; archetype_defaults?: Record<string, string> };
  materials: MaterialRow[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number; labourHrs?: number }>;
  preMarkupSource?: "package" | "plan markup" | "material bundle";
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
  function saveCalcDefault(calcKey: string, itemKeys: string[]) {
    saveArchetypeDefault(`calc:${calcKey}`, serializeLinkedItemKeys(itemKeys));
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
  // Direct manual override for anything the formula above doesn't capture
  // - roof cavity time, confined-space work, or the calculated hours just
  // being wrong for this particular job. The archetype formula only ever
  // derives hours from counts x per-unit estimates x access multipliers;
  // this is the tradie's own correction on top of that, always visible,
  // no separate "additional job" needed just to bump the hours.
  const [manualLabourHrs, setManualLabourHrs] = useState(0);
  const [siteItems, setSiteItems]     = useState<ScopeItem[]>(
    () => markupMaterialsToScopeItems(preMarkupMaterials, preMarkupSource ?? "plan markup")
  );
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
        clientName, clientEmail, siteAddress, intake, step, extraLines, siteItems, annotationMeta, manualLabourHrs,
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
      if (saved.manualLabourHrs != null) setManualLabourHrs(saved.manualLabourHrs);
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
  // Package / plan-markup / bundle materials are seeded into siteItems on
  // mount (see useState above), so siteTotal below already covers them -
  // no separate markup* bucket needed any more.
  const siteLabour    = siteItemsLabourTotal(siteItems, rate ?? 95);
  const siteMaterials = siteItemsMaterialsTotal(siteItems, effectiveMargin ?? 20);
  const siteTotal     = Math.round(siteLabour + siteMaterials);

  // Displayed Labour/Materials split, covering every source EXCEPT on-site
  // items (which already have their own correctly-bucketed "On-site items"
  // line below and shouldn't be double-counted here) - base intake and
  // extra job lines only.
  const extraTotalsForDisplay = extraLinesTotals(extraLines, rate, effectiveMargin);
  const extraHoursForDisplay  = extraLines.reduce((s, l) => s + l.hours, 0);
  const displayLabourHours = Math.round((result.labourHours + extraHoursForDisplay + manualLabourHrs) * 10) / 10;
  const displayLabourDollar = Math.round(result.labourHours * rate) + extraTotalsForDisplay.labour + Math.round(manualLabourHrs * rate);
  const displayMaterialsDollar = Math.round(result.materialsCost + extraTotalsForDisplay.materials);

  // Sticky header only: it has no room for a separate "on-site items" chip
  // like the Review step breakdown does, so its Labour/Materials figures
  // must fold in package/plan-markup/drawing/voice/live-annotate items too
  // -- otherwise a package-only quote shows misleading near-zero Labour and
  // Materials up top while Total (which already includes siteTotal) looks
  // correct, making it seem like labour/materials "aren't applied".
  const headerLabourHours = Math.round((displayLabourHours + siteItemsLabourHours(siteItems)) * 10) / 10;
  const headerLabourDollar = displayLabourDollar + Math.round(siteLabour);
  const headerMaterialsDollar = displayMaterialsDollar + Math.round(siteMaterials);

  function set<K extends keyof ElectricianIntake>(key: K, value: ElectricianIntake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  function addDrawingFile(file: File) {
    setDrawingFiles((prev) => (prev.some((f) => f.name === file.name) ? prev : [...prev, file]));
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
      // Voice quote used to write straight into fixed count fields
      // (powerPoints, lightPoints, etc.) that no longer have any UI -
      // these now become scope items, same as plan markup / live
      // annotate / drawing extract, priced from the tradie's own linked
      // costs where available. Smoke alarms stays a Condition (it's a
      // compliance/labour-multiplier input, not a material line).
      const newItems: Omit<ScopeItem, "id">[] = [];
      const addVoiceItem = (label: string, qty: number | undefined, calcKey: string, hrsPerUnit: number, unit = "each") => {
        if (!qty || qty <= 0) return;
        const unitCost = costs[calcKey] ?? 0;
        newItems.push({ label, qty, unit, note: "from voice quote", materialsCost: Math.round(unitCost * qty * 100) / 100, labourHrs: Math.round(hrsPerUnit * qty * 100) / 100, source: "voice" });
      };
      addVoiceItem("Power point", r.power_points, "pp", 0.4);
      addVoiceItem("Light point", r.light_points, "lp", 0.5);
      addVoiceItem("Switch", r.switches, "sw", 0.3);
      addVoiceItem("Downlight", r.downlights, "dl_client_supply", 0.4);
      addVoiceItem("Data point", r.data_points, "data", 0.5);
      if (r.switchboard_upgrade) newItems.push({ label: "Switchboard upgrade", qty: 1, unit: "each", note: "from voice quote", materialsCost: costs["switchboard_upgrade"] ?? 0, labourHrs: 3, source: "voice" });
      if (r.three_phase) newItems.push({ label: "3-phase supply upgrade", qty: 1, unit: "each", note: "from voice quote", materialsCost: costs["three_phase"] ?? 0, labourHrs: 2, source: "voice" });
      if (newItems.length > 0) {
        setSiteItems((prev) => [...prev, ...newItems.map((it) => ({ ...it, id: Math.random().toString(36).slice(2) }))]);
      }
      if (typeof r.smoke_alarms === "number") {
        setIntake((prev) => ({ ...prev, smokeAlarms: r.smoke_alarms }));
      }
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

    // Only seed materials that aren't already real price-book rows (i.e.
    // the default archetype materials shown before a tradie has any real
    // price book). Every save was previously re-writing the ENTIRE lib -
    // hundreds of items for anyone with a real price book, none of which
    // had actually changed since lib is never mutated in this component -
    // two sequential round trips per item, on every single save. That was
    // the actual cause of "save to draft takes ages".
    const isUuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const itemsNeedingSeed = lib.filter((m) => !isUuidRe.test(m.item_key));
    await Promise.all(
      itemsNeedingSeed.flatMap((m) => [
        supabase.from("price_book_items").insert({
          profile_id: businessId, supplier: "Custom", description: m.label, cost_price: m.unit_cost, trade: "electrician", unit: "ea",
        }),
        supabase.from("material_items").upsert(
          { profile_id: businessId, trade: "electrician", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost },
          { onConflict: "profile_id,item_key" }
        ),
      ])
    );

    const extraTotals    = extraLinesTotals(extraLines, rate, effectiveMargin);
    const siteLabourSave = siteItemsLabourHours(siteItems);
    const siteMatlsSave  = siteItemsMaterialsTotal(siteItems, effectiveMargin);
    const siteTotalSave  = Math.round(siteLabourSave * rate + siteMatlsSave);

    const quotePayload: Record<string, unknown> = {
      profile_id: businessId, client_id: resolvedClientId, client_name: clientName, client_email: clientEmail,
      site_address: siteAddress, trade: "electrician", job_type: intake.jobType,
      intake_data: {
        ...intake,
        site_items:      siteItems,
        manual_labour_hours: manualLabourHrs,
        annotation_meta: annotationMeta.map(a => ({ ...a, frameData: "" })),
      },
      labour_hours:   result.labourHours + extraLines.reduce((s, l) => s + l.hours, 0) + siteLabourSave + manualLabourHrs,
      materials_cost: Math.round(result.materialsCost + extraTotals.materials + siteMatlsSave),
      total_cost:     result.totalCost + extraTotals.total + siteTotalSave + Math.round(manualLabourHrs * rate),
      payment_terms:  paymentTerms,
      quote_expires_at: new Date(Date.now() + (profile.default_expiry_days ?? 30) * 86400000).toISOString(),
      status:  sendEmail ? "sent" : "draft",
      sent_at: sendEmail ? new Date().toISOString() : null,
      // Package/plan/bundle materials now live in site_items (above) so
      // they show up as itemized, editable lines in the Scope step. This
      // field stays empty for new quotes - keep it writable for older
      // readers (Xero sync, invoice PDF, quote/job detail pages) that
      // still check it, but there's nothing left to duplicate into it.
      markup_materials: [],
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
        // The insert above already wrote status: "sent" optimistically -
        // since sending just failed, that's now a lie sitting in the DB
        // (the client never actually got an email). Revert it back to
        // draft rather than leave the quote looking delivered when it isn't.
        await supabase.from("quotes").update({ status: "draft", sent_at: null }).eq("id", quote.id);
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
              <p className="font-display text-[18px] text-white leading-tight">{headerLabourHours}h</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Materials</p>
              <p className="font-display text-[18px] text-white leading-tight">${headerMaterialsDollar.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p>
            <p className="font-display text-[24px] text-[var(--amber)] leading-tight tabular">${(result.totalCost + extraLinesTotals(extraLines, rate, effectiveMargin).total + siteTotal + Math.round(manualLabourHrs * rate)).toLocaleString()}</p>
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
                source:       "drawing" as const,
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
                source: "annotation" as const,
              })),
            ]);
          }}
          marginPct={effectiveMargin}
          onAddMarkupItems={(items) => {
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
          onMarkupFileReady={addDrawingFile}
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

      {stepId === "scope" && (
        <StepScope
          intake={intake} set={set}
          siteItems={siteItems} setSiteItems={setSiteItems}
          lib={lib}
          manualLabourHrs={manualLabourHrs} setManualLabourHrs={setManualLabourHrs}
        />
      )}

      {stepId === "customer" && (
        <>
          <PackagePicker trade="electrician" />
          <StepCustomer
            clientName={clientName} setClientName={setClientName}
            clientEmail={clientEmail} setClientEmail={setClientEmail}
            siteAddress={siteAddress} setSiteAddress={setSiteAddress}
            onCeilingHint={(hint) => set("ceilingType", hint as ElectricianIntake["ceilingType"])}
            setClientId={setClientId}
          />
        </>
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
          siteItems={siteItems} setSiteItems={setSiteItems} siteTotal={siteTotal} annotationMeta={annotationMeta}
          displayLabourDollar={displayLabourDollar} displayMaterialsDollar={displayMaterialsDollar} manualLabourHrs={manualLabourHrs}
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

function StepDrawing({ drawingFiles, drawingInstructions, setDrawingInstructions, analyzing, analysisResult, detectedItems, analysisError, usageLimitReached, archetypeDefaults, onSaveArchetypeDefault, onUpload, onRemove, onAnalyse, onAcceptDetected, onDismissDetected, onVoiceTranscript, trade, lib, onSaveDraft, onAnnotationMeta, onAddLiveItems, marginPct, onAddMarkupItems, onMarkupFileReady }: {
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
  marginPct: number;
  onAddMarkupItems: (items: { label: string; quantity: number; unit: string; totalCost: number }[]) => void;
  onMarkupFileReady: (file: File) => void;
}) {
  return (
    <div className="space-y-4">
      <LiveSiteAnnotation trade={trade} lib={lib} archetypeDefaults={archetypeDefaults} onSaveDefault={onSaveArchetypeDefault} onSaveDraft={onSaveDraft} onAnnotationMeta={onAnnotationMeta} onAddLineItems={onAddLiveItems} />
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
      <PlanMarkupQuickAdd
        lib={lib}
        marginPct={marginPct}
        trade={trade}
        onAddItems={onAddMarkupItems}
        onFileReady={onMarkupFileReady}
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

function StepScope({ intake, set, siteItems, setSiteItems, lib, manualLabourHrs, setManualLabourHrs }: {
  intake: ElectricianIntake;
  set: <K extends keyof ElectricianIntake>(k: K, v: ElectricianIntake[K]) => void;
  siteItems: ScopeItem[];
  setSiteItems: React.Dispatch<React.SetStateAction<ScopeItem[]>>;
  lib: MaterialRow[];
  manualLabourHrs: number;
  setManualLabourHrs: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-tag mb-3">Conditions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <Field label="Smoke alarms to interconnect"><Num value={intake.smokeAlarms} onChange={(v) => set("smokeAlarms", v)} /></Field>
        </div>
        <div className="mt-3">
          <Row><Check2 checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey" /></Row>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--line-subtle)]">
          <Field label="Extra labour hours (manual adjustment)">
            <Num value={manualLabourHrs} onChange={setManualLabourHrs} step={0.5} />
          </Field>
          <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">
            Roof cavity and subfloor access above already adjust hours automatically, but if this job needs more (or less) time than that - a tighter confined space, awkward scaffolding, anything the formula doesn&apos;t capture - add it here. Added straight to the quote total, on top of everything else.
          </p>
        </div>
      </div>

      <PeripheralsPanel trade="electrician" siteItems={siteItems} setSiteItems={setSiteItems} />

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
  );
}
function StepSend({ result, paymentTerms, termsPreset, setTermsPreset, customTerms, setCustomTerms, customTermsTotal,
  clientName, clientEmail, siteAddress,
  saving, saveMessage, savedQuoteId, onSave,
  extraLines, setExtraLines, rate, margin, effectiveMargin, siteItems, setSiteItems, siteTotal, annotationMeta,
  displayLabourDollar, displayMaterialsDollar, manualLabourHrs,
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
  rate: number; margin: number; effectiveMargin: number;
  siteItems: {id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[];
  setSiteItems: React.Dispatch<React.SetStateAction<{id:string;label:string;qty:number;unit:string;note:string;materialsCost:number;labourHrs:number}[]>>;
  siteTotal: number;
  annotationMeta: {id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string}[];
  displayLabourDollar: number; displayMaterialsDollar: number; manualLabourHrs: number;
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
          <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Labour</span><span className="text-white font-semibold tabular">${displayLabourDollar.toLocaleString()}</span></div>
          <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Materials</span><span className="text-white font-semibold tabular">${displayMaterialsDollar.toLocaleString()}</span></div>
          {siteTotal > 0 && <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">On-site items</span><span className="text-white font-semibold tabular">${siteTotal.toLocaleString()}</span></div>}
          <div className="border-t border-white/10 pt-2 flex justify-between">
            <span className="text-white font-bold text-[15px]">Total</span>
            <span className="font-display text-[24px] text-[var(--amber)] leading-tight tabular">${(result.totalCost + extraLinesTotals(extraLines, rate, effectiveMargin).total + siteTotal + Math.round(manualLabourHrs * rate)).toLocaleString()}</span>
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
                <span className="font-bold text-[var(--ink)] tabular">{t.percent}% - ${Math.round(((result.totalCost + extraLinesTotals(extraLines, rate, effectiveMargin).total + (siteTotal ?? 0) + Math.round(manualLabourHrs * rate)) * t.percent) / 100).toLocaleString()}</span>
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
        {!clientEmail && !saving && (
          <p className="text-[12.5px] font-semibold text-[var(--amber-deep)] text-center -mt-2">Add a client email (Customer &amp; site step) to send - or save as a draft for now</p>
        )}
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
function Num({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" inputMode="numeric" min={0} step={step ?? 1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="app-field" />;
}
function Check2({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-3 py-2.5 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="text-[14.5px] text-[var(--ink)]">{label}</span></label>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--line-subtle)]">{children}</div>;
}
