"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";

type ClientOption = { id: string; name: string | null; billing_address?: string | null };

type TemplateOption = { id: string; name: string };

export default function NewStructureButton({ clients, templates = [] }: { clients: ClientOption[]; templates?: TemplateOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [kind, setKind] = useState<"build" | "house">("build");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErr("You are signed out. Log in again.");
      setBusy(false);
      return;
    }
    const businessId = await getActiveBusinessId(supabase, user.id);
    const client = clients.find((c) => c.id === clientId);
    const fallback = client?.name ? `${client.name} build` : "New build";
    let plan: Record<string, unknown> = {};
    let summary: Record<string, unknown> = {};
    if (kind === "house") plan = { kind: "house" };
    else if (templateId) {
      const { data: tpl } = await supabase
        .from("structure_plans")
        .select("plan, summary, materials_total, labour_hours")
        .eq("id", templateId)
        .eq("profile_id", businessId)
        .maybeSingle();
      if (tpl) {
        plan = (tpl.plan as Record<string, unknown>) ?? {};
        summary = (tpl.summary as Record<string, unknown>) ?? {};
      }
    }
    const { data, error } = await supabase
      .from("structure_plans")
      .insert({
        profile_id: businessId,
        client_id: clientId || null,
        name: name.trim() || fallback,
        plan,
        summary,
        materials_total: Number(summary.materialsTotal) || 0,
        labour_hours: Number(summary.labourHours) || 0,
      })
      .select("id")
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not create the build.");
      setBusy(false);
      return;
    }
    router.push(`/structures/${data.id}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !w-auto !py-2.5 !px-5 !text-[14px]">
        <Plus size={16} /> New build
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New build">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-[20px] text-[var(--ink)]">New build</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-[var(--ink-faint)]">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4" role="radiogroup" aria-label="What are you building">
              {([
                ["build", "Shed, garage, carport, pergola or deck", "Design it in 3D"],
                ["house", "House or extension", "Trace a floor plan"],
              ] as const).map(([k, t, s]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`text-left rounded-xl border-2 px-3 py-2.5 ${kind === k ? "border-[var(--amber)] bg-[var(--amber-light)]" : "border-[var(--line)]"}`}
                >
                  <span className="block text-[13px] font-bold text-[var(--ink)] leading-tight">{t}</span>
                  <span className="block text-[11.5px] text-[var(--ink-faint)] mt-0.5">{s}</span>
                </button>
              ))}
            </div>
            <label className="block text-[12.5px] font-bold text-[var(--ink-soft)] mb-1">Name</label>
            <input
              className="app-field mb-4"
              placeholder="e.g. Smith double garage"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <label className="block text-[12.5px] font-bold text-[var(--ink-soft)] mb-1">Client</label>
            <select className="app-field mb-1" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client yet</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? "Unnamed client"}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-[var(--ink-faint)] mb-4">You can link a client later. Prices from your last build carry over.</p>
            {templates.length > 0 && kind === "build" && (
              <>
                <label className="block text-[12.5px] font-bold text-[var(--ink-soft)] mb-1">Start from</label>
                <select className="app-field mb-5" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Blank, describe it or pick a starter</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {err && <p className="text-[13px] text-red-600 mb-3">{err}</p>}
            <button type="button" className="btn-primary" disabled={busy} onClick={create}>
              {busy ? "Creating..." : "Open the planner"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
