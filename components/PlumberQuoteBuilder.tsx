"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { AlertTriangle, Paperclip, X, Sparkles, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { normalizeForAnalysis } from "@/lib/imageNormalize";
import VoiceNoteRecorder from "./VoiceNoteRecorder";
import { calcPlumberQuote, PLUMBER_DEFAULT_MATERIALS, type PlumberIntake } from "@/lib/calcPlumber";
import MaterialsEditor from "@/components/MaterialsEditor";
import StepCustomer from "./StepCustomer";
import ExtraJobLines, { type ExtraLine, extraLinesTotals } from "./ExtraJobLines";
import { resolveClientId } from "@/lib/resolveClientId";

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
  { id: "fixtures",  label: "Fixtures"  },
  { id: "pipework",  label: "Pipework"  },
  { id: "materials", label: "Materials" },
  { id: "send",      label: "Send"      },
];

export default function PlumberQuoteBuilder({ profile, materials, preClientId, preMarkupMaterials, }: {
  profile: { hourly_rate: number; materials_margin_pct: number };
  materials: MaterialRow[];
  preClientId?: string;
  preMarkupMaterials?: Array<{ label: string; quantity: number; unit: string; unitCost: number; totalCost: number }>;
}) {
  const [step,   setStep]   = useState(0);
  const [intake, setIntake] = useState<PlumberIntake>(DEFAULT_INTAKE);
  const [rate,   setRate]   = useState(profile.hourly_rate ?? 95);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  const [lib, setLib] = useState<MaterialRow[]>(
    materials.length > 0 ? materials : PLUMBER_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );

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

  const [extraLines, setExtraLines]   = useState<ExtraLine[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ confidence: string; notes: string } | null>(null);
  const [analysisError,  setAnalysisError]  = useState<string | null>(null);
  const [usageLimitReached, setUsageLimitReached] = useState(false);

  const costs = useMemo(() => { const m: Record<string,number> = {}; lib.forEach((r) => (m[r.item_key] = Number(r.unit_cost)||0)); return m; }, [lib]);
  const result = useMemo(() => calcPlumberQuote(intake, costs, rate, margin), [intake, costs, rate, margin]);

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
      fd.append("instructions", "This is a plumbing job. Focus on wet areas, fixture counts, pipe runs.");
      const res  = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) { setAnalysisError(body.error ?? "Analysis failed"); if (body.usageLimitReached) setUsageLimitReached(true); return; }
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
        body: JSON.stringify({ transcript, instructions: "This is a plumbing job. Focus on wet areas, fixture counts, pipe runs." }),
      });
      const body = await res.json();
      if (!res.ok) { setAnalysisError(body.error ?? "Analysis failed"); if (body.usageLimitReached) setUsageLimitReached(true); return; }
      setAnalysisResult({ confidence: body.result?.confidence ?? "low", notes: body.result?.notes ?? "" });
    } catch (err) { setAnalysisError(err instanceof Error ? err.message : "Could not reach analysis service."); }
    finally { setAnalyzing(false); }
  }

  async function saveAndSend(sendEmail: boolean) {
    setSaving(true); setSaveMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveMessage("Not logged in"); setSaving(false); return; }
    const resolvedClientId = await resolveClientId(supabase, user.id, clientId, clientName, clientEmail, siteAddress);
    for (const m of lib) await supabase.from("material_items").upsert({ profile_id: user.id, trade: "plumber", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost }, { onConflict: "profile_id,item_key" });
    const { data: quote, error } = await supabase.from("quotes").insert({ profile_id: user.id, client_id: resolvedClientId, client_name: clientName, client_email: clientEmail, site_address: siteAddress, trade: "plumber", job_type: intake.jobType, intake_data: intake, labour_hours: result.labourHours + extraLines.reduce((s,l) => s + l.hours, 0), materials_cost: result.materialsCost + extraLinesTotals(extraLines, rate, margin).materials, total_cost: result.totalCost + extraLinesTotals(extraLines, rate, margin).total, payment_terms: paymentTerms, status: sendEmail ? "sent" : "draft", sent_at: sendEmail ? new Date().toISOString() : null, markup_materials: preMarkupMaterials ?? [] }).select().single();
    if (error) { setSaveMessage(error.message); setSaving(false); return; }
    setSavedQuoteId(quote.id);
    setSavedQuoteId(quote.id);
    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
      const path = `${user.id}/${quote.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("job-files").upload(path, file);
      if (!upErr) await supabase.from("job_attachments").insert({ quote_id: quote.id, profile_id: user.id, file_name: file.name, storage_path: path, file_type: file.type, file_size: file.size });
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
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Labour</p><p className="font-display text-[18px] text-white leading-tight">{result.labourHours}h</p></div>
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Materials</p><p className="font-display text-[18px] text-white leading-tight">${result.materialsCost.toLocaleString()}</p></div>
          </div>
          <div className="text-right"><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p><p className="font-display text-[24px] text-[var(--amber)] leading-tight">${result.totalCost.toLocaleString()}</p></div>
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
              {analysisResult && <div className={`mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2 ${analysisResult.confidence === "low" ? "bg-[var(--red-bg)]" : "bg-amber-50"}`}><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-[13px] font-semibold text-amber-800">Fields noted ({analysisResult.confidence} confidence) - review before saving</p>{analysisResult.notes && <p className="text-[12.5px] mt-1 text-amber-700">{analysisResult.notes}</p>}</div></div>}
            </div>
          )}
        </div>
      )}

      {stepId === "job" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Job details</p>
            <Field label="Job type" className="mb-3"><select value={intake.jobType} onChange={(e) => set("jobType", e.target.value as PlumberIntake["jobType"])} className="app-field"><option value="reno">Renovation / alteration</option><option value="newbuild">New build</option><option value="fault">Fault / leak repair</option><option value="gasfitting">Gas fitting</option><option value="drainage">Drainage / sewer</option><option value="compliance">Compliance check</option></select></Field>
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

      {stepId === "fixtures" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Tapware and fixtures</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Basin taps"><Num value={intake.basinTaps}     onChange={(v) => set("basinTaps", v)} /></Field>
              <Field label="Kitchen taps"><Num value={intake.kitchenTaps}  onChange={(v) => set("kitchenTaps", v)} /></Field>
              <Field label="Shower mixers"><Num value={intake.showerMixers} onChange={(v) => set("showerMixers", v)} /></Field>
              <Field label="Bath mixers"><Num value={intake.bathMixers}   onChange={(v) => set("bathMixers", v)} /></Field>
              <Field label="Toilets"><Num value={intake.toilets}       onChange={(v) => set("toilets", v)} /></Field>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">New rough-ins</p>
            <div className="divide-y divide-[var(--line-subtle)]">
              <Chk checked={intake.newBathroomRoughin} onChange={(v) => set("newBathroomRoughin", v)} label="New bathroom rough-in" />
              <Chk checked={intake.newKitchenRoughin}  onChange={(v) => set("newKitchenRoughin", v)}  label="New kitchen rough-in" />
              <Chk checked={intake.newLaundryRoughin}  onChange={(v) => set("newLaundryRoughin", v)}  label="New laundry rough-in" />
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Gas</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Gas points"><Num value={intake.gasPoints} onChange={(v) => set("gasPoints", v)} /></Field>
            </div>
            <Chk checked={intake.gasCertRequired} onChange={(v) => set("gasCertRequired", v)} label="Gas compliance cert required" />
          </div>
          <div className="card">
            <p className="section-tag mb-3">Drainage</p>
            <div className="divide-y divide-[var(--line-subtle)]">
              <Chk checked={intake.blockageClear} onChange={(v) => set("blockageClear", v)} label="Blockage / drain clear" />
              <Chk checked={intake.cctv}          onChange={(v) => set("cctv", v)}          label="CCTV drain inspection" />
            </div>
          </div>
        </div>
      )}

      {stepId === "pipework" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Pipework</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Copper pipe (m)"><Num value={intake.copperMetres}   onChange={(v) => set("copperMetres", v)} /></Field>
              <Field label="PEX pipe (m)"><Num value={intake.pexMetres}       onChange={(v) => set("pexMetres", v)} /></Field>
              <Field label="Drainage pipe (m)"><Num value={intake.drainageMetres} onChange={(v) => set("drainageMetres", v)} /></Field>
              <Field label="Slab penetrations"><Num value={intake.slabPenetrations} onChange={(v) => set("slabPenetrations", v)} /></Field>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Site access</p>
            <div className="space-y-3">
              <Field label="Subfloor access"><select value={intake.subfloorAccess} onChange={(e) => set("subfloorAccess", e.target.value as PlumberIntake["subfloorAccess"])} className="app-field"><option value="none">No subfloor work</option><option value="easy">Easy crawl</option><option value="tight">Tight crawl</option><option value="wet">Wet / very low</option></select></Field>
              <Field label="Overall site access"><select value={intake.siteAccess} onChange={(e) => set("siteAccess", e.target.value as PlumberIntake["siteAccess"])} className="app-field"><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option></select></Field>
            </div>
            <div className="mt-3">
              <Chk checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey" />
            </div>
          </div>
        </div>
      )}

      {stepId === "materials" && <MaterialsEditor lib={lib} setLib={setLib} />}

      {stepId === "send" && (
        <div className="space-y-4">
          <div className="bg-[var(--navy)] rounded-2xl p-5">
            <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Labour ({result.labourHours}h)</span><span className="text-white font-semibold tabular">${Math.round(result.labourHours * rate).toLocaleString()}</span></div>
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Materials</span><span className="text-white font-semibold tabular">${result.materialsCost.toLocaleString()}</span></div>
              <div className="border-t border-white/10 pt-2 flex justify-between"><span className="text-white font-bold text-[15px]">Total</span><span className="font-display text-[24px] text-[var(--amber)] tabular">${result.totalCost.toLocaleString()}</span></div>
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
            marginPct={margin}
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
                {paymentTerms.map((t, i) => <div key={i} className="flex justify-between text-[13.5px]"><span className="text-[var(--ink-soft)]">{t.label}</span><span className="font-bold tabular">{t.percent}% - ${Math.round(result.totalCost * t.percent / 100).toLocaleString()}</span></div>)}
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
            {saveMessage && <div className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold text-center ${saveMessage.includes("fail") ? "bg-[var(--red-bg)] text-[var(--red)]" : "bg-[var(--green-bg)] text-[var(--green)]"}`}>{saveMessage}</div>}
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
