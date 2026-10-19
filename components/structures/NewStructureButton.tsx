"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";

type ClientOption = { id: string; name: string | null; billing_address?: string | null };

export default function NewStructureButton({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
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
    const { data, error } = await supabase
      .from("structure_plans")
      .insert({ profile_id: businessId, client_id: clientId || null, name: name.trim() || fallback })
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
            <p className="text-[12px] text-[var(--ink-faint)] mb-5">You can link a client later. Prices from your last build carry over.</p>
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
