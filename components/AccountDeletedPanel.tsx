"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function AccountDeletedPanel({
  businessName,
  purgeDateIso,
}: {
  businessName: string;
  deletedAtIso: string;
  purgeDateIso: string;
}) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setRestoring(true); setError(null);
    try {
      const res = await fetch("/api/account/restore", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not restore account.");
      router.push("/electrician");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore account.");
      setRestoring(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] px-4">
      <div className="max-w-md w-full card">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle size={22} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-display text-[1.3rem] text-[var(--ink)]">Account scheduled for deletion</p>
            <p className="text-[13px] text-[var(--ink-faint)]">{businessName}</p>
          </div>
        </div>

        <p className="text-[14px] text-[var(--ink-soft)] mb-1">
          This account will be permanently deleted -- quotes, clients, price book, everything -- on{" "}
          <strong>{fmtDate(purgeDateIso)}</strong>.
        </p>
        <p className="text-[13px] text-[var(--ink-faint)] mb-5">
          Until then, nothing has been removed. Restore your account to pick up right where you left off.
        </p>

        {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}

        <div className="flex flex-col gap-2">
          <button onClick={handleRestore} disabled={restoring} className="btn-primary">
            {restoring ? "Restoring..." : "Restore my account"}
          </button>
          <button
            onClick={handleSignOut}
            className="text-[13px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
