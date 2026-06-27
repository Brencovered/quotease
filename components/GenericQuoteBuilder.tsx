"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { ChevronRight, ChevronLeft, Check, Plus, Trash2 } from "lucide-react";
import { calcGenericQuote, GENERIC_TRADE_TEMPLATES, type GenericLineItem, type GenericIntake } from "@/lib/genericTrades";

const STEPS = [
  { id: "job",     label: "Job" },
  { id: "items",   label: "Items" },
  { id: "send",    label: "Send" },
];

let nextId = 1;
function uid() { return `item_${nextId++}`; }

export default function GenericQuoteBuilder({
  tradeKey,
  profile,
}: {
  tradeKey: string;
  profile: { hourly_rate: number; materials_margin_pct: number };
}) {
  const template = GENERIC_TRADE_TEMPLATES[tradeKey] ?? GENERIC_TRADE_TEMPLATES.custom;
  const margin   = profile.materials_margin_pct ?? 20;

  const [step,        setStep]        = useState(0);
  const [jobType,     setJobType]     = useState(template.jobTypes[0]);
  const [description, setDescription] = useState("");
  const [siteAccess,  setSiteAccess]  = useState<GenericIntake["siteAccess"]>("easy");
  const [items,       setItems]       = useState<GenericLineItem[]>(
    template.defaultItems.map((it) => ({ ...it, id: uid() }))
  );

  const [clientName,  setClientName]  = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [termsPreset, setTermsPreset] = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">("full_on_completion");
  const [saving,      setSaving]      = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const intake: GenericIntake = useMemo(() => ({
    jobType, description, lineItems: items, siteAccess,
  }), [jobType, description, items, siteAccess]);

  const result = useMemo(() => calcGenericQuote(intake, margin), [intake, margin]);
  const paymentTerms = termsPreset === "custom" ? [] : PAYMENT_TERM_PRESETS[termsPreset];

  function addItem(isLabour: boolean) {
    setItems((p) => [...p, {
      id: uid(),
      label: isLabour ? "Labour" : "Materials",
      qty: isLabour ? 1 : 1,
      unit: isLabour ? "hr" : "item",
      unit_cost: isLabour ? (profile.hourly_rate ?? 85) : 0,
      is_labour: isLabour,
    }]);
  }

  function updateItem(id: string, field: keyof GenericLineItem, value: string | number | boolean) {
    setItems((p) => p.map((it) => it.id === id ? { ...it, [field]: value } : it));
  }

  function removeItem(id: string) {
    setItems((p) => p.filter((it) => it.id !== id));
  }

  async function saveAndSend(sendEmail: boolean) {
    setSaving(true); setSaveMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveMessage("Not logged in"); setSaving(false); return; }

    const intakeData = { ...intake, tradeKey };
    const { data: quote, error } = await supabase.from("quotes").insert({
      profile_id:    user.id,
      client_name:   clientName,
      client_email:  clientEmail,
      site_address:  siteAddress,
      trade:         tradeKey,
      job_type:      jobType,
      intake_data:   intakeData,
      labour_hours:  result.labourHours,
      materials_cost: result.materialsCost,
      total_cost:    result.totalCost,
      payment_terms: paymentTerms,
      status:        sendEmail ? "sent" : "draft",
    }).select().single();

    if (error) { setSaveMessage(error.message); setSaving(false); return; }

    if (sendEmail) {
      const res = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setSaveMessage(`Saved - sending failed: ${b.error ?? res.statusText}`);
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
      {/* Live total */}
      <div className="sticky top-12 sm:top-14 z-30 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="bg-[var(--navy)] rounded-none sm:rounded-2xl px-5 py-3 flex items-center justify-between"
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

      {/* Steps */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap transition-all ${
              i === step ? "bg-[var(--navy)] text-white" :
              i < step  ? "bg-[var(--amber-light)] text-[var(--amber-deep)]" :
              "bg-[var(--surface)] text-[var(--ink-faint)] border border-[var(--line)]"
            }`}>
            {i < step && <Check size={11} />}{s.label}
          </button>
        ))}
      </div>

      {/* Step: Job */}
      {stepId === "job" && (
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Job details</p>
            <div className="space-y-3">
              <Field label="Job type">
                <select value={jobType} onChange={(e) => setJobType(e.target.value)} className="app-field">
                  {template.jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Brief description (optional)">
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  className="app-field" placeholder="e.g. Full repaint of 3-bed house, walls only" />
              </Field>
              <Field label="Site access">
                <select value={siteAccess} onChange={(e) => setSiteAccess(e.target.value as GenericIntake["siteAccess"])} className="app-field">
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate (10% labour premium)</option>
                  <option value="difficult">Difficult (25% labour premium)</option>
                </select>
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* Step: Items */}
      {stepId === "items" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="section-tag">Line items</p>
              <p className="text-[12px] text-[var(--ink-faint)]">
                Margin ({margin}%) applied to materials
              </p>
            </div>

            {/* Labour items */}
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2">Labour</p>
            <div className="space-y-2 mb-3">
              {items.filter((it) => it.is_labour).map((it) => (
                <ItemRow key={it.id} item={it} onUpdate={updateItem} onRemove={removeItem} />
              ))}
              <button onClick={() => addItem(true)}
                className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-[var(--line)] rounded-xl py-2.5 text-[13px] font-semibold text-[var(--ink-faint)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors">
                <Plus size={14} /> Add labour line
              </button>
            </div>

            {/* Materials items */}
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2 mt-4">Materials</p>
            <div className="space-y-2 mb-3">
              {items.filter((it) => !it.is_labour).map((it) => (
                <ItemRow key={it.id} item={it} onUpdate={updateItem} onRemove={removeItem} />
              ))}
              <button onClick={() => addItem(false)}
                className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-[var(--line)] rounded-xl py-2.5 text-[13px] font-semibold text-[var(--ink-faint)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors">
                <Plus size={14} /> Add material line
              </button>
            </div>

            {/* Running total */}
            <div className="bg-[var(--navy)] rounded-xl p-4 mt-4">
              <div className="flex justify-between text-[13.5px] mb-1.5">
                <span className="text-[var(--steel-2)]">Labour ({result.labourHours}h)</span>
                <span className="text-white font-semibold tabular">
                  ${(result.totalCost - result.materialsCost).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[13.5px] mb-3">
                <span className="text-[var(--steel-2)]">Materials + {margin}% margin</span>
                <span className="text-white font-semibold tabular">${result.materialsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <span className="text-white font-bold">Total</span>
                <span className="font-display text-[22px] text-[var(--amber)] tabular">${result.totalCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Send */}
      {stepId === "send" && (
        <div className="space-y-4">
          <div className="bg-[var(--navy)] rounded-2xl p-5">
            <p className="text-[11px] text-[var(--steel-3)] font-bold uppercase tracking-wider mb-3">Quote summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="text-[var(--steel-2)]">Labour ({result.labourHours}h)</span>
                <span className="text-white font-semibold tabular">${(result.totalCost - result.materialsCost).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[var(--steel-2)]">Materials</span>
                <span className="text-white font-semibold tabular">${result.materialsCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="text-white font-bold text-[15px]">Total</span>
                <span className="font-display text-[24px] text-[var(--amber)] tabular">${result.totalCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="section-tag mb-3">Client details</p>
            <div className="space-y-3">
              <Field label="Client name">
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="app-field" placeholder="Jane Smith" />
              </Field>
              <Field label="Client email">
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="app-field" placeholder="jane@email.com" />
              </Field>
              <Field label="Site address">
                <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="app-field" placeholder="123 Main St, Suburb" />
              </Field>
            </div>
          </div>

          <div className="card">
            <p className="section-tag mb-3">Payment terms</p>
            <select value={termsPreset} onChange={(e) => setTermsPreset(e.target.value as keyof typeof PAYMENT_TERM_PRESETS | "custom")} className="app-field mb-3">
              <option value="full_on_completion">100% on completion (14 days)</option>
              <option value="deposit_50_50">50% deposit, 50% on completion</option>
              <option value="deposit_30_70">30% deposit, 70% on completion</option>
              <option value="due_on_invoice">100% due on invoice (7 days)</option>
            </select>
            {paymentTerms.length > 0 && (
              <div className="bg-[var(--app-bg)] rounded-xl p-3 space-y-1.5">
                {paymentTerms.map((t, i) => (
                  <div key={i} className="flex justify-between text-[13.5px]">
                    <span className="text-[var(--ink-soft)]">{t.label}</span>
                    <span className="font-bold tabular">{t.percent}% - ${Math.round(result.totalCost * t.percent / 100).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button onClick={() => saveAndSend(true)} disabled={saving || !clientEmail} className="btn-primary">
              {saving ? "Sending..." : "Send quote to client"}
            </button>
            <button onClick={() => saveAndSend(false)} disabled={saving} className="btn-secondary w-full justify-center">
              Save as draft
            </button>
            {saveMessage && (
              <div className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold text-center ${saveMessage.includes("fail") ? "bg-[var(--red-bg)] text-[var(--red)]" : "bg-[var(--green-bg)] text-[var(--green)]"}`}>
                {saveMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
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

function ItemRow({ item, onUpdate, onRemove }: {
  item: GenericLineItem;
  onUpdate: (id: string, field: keyof GenericLineItem, value: string | number | boolean) => void;
  onRemove: (id: string) => void;
}) {
  const lineTotal = item.qty * item.unit_cost;
  return (
    <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={item.label}
          onChange={(e) => onUpdate(item.id, "label", e.target.value)}
          className="flex-1 text-[13.5px] font-semibold text-[var(--ink)] bg-transparent border-0 outline-none"
          placeholder="Item description"
        />
        <button onClick={() => onRemove(item.id)} className="text-[var(--ink-faint)] hover:text-[var(--red)] transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-[60px_80px_80px_auto] gap-2 items-center">
        <div>
          <p className="text-[10px] text-[var(--ink-faint)] font-bold uppercase mb-0.5">Qty</p>
          <input
            type="number" min={0} step={0.5}
            value={item.qty}
            onChange={(e) => onUpdate(item.id, "qty", parseFloat(e.target.value) || 0)}
            className="app-field py-1 text-[13px] text-center"
          />
        </div>
        <div>
          <p className="text-[10px] text-[var(--ink-faint)] font-bold uppercase mb-0.5">Unit</p>
          <select value={item.unit} onChange={(e) => onUpdate(item.id, "unit", e.target.value)} className="app-field py-1 text-[13px]">
            <option value="hr">hr</option>
            <option value="day">day</option>
            <option value="ea">ea</option>
            <option value="item">item</option>
            <option value="m">m</option>
            <option value="lm">lm</option>
            <option value="sqm">sqm</option>
            <option value="m3">m3</option>
          </select>
        </div>
        <div>
          <p className="text-[10px] text-[var(--ink-faint)] font-bold uppercase mb-0.5">Unit cost</p>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] text-[12px]">$</span>
            <input
              type="number" min={0} step={1}
              value={item.unit_cost}
              onChange={(e) => onUpdate(item.id, "unit_cost", parseFloat(e.target.value) || 0)}
              className="app-field py-1 text-[13px] pl-5"
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[var(--ink-faint)] font-bold uppercase mb-0.5">Total</p>
          <p className="text-[13.5px] font-bold text-[var(--ink)] tabular">${lineTotal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}
