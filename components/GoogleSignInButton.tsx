"use client";

/**
 * components/GoogleSignInButton.tsx
 * -----------------------------------
 * Used on both /login and /signup. Either way it's the same OAuth call --
 * Supabase/Google don't distinguish "signing up" from "logging in", a
 * Google account either already has a matching Supabase user or it
 * doesn't, and app/auth/callback/route.ts (already handles the
 * email-confirmation flow too) decides where to send them afterward:
 * brand new or never-finished-onboarding -> /onboarding, otherwise
 * -> /dashboard (or `next`, if one was passed through).
 *
 * redirectTo has to be an absolute URL pointing at our own callback route
 * (not Google's) -- Supabase's OAuth flow is: browser -> Google ->
 * Supabase's own /auth/v1/callback (the one shown in the Supabase
 * dashboard) -> back to whatever redirectTo says, with a `code` param
 * for this app's /auth/callback to exchange for a session.
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.97v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.97A9 9 0 0 0 0 9c0 1.45.35 2.83.97 4.05l3-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .97 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

export default function GoogleSignInButton({ next, label = "Continue with Google" }: { next?: string | null; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (next && next.startsWith("/")) redirectTo.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
      // On success the browser navigates to Google -- nothing else to do
      // here, and there's nothing left to render once that redirect fires.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Google.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[var(--line)] bg-white py-2.5 text-[13.5px] font-bold text-[var(--ink)] hover:bg-[var(--app-bg)] transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <GoogleLogo />}
        {loading ? "Redirecting..." : label}
      </button>
      {error && (
        <p className="text-[12px] text-[var(--red)] font-semibold mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
