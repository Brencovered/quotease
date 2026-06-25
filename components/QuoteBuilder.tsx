"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_TERM_PRESETS, type PaymentTerm } from "@/lib/paymentTerms";
import { ScanLine, AlertTriangle } from "lucide-react";
import {
  calcElectricianQuote,
  ELECTRICIAN_DEFAULT_MATERIALS,
  type ElectricianIntake,
  type MaterialCostMap,
} from "@/lib/calc";

type MaterialRow = { item_key: string; label: string; unit_cost: number };

const DEFAULT_INTAKE: ElectricianIntake = {
  jobType: "reno",
  switchboardUpgrade: false,
  switchboardRcbo: false,
  threePhase: false,
  powerPoints: 0,
  lightPoints: 0,
  switches: 0,
  downlights: 0,
  downlightGrade: "builder",
  roofAccess: 1,
  subfloorAccess: 1,
  trenchMetres: 0,
  applianceOven: false,
  applianceCooktop: false,
  applianceHwc: false,
  applianceAircon: false,
  appliancePool: false,
  dataPoints: 0,
  nbn: false,
  siteAccess: "easy",
  multistorey: false,
  smokeAlarms: 0,
  coes: false,
  notes: "",
};

export default function QuoteBuilder({
  profile,
  materials,
}: {
  profile: { hourly_rate: number; materials_margin_pct: number };
  materials: MaterialRow[];
}) {
  const [tab, setTab] = useState<"job" | "library">("job");
  const [intake, setIntake] = useState<ElectricianIntake>(DEFAULT_INTAKE);
  const [rate, setRate] = useState(profile.hourly_rate ?? 95);
  const [margin, setMargin] = useState(profile.materials_margin_pct ?? 20);
  const [lib, setLib] = useState<MaterialRow[]>(
    materials.length > 0 ? materials : ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [termsPreset, setTermsPreset] = useState<keyof typeof PAYMENT_TERM_PRESETS | "custom">("full_on_completion");
  const [customTerms, setCustomTerms] = useState<PaymentTerm[]>([
    { label: "Deposit", percent: 50, trigger: "acceptance", days: 0 },
    { label: "Final payment", percent: 50, trigger: "completion", days: 7 },
  ]);
  const paymentTerms: PaymentTerm[] = termsPreset === "custom" ? customTerms : PAYMENT_TERM_PRESETS[termsPreset];
  const customTermsTotal = customTerms.reduce((sum, t) => sum + (Number(t.percent) || 0), 0);

  function updateCustomTerm(index: number, patch: Partial<PaymentTerm>) {
    setCustomTerms((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }
  function addCustomTerm() {
    setCustomTerms((prev) => [...prev, { label: "Payment", percent: 0, trigger: "completion", days: 7 }]);
  }
  function removeCustomTerm(index: number) {
    setCustomTerms((prev) => prev.filter((_, i) => i !== index));
  }
  const [saving, setSaving] = useState(false);
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [drawingInstructions, setDrawingInstructions] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ confidence: string; notes: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [usageLimitReached, setUsageLimitReached] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const costs: MaterialCostMap = useMemo(() => {
    const map: MaterialCostMap = {};
    lib.forEach((m) => (map[m.item_key] = Number(m.unit_cost) || 0));
    return map;
  }, [lib]);

  const result = useMemo(() => calcElectricianQuote(intake, costs, rate, margin), [intake, costs, rate, margin]);

  function set<K extends keyof ElectricianIntake>(key: K, value: ElectricianIntake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  function updateLibCost(item_key: string, value: number) {
    setLib((prev) => prev.map((m) => (m.item_key === item_key ? { ...m, unit_cost: value } : m)));
  }

  function downloadTemplate() {
    const rows = ["key,cost", ...lib.map((m) => `${m.item_key},${m.unit_cost}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "material_price_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const updates: Record<string, number> = {};
      lines.forEach((line) => {
        const [key, cost] = line.split(",");
        if (key && cost && !isNaN(Number(cost))) updates[key.trim()] = Number(cost);
      });
      setLib((prev) =>
        prev.map((m) => (updates[m.item_key] !== undefined ? { ...m, unit_cost: updates[m.item_key] } : m))
      );
    };
    reader.readAsText(file);
  }

  async function analyzeDrawing(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDrawingFile(file);
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setUsageLimitReached(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (drawingInstructions.trim()) formData.append("instructions", drawingInstructions.trim());
      const res = await fetch("/api/quotes/analyze-drawing", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setAnalysisError(body.error ?? "Analysis failed");
        if (body.usageLimitReached) setUsageLimitReached(true);
        setAnalyzing(false);
        return;
      }

      const r = body.result;
      setIntake((prev) => ({
        ...prev,
        powerPoints: r.power_points ?? prev.powerPoints,
        lightPoints: r.light_points ?? prev.lightPoints,
        switches: r.switches ?? prev.switches,
        downlights: r.downlights ?? prev.downlights,
        switchboardUpgrade: r.switchboard_upgrade ?? prev.switchboardUpgrade,
        threePhase: r.three_phase ?? prev.threePhase,
        dataPoints: r.data_points ?? prev.dataPoints,
        smokeAlarms: r.smoke_alarms ?? prev.smokeAlarms,
      }));
      setAnalysisResult({ confidence: r.confidence ?? "medium", notes: r.notes ?? "" });
    } catch {
      setAnalysisError("Could not reach the drawing analysis service.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAndSend(sendEmail: boolean) {
    setSaving(true);
    setSaveMessage(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaveMessage("Not logged in");
      setSaving(false);
      return;
    }

    for (const m of lib) {
      await supabase
        .from("material_items")
        .upsert(
          { profile_id: userData.user.id, trade: "electrician", item_key: m.item_key, label: m.label, unit_cost: m.unit_cost },
          { onConflict: "profile_id,item_key" }
        );
    }

    const { data: quote, error } = await supabase
      .from("quotes")
      .insert({
        profile_id: userData.user.id,
        client_name: clientName,
        client_email: clientEmail,
        site_address: siteAddress,
        trade: "electrician",
        job_type: intake.jobType,
        intake_data: intake,
        labour_hours: result.labourHours,
        materials_cost: result.materialsCost,
        total_cost: result.totalCost,
        payment_terms: paymentTerms,
        status: sendEmail ? "sent" : "draft",
      })
      .select()
      .single();

    if (error) {
      setSaveMessage(error.message);
      setSaving(false);
      return;
    }

    if (drawingFile) {
      const safeName = drawingFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${userData.user.id}/${quote.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("job-files").upload(path, drawingFile);
      if (!uploadError) {
        await supabase.from("job_attachments").insert({
          quote_id: quote.id,
          profile_id: userData.user.id,
          file_name: drawingFile.name,
          storage_path: path,
          file_type: drawingFile.type,
          file_size: drawingFile.size,
        });
      }
    }

    if (sendEmail) {
      const res = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveMessage(`Saved, but sending failed: ${body.error ?? res.statusText}`);
        setSaving(false);
        return;
      }
      setSaveMessage(`Quote saved and sent to ${clientEmail}`);
    } else {
      setSaveMessage("Quote saved as draft");
    }
    setSaving(false);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
      {/* TABS */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("job")}
          className={`flex-1 py-3 rounded-lg font-semibold text-sm border-2 transition-colors ${
            tab === "job"
              ? "border-[var(--navy)] bg-[var(--navy)] text-white"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]"
          }`}
        >
          Job intake
        </button>
        <button
          onClick={() => setTab("library")}
          className={`flex-1 py-3 rounded-lg font-semibold text-sm border-2 transition-colors ${
            tab === "library"
              ? "border-[var(--navy)] bg-[var(--navy)] text-white"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]"
          }`}
        >
          Materials library
        </button>
      </div>

      {tab === "job" ? (
        <div className="flex flex-col gap-4">
          {/* LIVE TOTAL - docket-styled, sticky so it's always visible while scrolling a long form */}
          <div
            className="sticky top-[68px] z-30 bg-[var(--navy)] rounded-xl px-5 py-4"
            style={{ boxShadow: "0 10px 24px rgba(10,23,34,.18)" }}
          >
            <p className="text-[11px] tracking-[.14em] uppercase text-[var(--steel-3)] font-bold mb-2">
              Live quote estimate
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-[var(--steel-2)] font-medium">Labour</p>
                <p className="font-display text-xl text-white">{result.labourHours}h</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--steel-2)] font-medium">Materials</p>
                <p className="font-display text-xl text-white">${result.materialsCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--steel-2)] font-medium">Total</p>
                <p className="font-display text-xl text-[var(--amber)]">${result.totalCost.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <SectionCard label="Drawing" title="Estimate from a drawing (optional)" sub="Upload a floor plan, electrical drawing, or site photo — AI reads it and pre-fills the fields below for you to review">
            <label className="block mb-3">
              <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">
                Anything specific the AI should focus on? (optional)
              </span>
              <textarea
                value={drawingInstructions}
                onChange={(e) => setDrawingInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. only count new circuits marked in red, ignore the existing wiring shown in grey"
                className="app-field"
              />
            </label>

            <label className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-2 cursor-pointer">
              <ScanLine size={15} />
              {analyzing ? "Reading drawing..." : drawingFile ? "Re-analyse a different file" : "Upload drawing"}
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={analyzing} onChange={analyzeDrawing} />
            </label>

            {drawingFile && !analyzing && (
              <p className="text-[12.5px] text-[var(--ink-faint)] mt-2">{drawingFile.name} — attached to this job once saved</p>
            )}

            {analysisError && (
              <div className="mt-2">
                <p className="text-[13px] text-red-600 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {analysisError}
                </p>
                {usageLimitReached && (
                  <a href="/settings" className="text-[13px] font-semibold text-[var(--navy)] underline">
                    Go to Settings to subscribe
                  </a>
                )}
              </div>
            )}

            {analysisResult && (
              <div
                className={`mt-3 rounded-lg p-3 text-[13px] flex items-start gap-2 ${
                  analysisResult.confidence === "low" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
                }`}
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Fields below were pre-filled from the drawing ({analysisResult.confidence} confidence) — check every number before sending.
                  </p>
                  {analysisResult.notes && <p className="mt-1">{analysisResult.notes}</p>}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard label="Rates" title="Your rate for this quote">
            <FieldGrid cols={2}>
              <Field label="Hourly rate ($)">
                <input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="app-field" />
              </Field>
              <Field label="Materials margin (%)">
                <input type="number" inputMode="decimal" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="app-field" />
              </Field>
            </FieldGrid>
          </SectionCard>

          <SectionCard label="Switchboard" title="Switchboard work">
            <CheckRow checked={intake.switchboardUpgrade} onChange={(v) => set("switchboardUpgrade", v)} label="Switchboard upgrade needed" />
            <CheckRow checked={intake.threePhase} onChange={(v) => set("threePhase", v)} label="3-phase supply" />
            <CheckRow checked={intake.switchboardRcbo} onChange={(v) => set("switchboardRcbo", v)} label="Full RCBO upgrade (vs RCD only)" />
          </SectionCard>

          <SectionCard label="Circuits" title="Circuits and points">
            <FieldGrid cols={3}>
              <Field label="Power points"><NumInput value={intake.powerPoints} onChange={(v) => set("powerPoints", v)} /></Field>
              <Field label="Light points"><NumInput value={intake.lightPoints} onChange={(v) => set("lightPoints", v)} /></Field>
              <Field label="Switches"><NumInput value={intake.switches} onChange={(v) => set("switches", v)} /></Field>
            </FieldGrid>
          </SectionCard>

          <SectionCard label="Lighting" title="Downlights and fittings">
            <FieldGrid cols={2}>
              <Field label="Downlights"><NumInput value={intake.downlights} onChange={(v) => set("downlights", v)} /></Field>
              <Field label="Fitting grade">
                <select
                  value={intake.downlightGrade}
                  onChange={(e) => set("downlightGrade", e.target.value as ElectricianIntake["downlightGrade"])}
                  className="app-field"
                >
                  <option value="builder">Builder grade</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium / smart</option>
                </select>
              </Field>
            </FieldGrid>
          </SectionCard>

          <SectionCard label="Access" title="Roof and subfloor access" sub="Drives the wiring time estimate — not switchboard or appliance work">
            <FieldGrid cols={2}>
              <Field label="Roof cavity access">
                <select value={intake.roofAccess} onChange={(e) => set("roofAccess", Number(e.target.value) as ElectricianIntake["roofAccess"])} className="app-field">
                  <option value={1}>No roof work</option>
                  <option value={1.3}>Easy access</option>
                  <option value={1.7}>Tight crawl</option>
                  <option value={2.3}>Extreme</option>
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
            </FieldGrid>
            <div className="mt-3">
              <Field label="Trenching (metres)"><NumInput value={intake.trenchMetres} onChange={(v) => set("trenchMetres", v)} /></Field>
            </div>
          </SectionCard>

          <SectionCard label="Appliances" title="Fixed appliance circuits">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
              <CheckRow checked={intake.applianceOven} onChange={(v) => set("applianceOven", v)} label="Oven" />
              <CheckRow checked={intake.applianceCooktop} onChange={(v) => set("applianceCooktop", v)} label="Cooktop" />
              <CheckRow checked={intake.applianceHwc} onChange={(v) => set("applianceHwc", v)} label="Hot water" />
              <CheckRow checked={intake.applianceAircon} onChange={(v) => set("applianceAircon", v)} label="Aircon" />
              <CheckRow checked={intake.appliancePool} onChange={(v) => set("appliancePool", v)} label="Pool / spa" />
            </div>
          </SectionCard>

          <SectionCard label="Data" title="Data and comms">
            <FieldGrid cols={2}>
              <Field label="Data points"><NumInput value={intake.dataPoints} onChange={(v) => set("dataPoints", v)} /></Field>
              <div className="flex items-end pb-2.5">
                <CheckRow checked={intake.nbn} onChange={(v) => set("nbn", v)} label="NBN connection point" />
              </div>
            </FieldGrid>
          </SectionCard>

          <SectionCard label="Site" title="Site access and compliance">
            <FieldGrid cols={2}>
              <Field label="Overall site access">
                <select value={intake.siteAccess} onChange={(e) => set("siteAccess", e.target.value as ElectricianIntake["siteAccess"])} className="app-field">
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="difficult">Difficult</option>
                </select>
              </Field>
              <div className="flex items-end pb-2.5">
                <CheckRow checked={intake.multistorey} onChange={(v) => set("multistorey", v)} label="Multi-storey" />
              </div>
            </FieldGrid>
            <FieldGrid cols={2} className="mt-3">
              <Field label="Smoke alarms to interconnect"><NumInput value={intake.smokeAlarms} onChange={(v) => set("smokeAlarms", v)} /></Field>
              <div className="flex items-end pb-2.5">
                <CheckRow checked={intake.coes} onChange={(v) => set("coes", v)} label="COES required" />
              </div>
            </FieldGrid>
          </SectionCard>

          <SectionCard label="Payment" title="Payment terms">
            <select
              value={termsPreset}
              onChange={(e) => setTermsPreset(e.target.value as keyof typeof PAYMENT_TERM_PRESETS | "custom")}
              className="app-field mb-3"
            >
              <option value="full_on_completion">100% on completion (14 days)</option>
              <option value="deposit_50_50">50% deposit, 50% on completion</option>
              <option value="deposit_30_70">30% deposit, 70% on completion</option>
              <option value="due_on_invoice">100% due on invoice (7 days)</option>
              <option value="custom">Custom — set your own split</option>
            </select>

            {termsPreset === "custom" ? (
              <div className="space-y-2">
                {customTerms.map((t, i) => (
                  <div key={i} className="bg-[var(--app-bg)] rounded-lg p-3 grid grid-cols-[1fr_70px_auto] gap-2 items-end">
                    <label className="block">
                      <span className="block text-[11px] font-medium text-[var(--ink-soft)] mb-1">Label</span>
                      <input
                        value={t.label}
                        onChange={(e) => updateCustomTerm(i, { label: e.target.value })}
                        className="app-field py-1.5 text-[13px]"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-medium text-[var(--ink-soft)] mb-1">%</span>
                      <input
                        type="number"
                        value={t.percent}
                        onChange={(e) => updateCustomTerm(i, { percent: Number(e.target.value) })}
                        className="app-field py-1.5 text-[13px]"
                      />
                    </label>
                    <button
                      onClick={() => removeCustomTerm(i)}
                      disabled={customTerms.length <= 1}
                      className="text-red-600 text-[13px] font-semibold px-2 py-1.5 disabled:opacity-30"
                    >
                      Remove
                    </button>
                    <label className="block col-span-2">
                      <span className="block text-[11px] font-medium text-[var(--ink-soft)] mb-1">Due</span>
                      <select
                        value={t.trigger}
                        onChange={(e) => updateCustomTerm(i, { trigger: e.target.value as PaymentTerm["trigger"] })}
                        className="app-field py-1.5 text-[13px]"
                      >
                        <option value="acceptance">On acceptance</option>
                        <option value="completion">On completion</option>
                        <option value="invoice_date">On invoice date</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-medium text-[var(--ink-soft)] mb-1">+ days</span>
                      <input
                        type="number"
                        value={t.days}
                        onChange={(e) => updateCustomTerm(i, { days: Number(e.target.value) })}
                        className="app-field py-1.5 text-[13px]"
                      />
                    </label>
                  </div>
                ))}
                <button onClick={addCustomTerm} className="text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-1.5">
                  + Add payment term
                </button>
                {customTermsTotal !== 100 && (
                  <p className="text-[12.5px] text-red-600 font-medium">
                    These add up to {customTermsTotal}% — they should total 100%.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-[var(--app-bg)] rounded-lg p-3 space-y-1">
                {paymentTerms.map((t, i) => (
                  <p key={i} className="text-[13px] text-[var(--ink-soft)] flex justify-between">
                    <span>{t.label}</span>
                    <span className="font-semibold text-[var(--ink)] tabular">
                      {t.percent}% — ${Math.round((result.totalCost * t.percent) / 100).toLocaleString()}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard label="Send" title="Send to client">
            <FieldGrid cols={1}>
              <Field label="Client name"><input value={clientName} onChange={(e) => setClientName(e.target.value)} className="app-field" /></Field>
              <Field label="Client email"><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="app-field" /></Field>
              <Field label="Site address"><input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="app-field" /></Field>
            </FieldGrid>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => saveAndSend(false)}
                disabled={saving}
                className="flex-1 border-2 border-[var(--line)] text-[var(--ink)] rounded-lg py-3 font-semibold text-sm disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                onClick={() => saveAndSend(true)}
                disabled={saving || !clientEmail}
                className="flex-1 bg-[var(--amber)] text-[var(--navy)] rounded-lg py-3 font-bold text-sm disabled:opacity-40"
              >
                Save and email quote
              </button>
            </div>
            {saveMessage && <p className="text-sm text-[var(--ink-soft)] mt-3">{saveMessage}</p>}
          </SectionCard>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SectionCard label="Pricing" title="Upload your supplier pricing" sub="CSV with columns: key,cost — use the template for the exact keys">
            <div className="flex flex-wrap gap-2">
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="text-sm flex-1 min-w-[180px]" />
              <button onClick={downloadTemplate} className="border-2 border-[var(--line)] rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap">
                Download template
              </button>
            </div>
          </SectionCard>

          <SectionCard label="Library" title="Your prices">
            <div className="divide-y divide-[var(--line)]">
              <div className="grid grid-cols-[2fr_90px] text-[11px] uppercase tracking-wide text-[var(--ink-faint)] font-bold pb-2">
                <span>Item</span>
                <span className="text-right">Cost ($)</span>
              </div>
              {lib.map((m) => (
                <div key={m.item_key} className="grid grid-cols-[2fr_90px] items-center py-2.5 gap-2">
                  <span className="text-[14px] text-[var(--ink)]">{m.label}</span>
                  <input
                    type="number"
                    value={m.unit_cost}
                    onChange={(e) => updateLibCost(m.item_key, Number(e.target.value))}
                    className="app-field text-right py-2"
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </main>
  );
}

function SectionCard({
  label,
  title,
  sub,
  children,
}: {
  label: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">{label}</p>
      <p className="font-semibold text-[var(--ink)] mb-1">{title}</p>
      {sub && <p className="text-[12px] text-[var(--ink-faint)] mb-3">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function FieldGrid({ cols, className = "", children }: { cols: 1 | 2 | 3; className?: string; children: React.ReactNode }) {
  const colClass = cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";
  return <div className={`grid ${colClass} gap-3 ${className}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="app-field"
    />
  );
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 py-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[14.5px] text-[var(--ink)]">{label}</span>
    </label>
  );
}
