"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

export default function SignupPage() {
  const router  = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [checkEmail,   setCheckEmail]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) { setError("Not connected to a database yet."); return; }
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: { data: { business_name: businessName } },
      });
      if (signUpError) { setError(signUpError.message); return; }
      if (data.session) { router.push("/onboarding"); router.refresh(); }
      else { setCheckEmail(true); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      <div className="bg-[var(--navy)] px-6 py-4">
        <Link href="/" className="font-display text-[15px] tracking-widest text-white">SWIFTSCOPE</Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {checkEmail ? (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--green-bg)] border border-green-200 flex items-center justify-center mx-auto mb-4 text-2xl">
                ✉️
              </div>
              <h1 className="font-display text-[24px] text-[var(--ink)] mb-2">Check your inbox</h1>
              <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-6">
                We&apos;ve sent a confirmation link to{" "}
                <strong className="text-[var(--ink)]">{email}</strong>.
                Click it to verify your account, then log in.
              </p>
              <Link href="/login" className="btn-primary inline-flex justify-center">
                Go to login →
              </Link>
              <p className="text-[12px] text-[var(--ink-faint)] mt-4">
                Didn&apos;t get it? Check your spam folder.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm">
                <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">Sign up free</h1>
                <p className="text-[13.5px] text-[var(--ink-faint)] mb-6">3-day free trial. $45/month after that. No credit card needed.</p>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Business name</label>
                    <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                      required autoFocus className="app-field" placeholder="e.g. Smith Electrical Services" />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      required className="app-field" placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      required minLength={6} className="app-field" placeholder="At least 6 characters" />
                  </div>
                  {error && (
                    <div className="bg-[var(--red-bg)] border border-red-200 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)] font-semibold">
                      {error}
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="btn-primary mt-1">
                    {loading ? "Creating account..." : "Create account →"}
                  </button>
                </form>

                <p className="text-[13px] text-[var(--ink-faint)] mt-5 text-center">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[var(--navy)] font-bold hover:underline">Log in</Link>
                </p>
              </div>

              <div className="mt-4 flex items-start gap-3 bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3">
                <span className="text-lg shrink-0">⚡</span>
                <p className="text-[12.5px] text-[var(--amber-deep)] font-semibold leading-snug">
                  Most tradies send their first quote within 10 minutes of signing up.
                </p>
              </div>

              <p className="text-center text-[12px] text-[var(--ink-faint)] mt-4">
                3 days free · $45/month · unlimited everything
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
