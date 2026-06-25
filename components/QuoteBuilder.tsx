"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
    materials.length > 0
      ? materials
      : ELECTRICIAN_DEFAULT_MATERIALS.map((m) => ({ ...m }))
  );
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const costs: MaterialCostMap = useMemo(() => {
    const map: MaterialCostMap = {};
    lib.forEach((m) => (map[m.item_key] = Number(m.unit_cost) || 0));
    return map;
  }, [lib]);

  const result = useMemo(
    () => calcElectricianQuote(intake, costs, rate, margin),
    [intake, costs, rate, margin]
  );

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

    // Persist any material price edits made in this session
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
        status: sendEmail ? "sent" : "draft",
      })
      .select()
      .single();

    if (error) {
      setSaveMessage(error.message);
      setSaving(false);
      return;
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
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-neutral-500">Electrician</p>
        <a href="/electrician/quotes" className="text-sm text-blue-600">
          View all quotes
        </a>
      </div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("job")}
          className={`flex-1 py-2 rounded-md border-2 ${tab === "job" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-neutral-200"}`}
        >
          Job intake
        </button>
        <button
          onClick={() => setTab("library")}
          className={`flex-1 py-2 rounded-md border-2 ${tab === "library" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-neutral-200"}`}
        >
          Materials library
        </button>
      </div>

      {tab === "job" ? (
        <div>
          <div className="bg-neutral-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-neutral-500 mb-2">Live quote estimate</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-neutral-500">Labour</p>
                <p className="text-lg font-medium">{result.labourHours} hrs</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Materials</p>
                <p className="text-lg font-medium">${result.materialsCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Total</p>
                <p className="text-lg font-medium">${result.totalCost.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <label className="flex-1 text-sm">
              Hourly rate ($)
              <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full border rounded-md px-2 py-1 mt-1" />
            </label>
            <label className="flex-1 text-sm">
              Materials margin (%)
              <input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full border rounded-md px-2 py-1 mt-1" />
            </label>
          </div>

          <Section title="Switchboard">
            <Checkbox label="Switchboard upgrade needed" checked={intake.switchboardUpgrade} onChange={(v) => set("switchboardUpgrade", v)} />
            <Checkbox label="3-phase supply" checked={intake.threePhase} onChange={(v) => set("threePhase", v)} />
            <Checkbox label="Full RCBO upgrade" checked={intake.switchboardRcbo} onChange={(v) => set("switchboardRcbo", v)} />
          </Section>

          <Section title="Circuits and points">
            <NumberField label="Power points" value={intake.powerPoints} onChange={(v) => set("powerPoints", v)} />
            <NumberField label="Light points" value={intake.lightPoints} onChange={(v) => set("lightPoints", v)} />
            <NumberField label="Switches" value={intake.switches} onChange={(v) => set("switches", v)} />
          </Section>

          <Section title="Lighting">
            <NumberField label="Downlights" value={intake.downlights} onChange={(v) => set("downlights", v)} />
            <label className="text-sm flex-1">
              Fitting grade
              <select
                value={intake.downlightGrade}
                onChange={(e) => set("downlightGrade", e.target.value as ElectricianIntake["downlightGrade"])}
                className="w-full border rounded-md px-2 py-1 mt-1"
              >
                <option value="builder">Builder grade</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium / smart</option>
              </select>
            </label>
          </Section>

          <Section title="Roof and subfloor access">
            <label className="text-sm flex-1">
              Roof cavity access
              <select
                value={intake.roofAccess}
                onChange={(e) => set("roofAccess", Number(e.target.value) as ElectricianIntake["roofAccess"])}
                className="w-full border rounded-md px-2 py-1 mt-1"
              >
                <option value={1}>No roof work</option>
                <option value={1.3}>Easy access</option>
                <option value={1.7}>Tight crawl</option>
                <option value={2.3}>Extreme</option>
              </select>
            </label>
            <label className="text-sm flex-1">
              Subfloor access
              <select
                value={intake.subfloorAccess}
                onChange={(e) => set("subfloorAccess", Number(e.target.value) as ElectricianIntake["subfloorAccess"])}
                className="w-full border rounded-md px-2 py-1 mt-1"
              >
                <option value={1}>No subfloor work</option>
                <option value={1.3}>Easy crawl</option>
                <option value={1.8}>Tight crawl</option>
                <option value={2.4}>Wet / very low clearance</option>
              </select>
            </label>
            <NumberField label="Trenching (metres)" value={intake.trenchMetres} onChange={(v) => set("trenchMetres", v)} />
          </Section>

          <Section title="Fixed appliance circuits">
            <Checkbox label="Oven" checked={intake.applianceOven} onChange={(v) => set("applianceOven", v)} />
            <Checkbox label="Cooktop" checked={intake.applianceCooktop} onChange={(v) => set("applianceCooktop", v)} />
            <Checkbox label="Hot water" checked={intake.applianceHwc} onChange={(v) => set("applianceHwc", v)} />
            <Checkbox label="Aircon" checked={intake.applianceAircon} onChange={(v) => set("applianceAircon", v)} />
            <Checkbox label="Pool / spa" checked={intake.appliancePool} onChange={(v) => set("appliancePool", v)} />
          </Section>

          <Section title="Data and comms">
            <NumberField label="Data points" value={intake.dataPoints} onChange={(v) => set("dataPoints", v)} />
            <Checkbox label="NBN connection point" checked={intake.nbn} onChange={(v) => set("nbn", v)} />
          </Section>

          <Section title="Site access and compliance">
            <label className="text-sm flex-1">
              Overall site access
              <select
                value={intake.siteAccess}
                onChange={(e) => set("siteAccess", e.target.value as ElectricianIntake["siteAccess"])}
                className="w-full border rounded-md px-2 py-1 mt-1"
              >
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="difficult">Difficult</option>
              </select>
            </label>
            <Checkbox label="Multi-storey" checked={intake.multistorey} onChange={(v) => set("multistorey", v)} />
            <NumberField label="Smoke alarms to interconnect" value={intake.smokeAlarms} onChange={(v) => set("smokeAlarms", v)} />
            <Checkbox label="COES required" checked={intake.coes} onChange={(v) => set("coes", v)} />
          </Section>

          <div className="border-t pt-4 mt-2 space-y-3">
            <p className="font-medium text-sm">Send to client</p>
            <input placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            <input placeholder="Client email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            <input placeholder="Site address" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="w-full border rounded-md px-3 py-2" />
            <div className="flex gap-3">
              <button onClick={() => saveAndSend(false)} disabled={saving} className="flex-1 border rounded-md py-2 font-medium disabled:opacity-50">
                Save draft
              </button>
              <button
                onClick={() => saveAndSend(true)}
                disabled={saving || !clientEmail}
                className="flex-1 bg-blue-600 text-white rounded-md py-2 font-medium disabled:opacity-50"
              >
                Save and email quote
              </button>
            </div>
            {saveMessage && <p className="text-sm text-neutral-600">{saveMessage}</p>}
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-neutral-100 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium mb-1">Upload your supplier pricing</p>
            <p className="text-xs text-neutral-500 mb-3">
              CSV with columns: key,cost — keys must match the list below.
            </p>
            <div className="flex gap-2">
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="flex-1 text-sm" />
              <button onClick={downloadTemplate} className="border rounded-md px-3 py-1 text-sm">
                Download template
              </button>
            </div>
          </div>
          <div className="divide-y">
            <div className="grid grid-cols-[2fr_1fr_100px] text-xs text-neutral-500 font-medium py-2">
              <span>Item</span>
              <span>Key</span>
              <span>Unit cost ($)</span>
            </div>
            {lib.map((m) => (
              <div key={m.item_key} className="grid grid-cols-[2fr_1fr_100px] items-center py-2 text-sm">
                <span>{m.label}</span>
                <span className="text-xs font-mono text-neutral-400">{m.item_key}</span>
                <input
                  type="number"
                  value={m.unit_cost}
                  onChange={(e) => updateLibCost(m.item_key, Number(e.target.value))}
                  className="border rounded-md px-2 py-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-4">
      <p className="font-medium text-sm mb-3">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border rounded-md px-2 py-1 mt-1"
      />
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
