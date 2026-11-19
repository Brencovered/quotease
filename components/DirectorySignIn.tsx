"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";

/**
 * Sign-in for the listing editor (/directory/manage). A signed-out visitor
 * used to get a bare "Unauthorized" with only a Claim button, so someone
 * who had already claimed their page had no way back in from here.
 * Google goes through the directory auth callback, so a first-time Google
 * sign-in here is a directory login, never a SwiftScope trial.
 */
export default function DirectorySignIn({ next = "/directory/manage" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (err) { setError(err.message === "Invalid login credentials" ? "That email and password don't match." : err.message); return; }
      // Full navigation so the new session cookie is sent on the next request
      window.location.href = next;
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 rounded-2xl">
      <h1 className="font-display text-[1.6rem] text-[#0a1722] mb-1">Log in to manage your page</h1>
      <p className="text-[13.5px] text-[#5a6b78] mb-5">Use the login you made when you claimed your directory page.</p>

      <GoogleSignInButton next={next} label="Log in with Google" callbackPath="/api/directory/auth-callback" />
      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-[#e8ecef]" />
        <span className="text-[11.5px] font-semibold text-[#8a97a1] uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-[#e8ecef]" />
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="dir-email" className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
            <input id="dir-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com.au" className="app-field w-full pl-9" />
          </div>
        </div>
        <div>
          <label htmlFor="dir-password" className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
            <input id="dir-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="app-field w-full pl-9" />
          </div>
        </div>
        {error && <p role="alert" className="text-[13px] text-[var(--red)]">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <Link href="/login?reset=1" className="text-[#5a6b78] hover:underline">Forgot your password?</Link>
        <Link href="/directory/claim" className="font-semibold text-[#0a1722] hover:underline">Not claimed yet? Claim your page</Link>
      </div>
    </div>
  );
}
