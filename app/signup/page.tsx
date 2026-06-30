"use client";

import { Suspense, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Timer,
  DollarSign,
  Search,
  Shield,
  CreditCard,
  X,
  Check,
  Mail,
  ArrowRight,
  Sparkles,
  Users,
} from "lucide-react";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

/* ------------------------------------------------------------------ */
/*  Password strength helper                                           */
/* ------------------------------------------------------------------ */
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels = [
    { label: "Too short", color: "#dc2626" },
    { label: "Weak", color: "#dc2626" },
    { label: "Fair", color: "#e89e00" },
    { label: "Good", color: "#16a34a" },
    { label: "Strong", color: "#16a34a" },
  ];
  return { score, label: levels[score].label, color: levels[score].color };
}

/* ------------------------------------------------------------------ */
/*  Feature card (right side)                                          */
/* ------------------------------------------------------------------ */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <div
      className="reveal flex items-start gap-4 rounded-xl p-4 transition-all duration-200 hover:bg-white/5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(255,180,0,0.15)" }}
      >
        <Icon size={20} style={{ color: "var(--amber)" }} />
      </div>
      <div>
        <h3 className="font-bold text-[14px] text-white mb-1">{title}</h3>
        <p className="text-[12.5px] leading-relaxed text-[#8b96a1]">{desc}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trust badge                                                        */
/* ------------------------------------------------------------------ */
function TrustBadge({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#8b96a1]">
      <Icon size={13} style={{ color: "var(--amber)" }} />
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Right panel (feature preview)                                      */
/* ------------------------------------------------------------------ */
function SignupRightPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-center overflow-hidden bg-[#0a1722] px-12 xl:px-20">
      {/* Gradient orbs */}
      <style>{`\n        @keyframes orb-float-1 {\n          0%, 100% { transform: translate(0, 0) scale(1); }\n          33% { transform: translate(30px, -20px) scale(1.05); }\n          66% { transform: translate(-20px, 15px) scale(0.95); }\n        }\n        @keyframes orb-float-2 {\n          0%, 100% { transform: translate(0, 0) scale(1); }\n          33% { transform: translate(-25px, 20px) scale(0.95); }\n          66% { transform: translate(20px, -15px) scale(1.05); }\n        }\n        @keyframes orb-float-3 {\n          0%, 100% { transform: translate(0, 0) scale(1); }\n          50% { transform: translate(15px, -25px) scale(1.08); }\n        }\n      `}</style>
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.20) 0%, transparent 65%)",
          top: "-15%",
          left: "-10%",
          animation: "orb-float-1 10s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-[450px] h-[450px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)",
          top: "10%",
          right: "-15%",
          animation: "orb-float-2 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.10) 0%, transparent 60%)",
          bottom: "-5%",
          left: "30%",
          animation: "orb-float-3 9s ease-in-out infinite",
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
      <div className="relative z-10">
        <div className="reveal flex items-center gap-2 mb-5">
          <Sparkles size={14} style={{ color: "var(--amber)" }} />
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[var(--amber)]">
            Swiftscope for Tradies
          </span>
        </div>

        <h2 className="reveal font-display text-[2.4rem] xl:text-[2.8rem] text-white leading-[1.05] mb-4">
          Join 200+ tradies already winning more jobs
        </h2>
        <p className="reveal text-[14px] text-[#8b96a1] leading-relaxed mb-8 max-w-md">
          The quoting platform built for Australian electricians, plumbers,
          builders, and more. Fast, simple, and made for life on the tools.
        </p>

        {/* Feature cards */}
        <div className="space-y-3 mb-8">
          <FeatureCard
            icon={Timer}
            title="Quote in under 4 minutes"
            desc="Build and send professional quotes from your phone on site"
            delay={100}
          />
          <FeatureCard
            icon={DollarSign}
            title="$45/month flat"
            desc="No per-user fees. Unlimited quotes, unlimited team members"
            delay={200}
          />
          <FeatureCard
            icon={Search}
            title="Get found by homeowners"
            desc="Listed in our directory. Homeowners request quotes directly"
            delay={300}
          />
        </div>

        {/* Social proof */}
        <div
          className="reveal flex items-start gap-3 rounded-xl px-4 py-3 mb-8"
          style={{
            background: "rgba(255,180,0,0.08)",
            border: "1px solid rgba(255,180,0,0.15)",
          }}
        >
          <span className="text-lg shrink-0">
            <Check size={18} style={{ color: "var(--amber)" }} />
          </span>
          <p className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--amber)" }}>
            Most tradies send their first quote within 10 minutes of signing up.
          </p>
        </div>

        {/* Trust badges */}
        <div className="reveal flex flex-wrap gap-x-5 gap-y-2 mb-8">
          <TrustBadge icon={Shield} text="Secure SSL encryption" />
          <TrustBadge icon={CreditCard} text="No credit card required" />
          <TrustBadge icon={X} text="Cancel anytime" />
        </div>

        {/* Pricing footer */}
        <p className="reveal text-[13px] font-semibold text-[#8b96a1]">
          <span className="text-white">3-day free trial</span> - then just{" "}
          <span style={{ color: "var(--amber)" }}>$45/month</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile teaser (shown above form on small screens)                  */
/* ------------------------------------------------------------------ */
function MobileTeaser() {
  return (
    <div className="lg:hidden bg-[#0a1722] px-6 pt-10 pb-8 relative overflow-hidden">
      <div
        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.18) 0%, transparent 65%)",
          top: "-30%",
          right: "-10%",
        }}
      />
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles size={12} style={{ color: "var(--amber)" }} />
          <span className="text-[10px] font-bold tracking-[.2em] uppercase text-[var(--amber)]">
            Swiftscope for Tradies
          </span>
        </div>
        <h2 className="font-display text-[1.8rem] text-white leading-tight mb-2">
          Join 200+ tradies winning more jobs
        </h2>
        <p className="text-[12.5px] text-[#8b96a1] mb-4">
          3-day free trial - then $45/month flat
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-[#8b96a1]">
          <span className="flex items-center gap-1">
            <Shield size={11} style={{ color: "var(--amber)" }} /> No credit card
          </span>
          <span className="flex items-center gap-1">
            <X size={11} style={{ color: "var(--amber)" }} /> Cancel anytime
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main signup form                                                   */
/* ------------------------------------------------------------------ */
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { business_name: businessName },
          emailRedirectTo: next
            ? `${window.location.origin}${next}`
            : undefined,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        router.push(
          next && next.startsWith("/") ? next : "/onboarding"
        );
        router.refresh();
      } else {
        setCheckEmail(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reach the server."
      );
    } finally {
      setLoading(false);
    }
  }

  /* Password requirement checklist */
  const reqs = [
    { met: password.length >= 6, text: "At least 6 characters" },
    { met: /[a-zA-Z]/.test(password) && /[0-9]/.test(password), text: "Mix of letters and numbers" },
  ];

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
            {checkEmail ? (
              /* Check email state */
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--green-bg)", border: "1px solid #bbf7d0" }}
                >
                  <Mail size={24} style={{ color: "var(--green)" }} />
                </div>
                <h1 className="font-display text-[24px] text-[var(--ink)] mb-2">
                  Check your inbox
                </h1>
                <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-6">
                  We&apos;ve sent a confirmation link to{" "}
                  <strong className="text-[var(--ink)]">{email}</strong>. Click
                  it to verify your account, then log in.
                </p>
                <Link
                  href={
                    next
                      ? `/login?next=${encodeURIComponent(next)}`
                      : "/login"
                  }
                  className="btn-primary inline-flex justify-center"
                >
                  Go to login <ArrowRight size={16} />
                </Link>
                <p className="text-[12px] text-[var(--ink-faint)] mt-4">
                  Didn&apos;t get it? Check your spam folder.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm">
                  <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">
                    Create account
                  </h1>
                  <p className="text-[13.5px] text-[var(--ink-faint)] mb-6">
                    3-day free trial. $45/month after that. No credit card
                    needed.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Business name */}
                    <div>
                      <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                        Business name
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                        autoFocus
                        className="app-field"
                        placeholder="e.g. Smith Electrical Services"
                      />
                    </div>

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
                        className="app-field"
                        placeholder="you@example.com"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="app-field pr-16"
                          placeholder="At least 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--ink-faint)] hover:text-[var(--ink-soft)] transition-colors"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>

                      {/* Password strength bar */}
                      {password.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                              Strength
                            </span>
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: strength.color }}
                            >
                              {strength.label}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="h-1 flex-1 rounded-full transition-colors duration-200"
                                style={{
                                  background:
                                    i <= strength.score
                                      ? strength.color
                                      : "var(--line-subtle)",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Requirements checklist */}
                      <div className="mt-2 space-y-1">
                        {reqs.map((req) => (
                          <div
                            key={req.text}
                            className="flex items-center gap-1.5"
                          >
                            {req.met ? (
                              <Check
                                size={12}
                                style={{ color: "var(--green)" }}
                              />
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-[var(--line)]" />
                            )}
                            <span
                              className={`text-[11.5px] ${req.met ? "text-[var(--green)] font-semibold" : "text-[var(--ink-faint)]"}`}
                            >
                              {req.text}
                            </span>
                          </div>
                        ))}
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
                        "Creating account..."
                      ) : (
                        <>
                          Create account <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>

                  <p className="text-[13px] text-[var(--ink-faint)] mt-5 text-center">
                    Already have an account?{" "}
                    <Link
                      href={
                        next
                          ? `/login?next=${encodeURIComponent(next)}`
                          : "/login"
                      }
                      className="text-[var(--navy)] font-bold hover:underline"
                    >
                      Log in
                    </Link>
                  </p>
                </div>

                {/* Social proof + pricing (mobile/desktop shared) */}
                <div className="mt-4 flex items-start gap-3 bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3">
                  <span className="text-lg shrink-0">
                    <Users size={18} style={{ color: "var(--amber-deep)" }} />
                  </span>
                  <p className="text-[12.5px] text-[var(--amber-deep)] font-semibold leading-snug">
                    Most tradies send their first quote within 10 minutes of
                    signing up.
                  </p>
                </div>

                <p className="text-center text-[12px] text-[var(--ink-faint)] mt-4">
                  3 days free - $45/month - unlimited everything
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right side - feature preview (desktop only) */}
      <SignupRightPanel />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
