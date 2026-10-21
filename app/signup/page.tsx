"use client";

import { useEffect, useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { PRODUCT_TRADES } from "@/lib/genericTrades";
import {
  Timer, DollarSign, Search, Shield, X, Check, Mail,
  ArrowRight, Sparkles, Users, MapPin, Briefcase,
} from "lucide-react";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

const TRADES = PRODUCT_TRADES;

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
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

function FeatureCard({ icon: Icon, title, desc, delay }: { icon: React.ElementType; title: string; desc: string; delay: number }) {
  return (
    <div
      className="reveal flex items-start gap-4 rounded-xl p-4 transition-all duration-200 hover:bg-white/5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", animationDelay: `${delay}ms` }}
    >
      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,180,0,0.15)" }}>
        <Icon size={20} style={{ color: "var(--amber)" }} />
      </div>
      <div>
        <h3 className="font-bold text-[14px] text-white mb-1">{title}</h3>
        <p className="text-[12.5px] leading-relaxed text-[#8b96a1]">{desc}</p>
      </div>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-[12.5px] font-semibold text-[var(--red)] mt-1.5">
      {children}
    </p>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TrustBadge({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#8b96a1]">
      <Icon size={13} style={{ color: "var(--amber)" }} /> {text}
    </div>
  );
}

function SignupRightPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-center overflow-hidden bg-[#1a242c] px-12 xl:px-20">
      <style>{`
        @keyframes orb-float-1 { 0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(30px,-20px)scale(1.05)}66%{transform:translate(-20px,15px)scale(0.95)} }
        @keyframes orb-float-2 { 0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(-25px,20px)scale(0.95)}66%{transform:translate(20px,-15px)scale(1.05)} }
        @keyframes orb-float-3 { 0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(15px,-25px)scale(1.08)} }
      `}</style>
      <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,0,0.20) 0%, transparent 65%)", top: "-15%", left: "-10%", animation: "orb-float-1 10s ease-in-out infinite" }} />
      <div className="absolute w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)", top: "10%", right: "-15%", animation: "orb-float-2 12s ease-in-out infinite" }} />
      <div className="absolute w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,0,0.10) 0%, transparent 60%)", bottom: "-5%", left: "30%", animation: "orb-float-3 9s ease-in-out infinite" }} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative z-10">
        <div className="reveal flex items-center gap-2 mb-5">
          <Sparkles size={14} style={{ color: "var(--amber)" }} />
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[var(--amber)]">SwiftScope for Tradies</span>
        </div>

        <h2 className="reveal font-display text-[2.4rem] xl:text-[2.8rem] text-white leading-[1.05] mb-4">
          Win more jobs from the driveway
        </h2>
        <p className="reveal text-[14px] text-[#8b96a1] leading-relaxed mb-8 max-w-md">
          The quoting platform built for Australian electricians, plumbers, builders, and more. Fast, simple, and made for life on the tools.
        </p>

        <div className="space-y-3 mb-8">
          <FeatureCard icon={Timer} title="Quote in under 4 minutes" desc="Build and send professional quotes from your phone on site" delay={100} />
          <FeatureCard icon={DollarSign} title="$45/month flat" desc="No per-user fees. Unlimited quotes, unlimited team members" delay={200} />
          <FeatureCard icon={Search} title="Get found by homeowners" desc="Listed in our directory. Homeowners request quotes directly" delay={300} />
        </div>

        <div className="reveal flex items-start gap-3 rounded-xl px-4 py-3 mb-8" style={{ background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.15)" }}>
          <Check size={18} style={{ color: "var(--amber)" }} className="shrink-0" />
          <p className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--amber)" }}>
            Most tradies send their first quote within 10 minutes of signing up.
          </p>
        </div>

        <div className="reveal flex flex-wrap gap-x-5 gap-y-2 mb-8">
          <TrustBadge icon={Shield} text="Secure SSL encryption" />
          <TrustBadge icon={X} text="No credit card required" />
          <TrustBadge icon={X} text="Cancel anytime" />
        </div>

        <p className="reveal text-[13px] font-semibold text-[#8b96a1]">
          <span className="text-white">7-day free trial</span> - then just <span style={{ color: "var(--amber)" }}>$45/month</span>
        </p>
      </div>
    </div>
  );
}

function MobileTeaser() {
  return (
    <div className="lg:hidden bg-[#1a242c] px-6 pt-10 pb-8 relative overflow-hidden">
      <div className="absolute w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,0,0.18) 0%, transparent 65%)", top: "-30%", right: "-10%" }} />
      <div className="relative z-10 text-center">
        <span className="text-[10px] font-bold tracking-[.2em] uppercase text-[var(--amber)]">SwiftScope for Tradies</span>
        <h2 className="font-display text-[1.8rem] text-white leading-tight mt-2 mb-2">Win more jobs from the driveway</h2>
        <p className="text-[12.5px] text-[#8b96a1] mb-4">7-day free trial - then $45/month flat</p>
        <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-[#8b96a1]">
          <span className="flex items-center gap-1"><Shield size={11} style={{ color: "var(--amber)" }} /> No credit card</span>
          <span className="flex items-center gap-1"><X size={11} style={{ color: "var(--amber)" }} /> Cancel anytime</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main signup form                                                   */
/* ------------------------------------------------------------------ */
function SignupForm() {
  // Read the query string after mount. useSearchParams() bails the whole
  // page out of server rendering, so the HTML response was only the
  // suspense fallback: no form, no novalidate, no label ids. The browser
  // then applied native email validation to whatever form hydrated later.
  const [next, setNext] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [suburb, setSuburb] = useState("");
  const [trade, setTrade] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedNext = params.get("next");
    if (requestedNext && requestedNext.startsWith("/")) setNext(requestedNext);
    const requestedTrade = params.get("trade");
    if (requestedTrade && TRADES.some((t) => t.key === requestedTrade)) {
      setTrade(requestedTrade);
    }
  }, []);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    email?: string;
    suburb?: string;
    trade?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  function clearField(key: keyof typeof fieldErrors) {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (!businessName.trim()) nextErrors.businessName = "Enter your business name.";
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!suburb.trim()) nextErrors.suburb = "Enter the suburb you work in.";
    if (!trade) nextErrors.trade = "Select your trade.";
    if (!password) nextErrors.password = "Enter a password.";
    else if (password.length < 6) nextErrors.password = "Password must be at least 6 characters.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!SUPABASE_CONFIGURED) { setError("Not connected to a database yet."); return; }
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { business_name: businessName, suburb, trade },
          emailRedirectTo: next ? `${window.location.origin}${next}` : `${window.location.origin}/onboarding`,
        },
      });
      if (signUpError) { setError(signUpError.message); return; }
      if (data.session) {
        await supabase.from("profiles").update({
          business_name: businessName.trim(),
          suburb: suburb.trim() || null,
          trades: [trade],
        }).eq("id", data.session.user.id);
        // Best-effort - this signup path never redirects through
        // /auth/callback (which logs it inline for OAuth/email-confirm
        // signups instead), so this is the only place this particular
        // path gets captured. Not awaited for the error case - a
        // logging failure should never block someone from finishing
        // signup.
        fetch("/api/account/log-signup-ip", { method: "POST" }).catch(() => {});
        // Full navigation (not router.push) so the session cookie set by
        // signUp is guaranteed present when middleware checks it on the
        // very next request - same fix as the login page.
        window.location.href = "/onboarding";
      } else {
        setCheckEmail(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const reqs = [
    { met: password.length >= 6, text: "At least 6 characters" },
    { met: /[a-zA-Z]/.test(password) && /[0-9]/.test(password), text: "Mix of letters and numbers" },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col lg:flex-row">
      <MobileTeaser />

      <div className="flex-1 flex flex-col">
        <div className="bg-[var(--navy)] px-6 py-4">
          <Link href="/" className="font-display text-[15px] tracking-widest text-white">SwiftScope</Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-10 lg:py-12">
          <div className="w-full max-w-sm">
            {checkEmail ? (
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--green-bg)", border: "1px solid #bbf7d0" }}>
                  <Mail size={24} style={{ color: "var(--green)" }} />
                </div>
                <h1 className="font-display text-[24px] text-[var(--ink)] mb-2">Check your inbox</h1>
                <p className="text-[14px] text-[var(--ink-soft)] leading-[1.6] mb-6">
                  We&apos;ve sent a confirmation link to <strong className="text-[var(--ink)]">{email}</strong>. Click it to verify your account, then log in.
                </p>
                <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="btn-primary inline-flex justify-center">
                  Go to login <ArrowRight size={16} />
                </Link>
                <p className="text-[12px] text-[var(--ink-faint)] mt-4">Didn&apos;t get it? Check your spam folder.</p>
              </div>
            ) : (
              <>
                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-8 shadow-sm">
                  <h1 className="font-display text-[26px] text-[var(--ink)] mb-1">Create your account</h1>
                  <p className="text-[13.5px] text-[var(--ink-faint)] mb-6">7-day free trial. $45/month after that.</p>

                  <GoogleSignInButton next={next} label="Sign up with Google" />

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-[var(--line)]" />
                    <span className="text-[11.5px] font-bold uppercase text-[var(--ink-faint)]">or</span>
                    <div className="flex-1 h-px bg-[var(--line)]" />
                  </div>

                  <form onSubmit={handleSubmit} noValidate className="space-y-3">
                    {/* Business name */}
                    <div>
                      <label htmlFor="signup-business-name" className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Business name</label>
                      <input id="signup-business-name" type="text" value={businessName} onChange={(e) => { setBusinessName(e.target.value); clearField("businessName"); }} autoFocus
                        autoComplete="organization" aria-invalid={!!fieldErrors.businessName} aria-describedby={fieldErrors.businessName ? "signup-business-name-error" : undefined}
                        className="app-field" placeholder="e.g. Smith Electrical Services" />
                      <FieldError id="signup-business-name-error">{fieldErrors.businessName}</FieldError>
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="signup-email" className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Email</label>
                      <input id="signup-email" type="text" value={email} onChange={(e) => { setEmail(e.target.value); clearField("email"); }}
                        autoComplete="email" inputMode="email" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
                        className="app-field" placeholder="you@example.com" />
                      <FieldError id="signup-email-error">{fieldErrors.email}</FieldError>
                    </div>

                    {/* Suburb */}
                    <div>
                      <label htmlFor="signup-suburb" className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                        <MapPin size={12} className="inline mr-0.5" aria-hidden />Primary suburb you work in
                      </label>
                      <input
                        id="signup-suburb"
                        type="text"
                        value={suburb}
                        onChange={(e) => { setSuburb(e.target.value); clearField("suburb"); }}
                        autoComplete="address-level2"
                        spellCheck={false}
                        aria-invalid={!!fieldErrors.suburb}
                        aria-describedby={fieldErrors.suburb ? "signup-suburb-error" : "signup-suburb-hint"}
                        className="app-field"
                        placeholder="e.g. Marrickville, NSW"
                      />
                      <p id="signup-suburb-hint" className="text-[11.5px] text-[var(--ink-faint)] mt-1.5">
                        Suburb and state. Your phone may suggest Australian places as you type.
                      </p>
                      <FieldError id="signup-suburb-error">{fieldErrors.suburb}</FieldError>
                    </div>

                    {/* Trade */}
                    <div>
                      <label htmlFor="signup-trade" className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">
                        <Briefcase size={12} className="inline mr-0.5" aria-hidden />Your trade
                      </label>
                      <select id="signup-trade" value={trade} onChange={(e) => { setTrade(e.target.value); clearField("trade"); }}
                        aria-invalid={!!fieldErrors.trade} aria-describedby={fieldErrors.trade ? "signup-trade-error" : undefined}
                        className="app-field w-full">
                        <option value="">Select your trade...</option>
                        {TRADES.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                      <FieldError id="signup-trade-error">{fieldErrors.trade}</FieldError>
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="signup-password" className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Password</label>
                      <div className="relative">
                        <input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); clearField("password"); }}
                          autoComplete="new-password" aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? "signup-password-error" : undefined} className="app-field pr-16" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[52px] px-3 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <FieldError id="signup-password-error">{fieldErrors.password}</FieldError>

                      {password.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-[var(--ink-faint)]">Strength</span>
                            <span className="text-[11px] font-bold" style={{ color: strength.color }}>{strength.label}</span>
                          </div>
                          <div className="flex gap-1">
                            {[1,2,3,4].map((i) => (
                              <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-200" style={{ background: i <= strength.score ? strength.color : "var(--line-subtle)" }} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 space-y-1">
                        {reqs.map((req) => (
                          <div key={req.text} className="flex items-center gap-1.5">
                            {req.met ? <Check size={12} style={{ color: "var(--green)" }} /> : <div className="w-3 h-3 rounded-full border border-[var(--line)]" />}
                            <span className={`text-[11.5px] ${req.met ? "text-[var(--green)] font-semibold" : "text-[var(--ink-faint)]"}`}>{req.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="bg-[var(--red-bg)] border border-red-200 rounded-lg px-3 py-2.5 text-[13px] text-[var(--red)] font-semibold">{error}</div>
                    )}

                    <p className="text-[12px] text-[var(--ink-faint)] leading-snug">
                      By creating an account, you agree to our{" "}
                      <Link href="/terms" target="_blank" className="text-[var(--navy)] font-semibold hover:underline">Terms of Use</Link>{" "}
                      and{" "}
                      <Link href="/privacy" target="_blank" className="text-[var(--navy)] font-semibold hover:underline">Privacy Policy</Link>.
                    </p>

                    <button type="submit" formNoValidate disabled={loading} className="btn-primary mt-1">
                      {loading ? "Creating account..." : <>Create account <ArrowRight size={16} /></>}
                    </button>
                  </form>

                  <p className="text-[13px] text-[var(--ink-faint)] mt-5 text-center">
                    Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-[var(--navy)] font-bold hover:underline">Log in</Link>
                  </p>
                </div>

                <div className="mt-4 flex items-start gap-3 bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3">
                  <Users size={18} style={{ color: "var(--amber-deep)" }} className="shrink-0" />
                  <p className="text-[12.5px] text-[var(--amber-deep)] font-semibold leading-snug">
                    Most tradies send their first quote within 10 minutes of signing up.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <SignupRightPanel />
    </div>
  );
}

export default function SignupPage() {
  return <SignupForm />;
}
