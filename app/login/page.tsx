"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) { setError("Not connected to a database yet."); return; }
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); return; }
      router.push("/electrician/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      {/* Header strip */}
      <div className="bg-[var(--navy)] px-6 py-4">
        <Link href="/" className="font-display text-[15px] tracking-widest text-white">SWIFTSCOPE</Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm">
            <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">Welcome back</h1>
            <p className="text-[13.5px] text-[var(--ink-faint)] mb-6">Log in to your Swiftscope account</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoFocus className="app-field" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required className="app-field" placeholder="••••••••" />
              </div>
              {error && (
                <div className="bg-[var(--red-bg)] border border-red-200 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)] font-semibold">
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary mt-1">
                {loading ? "Logging in..." : "Log in →"}
              </button>
            </form>

            <p className="text-[13px] text-[var(--ink-faint)] mt-5 text-center">
              No account?{" "}
              <Link href="/signup" className="text-[var(--navy)] font-bold hover:underline">
                Start free trial
              </Link>
            </p>
          </div>

          {/* Trust */}
          <p className="text-center text-[12px] text-[var(--ink-faint)] mt-5">
            7-day free trial · $40/mo flat · cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
