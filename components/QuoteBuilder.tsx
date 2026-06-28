"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { AlertTriangle, Paperclip, X, Sparkles, ChevronRight, ChevronLeft, Check, Upload } from "lucide-react";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import StepCustomer from "./StepCustomer";
import ExtraJobLines, { extraLinesTotals } from "./ExtraJobLines";
import { resolveClientId } from "@/lib/resolveClientId";
import MaterialsEditor from "@/components/MaterialsEditor";
import {
  calcElectricianQuote,
  ELECTRICIAN_DEFAULT_MATERIALS,
  type ElectricianIntake,
  type MaterialCostMap,
} from "@/lib/calc";

type MaterialRow = { item_key: string; label: string; unit_cost: number };

const DEFAULT_INTAKE: ElectricianIntake = {
  jobType: "reno", ceilingType: "unknown",
  switchboardUpgrade: false, switchboardRcbo: false, threePhase: false,
  powerPoints: 0, lightPoints: 0, switches: 0,
  downlights: 0, downlightGrade: "builder", exhaustFans: 0,
  cableMetres: 0, roofAccess: 1, subfloorAccess: 1, trenchMetres: 0,
  applianceOven: false, applianceCooktop: false, applianceHwc: false,
  applianceAircon: false, appliancePool: false,
  evCharger: false, solarConnection: false, externalCircuits: 0,
  dataPoints: 0, nbn: false,
  siteAccess: "easy", multistorey: false,
  smokeAlarms: 0, coes: false, callout: false, ccew: false, notes: "",
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
  profile, materials, preClientId, preMarkupMaterials = 0,
}: {
  profile: { hourly_rate: number; materials_margin_pct: number; default_deposit_pct?: number | null; default_expiry_days?: number };
  materials: MaterialRow[];
  preClientId?: string;
  preMarkupMaterials?: number;
}) {
  const [step, setStep]     = useState(0);
  const [intake, setIntake] = useState<ElectricianIntake>(DEFAULT_INTAKE);
  const [rate, setRate]     = useState(profile.hourly_rate ?? 95);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  const [lib, setLib]       = useState<MaterialRow[]>(
    materials.length > 0 ? materials : ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );

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
  const [saving, setSaving]         = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  const [drawingFiles, setDrawingFiles]         = useState<File[]>([]);
  const [drawingInstructions, setDrawingInstructions] = useState("");
  const [analyzing, setAnalyzing]       = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ confidence: string; notes: string } | null>(null);
  const [analysisError, setAnalysisError]   = useState<string | null>(null);
  const [usageLimitReached, setUsageLimitReached] = useState(false);

  const costs: MaterialCostMap = useMemo(() => {
    const m: MaterialCostMap = {};
    lib.forEach((r) => (m[r.item_key] = Number(r.unit_cost) || 0));
    return m;
  }, [lib]);

  const result = useMemo(() => calcElectricianQuote(intake, costs, rate, margin), [intake, costs, rate, margin]);

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
      if (drawingInstructions.trim()) fd.append("instructions", drawingInstructions.trim());
      const res  = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: fd });
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
        exhaustFans:       r.exhaust_fans       ?? prev.exhaustFans,
        cableMetres:       r.cable_metres       ?? prev.cableMetres,
        switchboardUpgrade: r.switchboard_upgrade ?? prev.switchboardUpgrade,
        threePhase:        r.three_phase        ?? prev.threePhase,
        dataPoints:        r.data_points        ?? prev.dataPoints,
        smokeAlarms:       r.smoke_alarms       ?? prev.smokeAlarms,
        externalCircuits:  r.external_circuits  ?? prev.externalCircuits,
        ceilingType:       r.ceiling_type       ?? prev.ceilingType,
        multistorey:       r.multistorey        ?? prev.multistorey,
      }));
      setAnalysisResult({ confidence: r.confidence ?? "medium", notes: r.notes ?? "" });
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

    // Keep the client list growing automatically rather than requiring an
    // explicit "add customer" step - resolves to a real client_id either
    // way, which is what lets saved plans/drawings for that client surface
    // on this job later.
    const resolvedClientId = await resolveClientId(supabase, userData.user.id, clientId, clientName, clientEmail, siteAddress);

    for (const m of lib) {
      await supabase.from("material_items").upsert(
        { profile_id: userData.user.id, trade: "electrician", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost },
        { onConflict: "profile_id,item_key" }
      );
    }

    const { data: quote, error } = await supabase.from("quotes").insert({
      profile_id: userData.user.id, client_id: resolvedClientId, client_name: clientName, client_email: clientEmail,
      site_address: siteAddress, trade: "electrician", job_type: intake.jobType,
      intake_data: intake, labour_hours: result.labourHours + extraLines.reduce((s,l) => s + l.hours, 0), materials_cost: result.materialsCost + extraLinesTotals(extraLines, rate, margin).materials,
      total_cost: result.totalCost + extraLinesTotals(extraLines, rate, margin).total, payment_terms: paymentTerms,
      quote_expires_at: new Date(Date.now() + (profile.default_expiry_days ?? 30) * 86400000).toISOString(),
      status: sendEmail ? "sent" : "draft",
      sent_at: sendEmail ? new Date().toISOString() : null,
      markup_materials: preMarkupMaterials,
    }).select().single();

    if (error) { setSaveMessage(error.message); setSaving(false); return; }
    setSavedQuoteId(quote.id);

    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${userData.user.id}/${quote.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("job-files").upload(path, file);
      if (!uploadError) {
        await supabase.from("job_attachments").insert({
          quote_id: quote.id, profile_id: userData.user.id, file_name: file.name,
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

      {/* ── Live total ─────────────────────────────── */}
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
              <p className="font-display text-[18px] text-white leading-tight">${result.materialsCost.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p>
            <p className="font-display text-[24px] text-[var(--amber)] leading-tight">${result.totalCost.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Step progress ──────────────────────────── */}
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
              {done && <Check size={11} />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Step content ───────────────────────────── */}
      {stepId === "drawing" && (
        <StepDrawing
          drawingFiles={drawingFiles}
          drawingInstructions={drawingInstructions}
          setDrawingInstructions={setDrawingInstructions}
          analyzing={analyzing}
          analysisResult={analysisResult}
          analysisError={analysisError}
          usageLimitReached={usageLimitReached}
          onUpload={handleDrawingUpload}
          onRemove={(name) => { setDrawingFiles((p) => p.filter((f) => f.name !== name)); setAnalysisResult(null); }}
          onAnalyse={runAiAnalysis}
          onVoiceTranscript={runAiAnalysisFromVoice}
        />
      )}

      {stepId === "job" && (
        <StepJob intake={intake} rate={rate} margin={margin} set={set} setRate={setRate} setMargin={setMargin} />
      )}

      {stepId === "electrical" && (
        <StepElectrical intake={intake} set={set} lib={lib} setLib={setLib} />
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
        />
      )}

      {/* ── Navigation buttons ─────────────────────── */}
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

/* ─── Step: Drawing ─────────────────────────────────────────────── */
function StepDrawing({ drawingFiles, drawingInstructions, setDrawingInstructions, analyzing, analysisResult, analysisError, usageLimitReached, onUpload, onRemove, onAnalyse, onVoiceTranscript }: {
  drawingFiles: File[]; drawingInstructions: string; setDrawingInstructions: (v: string) => void;
  analyzing: boolean; analysisResult: { confidence: string; notes: string } | null;
  analysisError: string | null; usageLimitReached: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (name: string) => void; onAnalyse: () => void;
  onVoiceTranscript: (transcript: string) => void;
}) {
  return (
    <div className="space-y-4">
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
              <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">Optional - AI reads the first drawing and estimates quantities. You review everything before saving.</p>
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
                {usageLimitReached && <a href="/settings" className="text-[12.5px] font-semibold text-[var(--red)] underline">Upgrade in Settings →</a>}
              </div>
            </div>
          )}

          {analysisResult && (
            <div className={`mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2 ${analysisResult.confidence === "low" ? "bg-[var(--red-bg)]" : "bg-amber-50"}`}>
              <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${analysisResult.confidence === "low" ? "text-[var(--red)]" : "text-amber-600"}`} />
              <div>
                <p className={`text-[13px] font-semibold ${analysisResult.confidence === "low" ? "text-[var(--red)]" : "text-amber-800"}`}>
                  Fields pre-filled ({analysisResult.confidence} confidence) - review before saving
                </p>
                {analysisResult.notes && <p className={`text-[12.5px] mt-1 ${analysisResult.confidence === "low" ? "text-red-500" : "text-amber-700"}`}>{analysisResult.notes}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Step: Job ─────────────────────────────────────────────────── */
function StepJob({ intake, rate, margin, set, setRate, setMargin }: {
  intake: ElectricianIntake; rate: number; margin: number;
  set: <K extends keyof ElectricianIntake>(k: K, v: ElectricianIntake[K]) => void;
  setRate: (v: number) => void; setMargin: (v: number) => void;
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
          <Check2 checked={intake.coes}     onChange={(v) => set("coes", v)}     label="COES required" />
        </Row>
      </div>

      <div className="card">
        <p className="section-tag mb-3">Your rates</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hourly rate ($)">
            <input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="app-field" />
          </Field>
          <Field label="Materials margin (%)">
            <input type="number" inputMode="decimal" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="app-field" />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ─── Step: Electrical ──────────────────────────────────────────── */
function StepElectrical({ intake, set, lib, setLib }: {
  intake: ElectricianIntake;
  set: <K extends keyof ElectricianIntake>(k: K, v: ElectricianIntake[K]) => void;
  lib: MaterialRow[];
  setLib: React.Dispatch<React.SetStateAction<MaterialRow[]>>;
}) {
  const [showLib, setShowLib] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  function downloadCsvTemplate() {
    const rows = ["item_key,label,unit_cost", ...lib.map((m) => `${m.item_key},"${m.label}",${m.unit_cost}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swiftscope-price-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const header = lines[0]?.toLowerCase().split(",") ?? [];
      const keyIdx = header.findIndex((h) => h.includes("key") || h.includes("item"));
      const costIdx = header.findIndex((h) => h.includes("cost") || h.includes("price"));
      if (keyIdx === -1 || costIdx === -1) {
        setCsvMessage("Couldn't find item and cost columns in that file - try the template instead.");
        return;
      }
      let matched = 0;
      const updates = new Map<string, number>();
      for (const line of lines.slice(1)) {
        const cols = line.split(",");
        const key = cols[keyIdx]?.trim().replace(/^"|"$/g, "");
        const cost = parseFloat(cols[costIdx]?.replace(/[^0-9.]/g, "") ?? "");
        if (key && !isNaN(cost)) updates.set(key, cost);
      }
      setLib((prev) =>
        prev.map((m) => {
          if (updates.has(m.item_key)) {
            matched++;
            return { ...m, unit_cost: updates.get(m.item_key)! };
          }
          return m;
        })
      );
      setCsvMessage(matched > 0 ? `Updated ${matched} price${matched === 1 ? "" : "s"}.` : "No matching items found in that file.");
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      {/* Switchboard */}
      <div className="card">
        <p className="section-tag mb-3">Switchboard</p>
        <Row>
          <Check2 checked={intake.switchboardUpgrade} onChange={(v) => set("switchboardUpgrade", v)} label="Upgrade needed" />
          <Check2 checked={intake.switchboardRcbo}    onChange={(v) => set("switchboardRcbo", v)}    label="Full RCBO (not RCD)" />
          <Check2 checked={intake.threePhase}         onChange={(v) => set("threePhase", v)}         label="3-phase supply" />
        </Row>
      </div>

      {/* Points */}
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
        <div className="mt-3">
          <Check2 checked={intake.nbn} onChange={(v) => set("nbn", v)} label="NBN connection point" />
        </div>
      </div>

      {/* Lighting */}
      <div className="card">
        <p className="section-tag mb-3">Lighting</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Downlights"><Num value={intake.downlights} onChange={(v) => set("downlights", v)} /></Field>
          <Field label="Grade">
            <select value={intake.downlightGrade} onChange={(e) => set("downlightGrade", e.target.value as ElectricianIntake["downlightGrade"])} className="app-field">
              <option value="builder">Builder</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium / smart</option>
            </select>
          </Field>
        </div>
        <Field label="Exhaust fans"><Num value={intake.exhaustFans} onChange={(v) => set("exhaustFans", v)} /></Field>
      </div>

      {/* Appliances */}
      <div className="card">
        <p className="section-tag mb-3">Fixed appliances</p>
        <div className="grid grid-cols-2 gap-x-4">
          <Check2 checked={intake.applianceOven}     onChange={(v) => set("applianceOven", v)}     label="Oven" />
          <Check2 checked={intake.applianceCooktop}  onChange={(v) => set("applianceCooktop", v)}  label="Cooktop" />
          <Check2 checked={intake.applianceHwc}      onChange={(v) => set("applianceHwc", v)}      label="Hot water" />
          <Check2 checked={intake.applianceAircon}   onChange={(v) => set("applianceAircon", v)}   label="Aircon" />
          <Check2 checked={intake.appliancePool}     onChange={(v) => set("appliancePool", v)}     label="Pool / spa" />
          <Check2 checked={intake.evCharger}         onChange={(v) => set("evCharger", v)}         label="EV charger" />
          <Check2 checked={intake.solarConnection}   onChange={(v) => set("solarConnection", v)}   label="Solar / battery" />
        </div>
      </div>

      {/* Cabling */}
      <div className="card">
        <p className="section-tag mb-3">Cabling</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cable metres">
            <Num value={intake.cableMetres} onChange={(v) => set("cableMetres", v)} />
          </Field>
          <Field label="Trenching (m)">
            <Num value={intake.trenchMetres} onChange={(v) => set("trenchMetres", v)} />
          </Field>
        </div>
      </div>

      {/* Material prices toggle */}
      <button onClick={() => setShowLib(!showLib)} className="btn-secondary w-full justify-between">
        <span>Material unit prices</span>
        <ChevronRight size={15} className={`transition-transform ${showLib ? "rotate-90" : ""}`} />
      </button>
      {showLib && (
        <>
          <div className="card">
            <p className="section-tag mb-1">Sync from your supplier</p>
            <p className="text-[12px] text-[var(--ink-faint)] mb-3">
              Most suppliers (Middys, Rexel, Tradelink) let you export your trade pricing from their account
              portal. Download that as a CSV and upload it here, and every quote will use those real prices.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary text-[12.5px] py-2 px-3 cursor-pointer">
                <Upload size={13} /> Upload supplier price CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              </label>
              <button onClick={downloadCsvTemplate} className="text-[12.5px] font-semibold text-[var(--navy)] underline px-2">
                Download a template
              </button>
            </div>
            {csvMessage && <p className="text-[12.5px] text-[var(--ink-soft)] mt-3">{csvMessage}</p>}
          </div>
          <MaterialsEditor lib={lib} setLib={setLib} />
        </>
      )}
    </div>
  );
}

/* ─── Step: Site ────────────────────────────────────────────────── */
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
        <Field label="Smoke alarms to interconnect" className="mb-3">
          <Num value={intake.smokeAlarms} onChange={(v) => set("smokeAlarms", v)} />
        </Field>
        <Row>
          <Check2 checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey" />
        </Row>
      </div>
    </div>
  );
}

/* ─── Step: Send ────────────────────────────────────────────────── */

function StepSend({ result, paymentTerms, termsPreset, setTermsPreset, customTerms, setCustomTerms, customTermsTotal,
  clientName, clientEmail, siteAddress,
  saving, saveMessage, savedQuoteId, onSave }: {
  intake: ElectricianIntake;
  result: { labourHours: number; materialsCost: number; totalCost: number };
  paymentTerms: PaymentTerm[];
  termsPreset: string; setTermsPreset: (v: string) => void;
  customTerms: PaymentTerm[]; setCustomTerms: React.Dispatch<React.SetStateAction<PaymentTerm[]>>;
  customTermsTotal: number;
  clientName: string; clientEmail: string; siteAddress: string;
  saving: boolean; saveMessage: string | null; savedQuoteId: string | null;
  onSave: (send: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Quote summary */}
      <div className="bg-[var(--navy)] rounded-2xl p-5">
        <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
        <div className="space-y-2">
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--steel-2)]">Labour ({result.labourHours}h)</span>
            <span className="text-white font-semibold tabular">${Math.round(result.labourHours * 95).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--steel-2)]">Materials</span>
            <span className="text-white font-semibold tabular">${result.materialsCost.toLocaleString()}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between">
            <span className="text-white font-bold text-[15px]">Total</span>
            <span className="font-display text-[24px] text-[var(--amber)] leading-tight tabular">${result.totalCost.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Who it's going to - confirmation only, edited back in the Customer step */}
      <div className="card">
        <p className="section-tag mb-1">Sending to</p>
        <p className="font-semibold text-[var(--ink)]">{clientName || "No client name set"}</p>
        <p className="text-[13px] text-[var(--ink-faint)]">{clientEmail || "No email set - can still save as draft"}</p>
        <p className="text-[13px] text-[var(--ink-faint)]">{siteAddress || "No site address set"}</p>
      </div>

      {/* Extra job lines */}
      <ExtraJobLines
        lines={extraLines}
        onChange={setExtraLines}
        hourlyRate={rate}
        marginPct={margin}
      />

      {/* Payment terms */}
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
                <span className="font-bold text-[var(--ink)] tabular">
                  {t.percent}% - ${Math.round((result.totalCost * t.percent) / 100).toLocaleString()}
                </span>
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

      {/* Save / send */}
      <div className="space-y-3">
        <button onClick={() => onSave(true)} disabled={saving || !clientEmail} className="btn-primary">
          {saving ? "Sending..." : "Send quote to client"}
        </button>
        <button onClick={() => onSave(false)} disabled={saving} className="btn-secondary w-full justify-center">
          Save as draft
        </button>
        {saveMessage && (
          <div className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold text-center ${saveMessage.includes("fail") || saveMessage.includes("error") ? "bg-[var(--red-bg)] text-[var(--red)]" : "bg-[var(--green-bg)] text-[var(--green)]"}`}>
            {saveMessage}
          </div>
        )}
        {savedQuoteId && (
          <a
            href={`/api/quotes/${savedQuoteId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full justify-center block text-center"
          >
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Shared field components ───────────────────────────────────── */
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input type="number" inputMode="numeric" min={0} value={value}
      onChange={(e) => onChange(Number(e.target.value))} className="app-field" />
  );
}

function Check2({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 py-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[14.5px] text-[var(--ink)]">{label}</span>
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--line-subtle)]">{children}</div>;
}
// build Sun Jun 28 04:25:11 UTC 2026
