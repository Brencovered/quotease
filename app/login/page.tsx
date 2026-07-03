"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Timer,
  DollarSign,
  Users,
  ArrowRight,
  Sparkles,
  Mail,
  Lock,
  X,
  Loader2,
  CheckCircle2,
  Zap,
} from "lucide-react";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

/* ------------------------------------------------------------------ */
/*  Feature item (right side)                                          */
/* ------------------------------------------------------------------ */
function FeatureItem({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[13.5px] font-semibold text-[#8b96a1]">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,180,0,0.12)" }}
      >
        <Icon size={16} style={{ color: "var(--amber)" }} />
      </div>
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Password reset modal                                               */
/* ------------------------------------------------------------------ */
function ResetPasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setResetError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        setResetError(error.message);
      } else {
        setResetSent(true);
      }
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Could not send reset link."
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-xl w-full max-w-sm">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
        >
          <X size={18} />
        </button>

        {resetSent ? (
          <div className="text-center py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--green-bg)", border: "1px solid #bbf7d0" }}
            >
              <CheckCircle2 size={24} style={{ color: "var(--green)" }} />
            </div>
            <h3 className="font-display text-[20px] text-[var(--ink)] mb-2">
              Check your inbox
            </h3>
            <p className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">
              We&apos;ve sent a password reset link to{" "}
              <strong className="text-[var(--ink)]">{resetEmail}</strong>. Click
              the link to reset your password.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Lock size={16} style={{ color: "var(--amber)" }} />
              <h3 className="font-display text-[20px] text-[var(--ink)]">
                Reset password
              </h3>
            </div>
            <p className="text-[13px] text-[var(--ink-faint)] mb-5">
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </p>

            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoFocus
                  className="app-field"
                  placeholder="you@example.com"
                />
              </div>

              {resetError && (
                <div className="bg-[var(--red-bg)] border border-red-200 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)] font-semibold">
                  {resetError}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="btn-primary"
              >
                {resetLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send reset link <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Right panel (teaser)                                               */
/* ------------------------------------------------------------------ */
function LoginRightPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-center overflow-hidden bg-[#0a1722] px-12 xl:px-20">
      {/* Gradient orbs */}
      <style>{`\n        @keyframes orb-float-1 {\n          0%, 100% { transform: translate(0, 0) scale(1); }\n          33% { transform: translate(30px, -20px) scale(1.05); }\n          66% { transform: translate(-20px, 15px) scale(0.95); }\n        }\n        @keyframes orb-float-2 {\n          0%, 100% { transform: translate(0, 0) scale(1); }\n          33% { transform: translate(-25px, 20px) scale(0.95); }\n          66% { transform: translate(20px, -15px) scale(1.05); }\n        }\n      `}</style>
      <div
        className="absolute w-[450px] h-[450px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.18) 0%, transparent 65%)",
          top: "-10%",
          right: "-10%",
          animation: "orb-float-1 10s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 65%)",
          bottom: "-5%",
          left: "20%",
          animation: "orb-float-2 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-md">
        <div className="reveal flex items-center gap-2 mb-5">
          <Sparkles size={14} style={{ color: "var(--amber)" }} />
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[var(--amber)]">
            Swiftscope
          </span>
        </div>

        <h2 className="reveal font-display text-[2.4rem] xl:text-[2.8rem] text-white leading-[1.05] mb-4">
          Back to winning more jobs
        </h2>
        <p className="reveal text-[14px] text-[#8b96a1] leading-relaxed mb-8">
          Log in to send quotes, manage your pipeline, and grow your tradie
          business.
        </p>

        {/* Quick features */}
        <div className="reveal space-y-3 mb-10">
          <FeatureItem
            icon={Timer}
            text="Quote in under 4 minutes"
          />
          <FeatureItem
            icon={DollarSign}
            text="$45/month flat - unlimited everything"
          />
          <FeatureItem
            icon={Users}
            text="200+ active tradies on the platform"
          />
        </div>

        {/* Stat highlight */}
        <div
          className="reveal inline-flex items-center gap-3 rounded-xl px-5 py-3"
          style={{
            background: "rgba(255,180,0,0.08)",
            border: "1px solid rgba(255,180,0,0.15)",
          }}
        >
          <Zap size={18} style={{ color: "var(--amber)" }} />
          <span className="text-[13px] font-bold" style={{ color: "var(--amber)" }}>
            200+ active tradies
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile teaser                                                      */
/* ------------------------------------------------------------------ */
function MobileTeaser() {
  return (
    <div className="lg:hidden bg-[#0a1722] px-6 pt-10 pb-8 relative overflow-hidden">
      <div
        className="absolute w-[250px] h-[250px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.15) 0%, transparent 65%)",
          top: "-40%",
          right: "-10%",
        }}
      />
      <div className="relative z-10 text-center">
        <h2 className="font-display text-[1.6rem] text-white leading-tight mb-2">
          Welcome back
        </h2>
        <p className="text-[12.5px] text-[#8b96a1]">
          Log in to your Swiftscope account
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main login form                                                    */
/* ------------------------------------------------------------------ */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) {
      setError("Not connected to a database yet.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      router.push(
        next && next.startsWith("/") ? next : "/electrician/dashboard"
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reach the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col lg:flex-row">
      {/* Mobile teaser */}
      <MobileTeaser />

      {/* Left side - form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[var(--navy)] px-6 py-4">
          <Link
            href="/"
            className="font-display text-[15px] tracking-widest text-white"
          >
            SWIFTSCOPE
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-10 lg:py-12">
          <div className="w-full max-w-sm">
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm">
              <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">
                Welcome back
              </h1>
              <p className="text-[13.5px] text-[var(--ink-faint)] mb-6">
                Log in to your Swiftscope account
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="app-field"
                    placeholder="you@example.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-[11.5px] font-bold text-[var(--navy)] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="app-field pr-16"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--ink-faint)] hover:text-[var(--ink-soft)] transition-colors"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-[var(--red-bg)] border border-red-200 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)] font-semibold">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-1"
                >
                  {loading ? (
                    "Logging in..."
                  ) : (
                    <>
                      Log in <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <p className="text-[13px] text-[var(--ink-faint)] mt-5 text-center">
                No account?{" "}
                <Link
                  href="/signup"
                  className="text-[var(--navy)] font-bold hover:underline"
                >
                  Start free trial
                </Link>
              </p>
            </div>

            {/* Trust line */}
            <p className="text-center text-[12px] text-[var(--ink-faint)] mt-5">
              3-day free trial - $45/mo flat - cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* Right side - teaser (desktop only) */}
      <LoginRightPanel />

      {/* Password reset modal */}
      {showResetModal && (
        <ResetPasswordModal onClose={() => setShowResetModal(false)} />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        /* Server-rendered while the client form hydrates. Without this the
           initial HTML was completely empty (fallback={null}) -- crawlers
           saw no h1 and no content at all. */
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">Welcome back</h1>
            <p className="text-[13.5px] text-[var(--ink-faint)]">Log in to your Swiftscope account</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
