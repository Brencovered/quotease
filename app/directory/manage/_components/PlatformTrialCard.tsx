"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * A directory login only manages the free listing (profiles.account_type
 * = 'directory'). This is the one place it can opt in to the SwiftScope
 * app: starting the 7-day trial turns it into a platform account and
 * sends it through onboarding. Shown to directory accounts only.
 */
export default function PlatformTrialCard() {
  const [show, setShow] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
        setShow(data?.account_type === "directory");
      } catch {
        setShow(false);
      }
    })();
  }, []);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/start-trial", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { window.location.href = "/onboarding"; return; }
      setError(typeof d.error === "string" ? d.error : "Couldn't start the trial. Try again or email team@swiftscope.com.au.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  if (!show) return null;
  return (
    <div className="card p-6 rounded-2xl mt-6">
      <p className="text-[15px] font-semibold text-[#0a1722] mb-1">Want quoting, jobs and invoicing too?</p>
      <p className="text-[13.5px] text-[#5a6b78] mb-4">
        Your listing stays free either way. SwiftScope is $45 a month for the full app. Try it free for 7 days, no credit card.
      </p>
      <button onClick={start} disabled={starting} className="btn-secondary w-full flex items-center justify-center gap-2">
        {starting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {starting ? "Starting..." : "Start my 7-day free trial"}
      </button>
      {error && <p className="text-[13px] text-[var(--red)] mt-3">{error}</p>}
    </div>
  );
}
