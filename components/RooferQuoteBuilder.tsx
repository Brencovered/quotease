"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { Paperclip, X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { calcRooferQuote, ROOFER_DEFAULT_MATERIALS, type RooferIntake } from "@/lib/calcRoofer";

type MaterialRow = { item_key: string; label: string; unit_cost: number };

const DEFAULT_INTAKE: RooferIntake = {
  jobType: "repair", roofType: "colorbond", roofSqm: 0, roofPitch: "standard",
  ridgeLm: 0, valleyLm: 0, fasciaLm: 0, gutterLm: 0, downpipeLm: 0,
  whirlybirds: 0, skylights: 0, insulationSqm: 0, flashingLm: 0,
  scaffoldDays: 0, twoStorey: false, siteAccess: "easy", callout: false, notes: "",
};

const STEPS = [
  { id: "drawing", label: "Drawing" },
  { id: "job",     label: "Job"     },
  { id: "roof",    label: "Roof"    },
  { id: "extras",  label: "Extras"  },
  { id: "send",    label: "Send"    },
];

export default function RooferQuoteBuilder({ profile, materials }: {
  profile: { hourly_rate: number; materials_margin_pct: number };
  materials: MaterialRow[];
}) {
  const [step, setStep]     = useState(0);
  const [intake, setIntake] = useState<RooferIntake>(DEFAULT_INTAKE);
  const [rate, setRate]     = useState(profile.hourly_rate ?? 90);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  const [lib, setLib]       = useState<MaterialRow[]>(
    materials.length > 0 ? materials : ROOFER_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );
  const [clientName, setClientName]   = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [termsPreset, setTermsPreset] = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">("deposit_30_70");
  const [customTerms, setCustomTerms] = useState<PaymentTerm[]>([
    { label: "Deposit", percent: 30, trigger: "acceptance", days: 0 },
    { label: "Final",   percent: 70, trigger: "completion",  days: 7 },
  ]);
  const paymentTerms = termsPreset === "custom" ? customTerms : PAYMENT_TERM_PRESETS[termsPreset];
  const [saving, setSaving]         = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);

  const costs  = useMemo(() => { const m: Record<string,number> = {}; lib.forEach((r) => (m[r.item_key] = Number(r.unit_cost)||0)); return m; }, [lib]);
  const result = useMemo(() => calcRooferQuote(intake, costs, rate, margin), [intake, costs, rate, margin]);

  function set<K extends keyof RooferIntake>(k: K, v: RooferIntake[K]) { setIntake((p) => ({...p,[k]:v})); }

  async function saveAndSend(sendEmail: boolean) {
    setSaving(true); setSaveMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveMessage("Not logged in"); setSaving(false); return; }
    for (const m of lib) await supabase.from("material_items").upsert({ profile_id: user.id, trade: "roofer", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost }, { onConflict: "profile_id,item_key" });
    const { data: quote, error } = await supabase.from("quotes").insert({ profile_id: user.id, client_name: clientName, client_email: clientEmail, site_address: siteAddress, trade: "roofer", job_type: intake.jobType, intake_data: intake, labour_hours: result.labourHours, materials_cost: result.materialsCost, total_cost: result.totalCost, payment_terms: paymentTerms, status: sendEmail ? "sent" : "draft" }).select().single();
    if (error) { setSaveMessage(error.message); setSaving(false); return; }
    for (const file of drawingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
      const path = `${user.id}/${quote.id}/${Date.now()}-${safeName}`;
      await supabase.storage.from("job-files").upload(path, file);
    }
    if (sendEmail) {
      const res = await fetch("/api/quotes/send", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ quoteId: quote.id }) });
      if (!res.ok) { const b = await res.json().catch(()=>({})); setSaveMessage(`Saved — sending failed: ${b.error ?? res.statusText}`); setSaving(false); return; }
      setSaveMessage(`Sent to ${clientEmail}`);
    } else { setSaveMessage("Saved as draft"); }
    setSaving(false);
  }

  const stepId = STEPS[step].id;

  return (
    <div className="page-wrap-narrow">
      <div className="sticky top-12 sm:top-14 z-30 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="bg-[var(--navy)] rounded-none sm:rounded-2xl px-5 py-3 flex items-center justify-between" style={{boxShadow:"0 4px 20px rgba(10,23,34,.18)"}}>
          <div className="flex gap-5">
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Labour</p><p className="font-display text-[18px] text-white leading-tight">{result.labourHours}h</p></div>
            <div><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Materials</p><p className="font-display text-[18px] text-white leading-tight">${result.materialsCost.toLocaleString()}</p></div>
          </div>
          <div className="text-right"><p className="text-[10px] text-[var(--steel-3)] font-bold uppercase tracking-wide">Total</p><p className="font-display text-[24px] text-[var(--amber)] leading-tight">${result.totalCost.toLocaleString()}</p></div>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-5 overflow-x-auto hide-scrollbar pb-1">
        {STEPS.map((s,i) => <button key={s.id} onClick={() => setStep(i)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap ${i===step ? "bg-[var(--navy)] text-white" : i<step ? "bg-[var(--amber-light)] text-[var(--amber-deep)]" : "bg-[var(--surface)] text-[var(--ink-faint)] border border-[var(--line)]"}`}>{i<step && <Check size={11}/>}{s.label}</button>)}
      </div>

      {stepId === "drawing" && (
        <div className="card">
          <p className="section-tag mb-1">Step 1</p>
          <p className="font-semibold text-[17px] mb-4">Upload photos or roof plans</p>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-8 cursor-pointer hover:border-[var(--amber)] bg-[var(--app-bg)]">
            <Paperclip size={18} className="text-[var(--ink-faint)]"/><span className="text-[14px] font-semibold text-[var(--ink-soft)]">Add site photos or plans</span>
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files??[]); setDrawingFiles((p) => [...p,...f.filter((x) => !p.some((y) => y.name===x.name))]); e.target.value=""; }}/>
          </label>
          {drawingFiles.map((f) => <div key={f.name} className="flex items-center gap-3 bg-[var(--app-bg)] rounded-lg px-3 py-2.5 mt-2"><Paperclip size={14} className="text-[var(--ink-faint)] shrink-0"/><span className="text-[13.5px] flex-1 truncate">{f.name}</span><button onClick={() => setDrawingFiles((p) => p.filter((x) => x.name!==f.name))}><X size={14} className="text-[var(--ink-faint)]"/></button></div>)}
        </div>
      )}

      {stepId === "job" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Job details</p>
            <Field label="Job type" className="mb-3"><select value={intake.jobType} onChange={(e) => set("jobType", e.target.value as RooferIntake["jobType"])} className="app-field"><option value="reroof">Full re-roof</option><option value="repair">Repair / patch</option><option value="new">New roof (new build)</option><option value="gutters">Gutters and downpipes only</option><option value="inspection">Roof inspection</option></select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hourly rate ($)"><input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="app-field"/></Field>
              <Field label="Materials margin (%)"><input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="app-field"/></Field>
            </div>
            <div className="mt-3 divide-y divide-[var(--line-subtle)]">
              <Chk checked={intake.callout} onChange={(v) => set("callout", v)} label="Include call-out / inspection fee"/>
              <Chk checked={intake.twoStorey} onChange={(v) => set("twoStorey", v)} label="Two-storey / elevated"/>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Site access</p>
            <Field label="Overall site access"><select value={intake.siteAccess} onChange={(e) => set("siteAccess", e.target.value as RooferIntake["siteAccess"])} className="app-field"><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option></select></Field>
          </div>
        </div>
      )}

      {stepId === "roof" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Roof area and type</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Roof area (sqm)"><Num value={intake.roofSqm} onChange={(v) => set("roofSqm", v)}/></Field>
              <Field label="Roof pitch"><select value={intake.roofPitch} onChange={(e) => set("roofPitch", e.target.value as RooferIntake["roofPitch"])} className="app-field"><option value="low">Low pitch (&lt;15°)</option><option value="standard">Standard (15–30°)</option><option value="steep">Steep (&gt;30°)</option></select></Field>
            </div>
            <Field label="Roof type"><select value={intake.roofType} onChange={(e) => set("roofType", e.target.value as RooferIntake["roofType"])} className="app-field"><option value="colorbond">Colorbond / metal</option><option value="terracotta">Terracotta tile</option><option value="concrete_tile">Concrete tile</option><option value="mixed">Mixed (assess on site)</option></select></Field>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Linear items</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ridge capping (m)"><Num value={intake.ridgeLm}   onChange={(v) => set("ridgeLm", v)}/></Field>
              <Field label="Valley iron (m)"><Num value={intake.valleyLm}  onChange={(v) => set("valleyLm", v)}/></Field>
              <Field label="Fascia (m)"><Num value={intake.fasciaLm}  onChange={(v) => set("fasciaLm", v)}/></Field>
              <Field label="Gutter (m)"><Num value={intake.gutterLm}  onChange={(v) => set("gutterLm", v)}/></Field>
              <Field label="Downpipe (m)"><Num value={intake.downpipeLm} onChange={(v) => set("downpipeLm", v)}/></Field>
            </div>
          </div>
        </div>
      )}

      {stepId === "extras" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Extras</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Whirlybirds"><Num value={intake.whirlybirds}   onChange={(v) => set("whirlybirds", v)}/></Field>
              <Field label="Skylights"><Num value={intake.skylights}     onChange={(v) => set("skylights", v)}/></Field>
              <Field label="Insulation (sqm)"><Num value={intake.insulationSqm} onChange={(v) => set("insulationSqm", v)}/></Field>
              <Field label="Flashing (m)"><Num value={intake.flashingLm}   onChange={(v) => set("flashingLm", v)}/></Field>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Scaffolding</p>
            <Field label="Scaffold days needed"><Num value={intake.scaffoldDays} onChange={(v) => set("scaffoldDays", v)}/></Field>
            <p className="text-[12px] text-[var(--ink-faint)] mt-1.5">Scaffold cost is passed through at cost + margin</p>
          </div>
        </div>
      )}

      {stepId === "send" && (
        <div className="space-y-4">
          <div className="bg-[var(--navy)] rounded-2xl p-5">
            <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Labour ({result.labourHours}h)</span><span className="text-white font-semibold tabular">${Math.round(result.labourHours*rate).toLocaleString()}</span></div>
              <div className="flex justify-between text-[14px]"><span className="text-[var(--steel-2)]">Materials + scaffold</span><span className="text-white font-semibold tabular">${result.materialsCost.toLocaleString()}</span></div>
              <div className="border-t border-white/10 pt-2 flex justify-between"><span className="text-white font-bold">Total</span><span className="font-display text-[24px] text-[var(--amber)] tabular">${result.totalCost.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="card">
            <p className="section-tag mb-3">Client details</p>
            <div className="space-y-3">
              <Field label="Client name"><input value={clientName} onChange={(e) => setClientName(e.target.value)} className="app-field" placeholder="Jane Smith"/></Field>
              <Field label="Client email"><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="app-field" placeholder="jane@email.com"/></Field>
              <Field label="Site address"><input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="app-field" placeholder="123 Main St"/></Field>
            </div>
          </div>
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
              {paymentTerms.map((t,i) => <div key={i} className="flex justify-between text-[13.5px]"><span className="text-[var(--ink-soft)]">{t.label}</span><span className="font-bold tabular">${Math.round(result.totalCost*t.percent/100).toLocaleString()}</span></div>)}
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={() => saveAndSend(true)} disabled={saving||!clientEmail} className="btn-primary">{saving ? "Sending..." : "Send quote to client"}</button>
            <button onClick={() => saveAndSend(false)} disabled={saving} className="btn-secondary w-full justify-center">Save as draft</button>
            {saveMessage && <div className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold text-center ${saveMessage.includes("fail") ? "bg-[var(--red-bg)] text-[var(--red)]" : "bg-[var(--green-bg)] text-[var(--green)]"}`}>{saveMessage}</div>}
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
  return <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="app-field"/>;
}
function Chk({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-3 py-2.5 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}/><span className="text-[14.5px] text-[var(--ink)]">{label}</span></label>;
}
