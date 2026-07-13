"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, Download, SkipForward, ArrowRight, ArrowLeft,
  Check, Package, Monitor, Smartphone, ClipboardList,
  HardHat, PenTool, FileText, Wrench, TrendingUp,
  Loader2, Sparkles, MapPin, AlertCircle, Users, FileUp,
  ExternalLink, X, Minus, Plus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Digital tools list                                                 */
/* ------------------------------------------------------------------ */

const DIGITAL_TOOLS = [
  { key: "fergus",      label: "Fergus",           icon: ClipboardList },
  { key: "servicem8",   label: "ServiceM8",        icon: Smartphone },
  { key: "hipages",     label: "HiPages",          icon: Search },
  { key: "groundplan",  label: "GroundPlan",       icon: PenTool },
  { key: "simpro",      label: "SimPro",           icon: Monitor },
  { key: "tradify",     label: "Tradify",          icon: FileText },
  { key: "excel",       label: "Excel / Spreadsheets", icon: FileText },
  { key: "xero",        label: "Xero",             icon: TrendingUp },
  { key: "myob",        label: "MYOB",             icon: TrendingUp },
  { key: "none",        label: "Nothing yet - pen and paper", icon: PenTool },
];

function Search(props: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const QUOTE_FREQUENCY_OPTIONS = [
  { key: "daily",    label: "Daily",       desc: "I quote on nearly every job" },
  { key: "weekly",   label: "A few times a week", desc: "2-4 quotes per week" },
  { key: "monthly",  label: "A few times a month", desc: "1-4 quotes per month" },
  { key: "rarely",   label: "Rarely",      desc: "I do mostly quoted work or maintenance" },
];

const STEPS = [
  { n: 1, label: "Your area" },
  { n: 2, label: "Your team" },
  { n: 3, label: "Tools you use" },
  { n: 4, label: "Pricing" },
  { n: 5, label: "How you quote" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Step 2: Team size
  const [teamSize, setTeamSize] = useState<number>(1);

  // Step 4: Supplier CSV upload (one path within the pricing step)
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 4: Pricing setup -- which path the user picked, plus AI quote upload state
  const [pricingTab, setPricingTab] = useState<"quotes" | "csv" | "xero" | "later">("quotes");
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [extractedCount, setExtractedCount] = useState(0);

  // Step 3: Digital tools
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Step 5: Quote frequency
  const [quoteFrequency, setQuoteFrequency] = useState("");

  // Error handling
  const [error, setError] = useState<string | null>(null);

  // Suburb (pre-filled from profile if available)
  const [suburb, setSuburb] = useState("");

  // Prevent redirect loops
  const hasRedirected = useRef(false);

  // Load existing profile data on mount
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("suburb, digital_tools, quote_frequency, team_size").eq("id", user.id).single();
      if (profile?.suburb) setSuburb(profile.suburb);
      if (profile?.digital_tools) setSelectedTools(profile.digital_tools);
      if (profile?.quote_frequency) setQuoteFrequency(profile.quote_frequency);
      if (profile?.team_size) setTeamSize(profile.team_size);
    }
    loadProfile();
  }, []);

  // Auto-redirect after completion
  useEffect(() => {
    if (!completed) return;
    const timer = setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) { clearInterval(timer); router.push("/electrician/dashboard"); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [completed, router]);

  function toggleTool(key: string) {
    setSelectedTools((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  }

  function addQuoteFiles(files: FileList | null) {
    if (!files) return;
    const next = [...quoteFiles, ...Array.from(files)].slice(0, 5);
    setQuoteFiles(next);
    setExtractMessage(null);
  }

  function removeQuoteFile(index: number) {
    setQuoteFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleExtractPricing() {
    if (quoteFiles.length === 0) return;
    setExtracting(true);
    setExtractMessage(null);

    const formData = new FormData();
    quoteFiles.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/onboarding/extract-pricing", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setExtractMessage(data.error || "Extraction failed. Please try again, or skip this step.");
        setExtractedCount(0);
      } else if (data.imported === 0) {
        setExtractMessage(data.message || "No priced items found in those quotes -- you can still add pricing manually later.");
        setExtractedCount(0);
      } else {
        setExtractMessage(`Added ${data.imported} priced item${data.imported !== 1 ? "s" : ""} to your price book from ${quoteFiles.length} quote${quoteFiles.length !== 1 ? "s" : ""}.`);
        setExtractedCount(data.imported);
      }
    } catch {
      setExtractMessage("Network error. Please check your connection and try again.");
      setExtractedCount(0);
    } finally {
      setExtracting(false);
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setCsvMessage("Uploading...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("defaultSupplier", "CSV Import");

    try {
      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setCsvMessage(data.error || "Upload failed. Please check your CSV and try again.");
        setHasUploaded(false);
      } else {
        setHasUploaded(true);
        const parts: string[] = [];
        parts.push(`${file.name} uploaded successfully.`);
        if (data.imported > 0) parts.push(`${data.imported} item${data.imported !== 1 ? "s" : ""} added to your price book.`);
        if (data.skipped > 0) parts.push(`${data.skipped} row${data.skipped !== 1 ? "s" : ""} skipped.`);
        if (data.errors?.length > 0) {
          parts.push(`${data.errors.length} issue${data.errors.length !== 1 ? "s" : ""} found.`);
        }
        setCsvMessage(parts.join(" "));
      }
    } catch {
      setCsvMessage("Network error. Please check your connection and try again.");
      setHasUploaded(false);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function finish() {
    if (hasRedirected.current) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        setError("You appear to be signed out. Please sign in again.");
        return;
      }

      // Save onboarding responses to profile
      const updates: Record<string, unknown> = {
        onboarded_at: new Date().toISOString(),
        suburb: suburb.trim() || null,
        team_size: teamSize,
        digital_tools: selectedTools.length > 0 ? selectedTools : null,
        quote_frequency: quoteFrequency || null,
      };

      const { error: updateErr } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (updateErr) {
        console.error("[Onboarding] Profile update failed:", updateErr);
        setError(`Failed to save your profile: ${updateErr.message}. Please try again.`);
        setSaving(false);
        return;
      }

      // Auto-subscribe to leads for this trade + suburb (opt-out model)
      const { data: profile } = await supabase.from("profiles").select("trades").eq("id", user.id).single();
      const trades = profile?.trades ?? [];
      if (suburb.trim() && trades.length > 0) {
        const subs = trades.map((trade: string) => ({
          profile_id: user.id,
          trade: trade.toLowerCase(),
          suburb: suburb.trim(),
          is_active: true,
        }));
        // Upsert subscriptions — ignore conflicts
        await supabase.from("lead_subscriptions").upsert(subs, { onConflict: "profile_id,trade,suburb", ignoreDuplicates: false });
      }

      hasRedirected.current = true;
      setCompleted(true);
    } catch (err: any) {
      console.error("[Onboarding] Unexpected error:", err);
      setError(`Something went wrong: ${err?.message ?? "Unknown error"}. Please try again.`);
      setSaving(false);
    }
  }

  function handleContinue() {
    if (step < STEPS.length) {
      setStep((s) => s + 1);
      setCsvMessage(null);
      setError(null);
    } else {
      finish();
    }
  }

  function handleSkip() {
    if (step < STEPS.length) {
      setStep((s) => s + 1);
      setCsvMessage(null);
      setError(null);
    } else {
      finish();
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] flex flex-col items-center justify-center px-4">
        <style>{`
          @keyframes scaleIn { 0%{transform:scale(0);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1} }
          @keyframes fadeUp { 0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)} }
          .checkCircle { animation: scaleIn 0.5s ease-out forwards; }
          .fadeUp1 { animation: fadeUp 0.5s ease-out 0.4s both; }
          .fadeUp2 { animation: fadeUp 0.5s ease-out 0.6s both; }
        `}</style>

        <div className="checkCircle mb-6">
          <div className="w-20 h-20 rounded-full bg-[var(--amber-light)] border-2 border-[var(--amber)] flex items-center justify-center">
            <Check size={36} className="text-[var(--amber-deep)]" strokeWidth={3} />
          </div>
        </div>

        <h1 className="fadeUp1 font-display text-[32px] text-[var(--ink)] text-center mb-2">You&apos;re all set!</h1>
        <p className="fadeUp2 text-[15px] text-[var(--ink-soft)] text-center max-w-sm mb-8">
          Your profile is ready. Time to start quoting and winning more jobs.
        </p>

        <button
          onClick={() => router.push("/electrician/dashboard")}
          className="fadeUp2 btn-primary"
        >
          Go to dashboard <ArrowRight size={16} />
        </button>

        <p className="fadeUp2 text-[12px] text-[var(--ink-faint)] mt-4">
          Redirecting in {redirectCountdown}s...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col">
      <style>{`
        @keyframes stepEnter { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .stepEnter { animation: stepEnter 0.35s ease-out both; }
      `}</style>

      {/* Header */}
      <div className="bg-[var(--navy)] px-6 py-4 flex items-center justify-between shrink-0">
        <span className="font-display text-[15px] tracking-widest text-white">SWIFTSCOPE</span>
        <span className="text-[12px] text-[var(--steel-3)] font-semibold">Step {step} of {STEPS.length}</span>
        {error && (
          <div className="flex items-center gap-1.5 text-red-400 text-[12px] font-bold">
            <AlertCircle size={12} /> Error — see below
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="bg-[var(--navy)] px-6 pb-4 shrink-0">
        <div className="flex gap-2">
          {STEPS.map((s) => {
            const isActive = s.n === step;
            const isComplete = s.n < step;
            return (
              <div key={s.n} className="flex-1">
                <div className="relative h-2 rounded-full bg-white/15 overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isComplete || isActive ? "bg-[var(--amber)]" : "bg-transparent"}`}
                    style={{ width: isComplete ? "100%" : isActive ? "60%" : "0%" }} />
                </div>
                <p className={`text-[10px] font-bold mt-2 transition-colors ${isActive ? "text-[var(--amber)]" : isComplete ? "text-white/70" : "text-white/25"}`}>
                  {isComplete ? "Done" : s.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">

          {/* ── STEP 1: Service suburb ── */}
          {step === 1 && (
            <div className="stepEnter" key="step1">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--navy)] flex items-center justify-center">
                  <MapPin size={20} className="text-[var(--amber)]" />
                </div>
                <div>
                  <h1 className="font-display text-[26px] text-[var(--ink)]">Where do you work?</h1>
                  <p className="text-[13px] text-[var(--ink-faint)]">This helps us send you relevant leads</p>
                </div>
              </div>

              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                Enter the main suburb or area you service. Homeowners requesting quotes in this area will be matched to you automatically. You can always change this later in settings.
              </p>

              <div className="mb-6">
                <label className="block text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">
                  Primary service suburb
                </label>
                <input
                  type="text"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="e.g. Marrickville, Richmond, Bondi"
                  className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--navy)] focus:outline-none transition-colors"
                />
              </div>

              <TipBox icon={Sparkles}>
                Lead matching is automatic — every tradie receives leads for their trade and suburb by default. You can opt out anytime in settings.
              </TipBox>
            </div>
          )}

          {/* ── STEP 2: Upload supplier pricing ── */}
          {step === 2 && (
            <div className="stepEnter" key="step2">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--navy)] flex items-center justify-center">
                  <Users size={20} className="text-[var(--amber)]" />
                </div>
                <div>
                  <h1 className="font-display text-[26px] text-[var(--ink)]">How big is your team?</h1>
                  <p className="text-[13px] text-[var(--ink-faint)]">Just you, or a full crew?</p>
                </div>
              </div>

              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                Including yourself. This just helps us understand who&apos;s using Swiftscope -- you can invite your team anytime later from Settings.
              </p>

              <div className="flex items-center justify-center gap-6 mb-6">
                <button
                  onClick={() => setTeamSize((n) => Math.max(1, n - 1))}
                  className="w-12 h-12 rounded-full border-2 border-[var(--line)] flex items-center justify-center hover:border-[var(--navy)]/40 transition-colors"
                  aria-label="Decrease"
                >
                  <Minus size={18} className="text-[var(--ink)]" />
                </button>
                <div className="text-center min-w-[80px]">
                  <p className="font-display text-[40px] text-[var(--ink)] leading-none">{teamSize}</p>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1">{teamSize === 1 ? "just me" : "people"}</p>
                </div>
                <button
                  onClick={() => setTeamSize((n) => Math.min(50, n + 1))}
                  className="w-12 h-12 rounded-full border-2 border-[var(--line)] flex items-center justify-center hover:border-[var(--navy)]/40 transition-colors"
                  aria-label="Increase"
                >
                  <Plus size={18} className="text-[var(--ink)]" />
                </button>
              </div>

              <TipBox icon={Sparkles}>
                Swiftscope is $45/month flat, unlimited users -- no per-seat pricing whether it&apos;s just you or a crew of ten.
              </TipBox>
            </div>
          )}

          {/* ── STEP 3: Digital tools ── */}
          {step === 3 && (
            <div className="stepEnter" key="step3">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--navy)] flex items-center justify-center">
                  <Monitor size={20} className="text-[var(--amber)]" />
                </div>
                <div>
                  <h1 className="font-display text-[26px] text-[var(--ink)]">What do you use to run your business?</h1>
                  <p className="text-[13px] text-[var(--ink-faint)]">Optional - select all that apply</p>
                </div>
              </div>

              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                This helps us tailor Swiftscope to replace the tools you&apos;re already paying for. Select everything you currently use.
              </p>

              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {DIGITAL_TOOLS.map((tool) => {
                  const on = selectedTools.includes(tool.key);
                  return (
                    <button key={tool.key} onClick={() => toggleTool(tool.key)}
                      className={`flex items-center gap-2.5 text-left rounded-xl border-2 px-3.5 py-3 transition-all ${
                        on ? "border-[var(--navy)] bg-[var(--navy)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--navy)]/40"
                      }`}>
                      <tool.icon size={16} className={on ? "text-[var(--amber)]" : "text-[var(--ink-faint)]"} />
                      <span className={`text-[12.5px] font-bold ${on ? "text-white" : "text-[var(--ink)]"}`}>{tool.label}</span>
                      {on && <Check size={12} className="text-[var(--amber)] ml-auto shrink-0" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>

              {selectedTools.length > 0 && (
                <p className="text-[12.5px] text-[var(--ink-faint)] text-center mb-4">
                  {selectedTools.length} tool{selectedTools.length !== 1 ? "s" : ""} selected
                </p>
              )}

              <TipBox icon={Sparkles}>
                Swiftscope replaces most of these at $45/month flat. No per-user fees, no per-lead costs, no separate drawing tool needed.
              </TipBox>
            </div>
          )}

          {/* ── STEP 4: How often do you quote from site? ── */}
          {/* ── STEP 4: Get your pricing set up ── */}
          {step === 4 && (
            <div className="stepEnter" key="step4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--navy)] flex items-center justify-center">
                  <Package size={20} className="text-[var(--amber)]" />
                </div>
                <div>
                  <h1 className="font-display text-[26px] text-[var(--ink)]">Get your pricing set up</h1>
                  <p className="text-[13px] text-[var(--ink-faint)]">Pick whichever&apos;s fastest for you -- all optional</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { key: "quotes" as const, label: "Upload past quotes", icon: FileUp, badge: "AI" },
                  { key: "csv" as const, label: "Supplier CSV", icon: Upload },
                  { key: "xero" as const, label: "Connect Xero", icon: TrendingUp },
                  { key: "later" as const, label: "I'll do this later", icon: SkipForward },
                ].map((tab) => {
                  const on = pricingTab === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setPricingTab(tab.key)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 font-semibold transition-all text-left ${
                        on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--navy)]/40"
                      }`}>
                      <tab.icon size={15} className={on ? "text-[var(--amber)]" : "text-[var(--ink-faint)]"} />
                      <span className="text-[12.5px] flex-1">{tab.label}</span>
                      {tab.badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${on ? "bg-[var(--amber)] text-[var(--navy)]" : "bg-[var(--amber-light)] text-[var(--amber-deep)]"}`}>{tab.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Upload past quotes (AI) */}
              {pricingTab === "quotes" && (
                <>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                    Upload 3-5 quotes you&apos;ve sent to customers before (PDF or photo). Our AI reads them and pulls the priced line items straight into your price book -- your own real pricing, not generic defaults.
                  </p>

                  <div className="border-2 border-dashed border-[var(--line)] rounded-2xl p-8 text-center mb-4 hover:border-[var(--amber)] hover:bg-[var(--amber-light)]/20 transition-all">
                    <FileUp size={32} className="text-[var(--ink-faint)] mx-auto mb-3" />
                    <p className="text-[14px] font-semibold text-[var(--ink)] mb-1">Drop your quotes here or click to browse</p>
                    <p className="text-[12px] text-[var(--ink-faint)] mb-4">PDF, JPG, PNG, or WebP -- up to 5 files</p>
                    <label className={`btn-primary inline-flex cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${quoteFiles.length >= 5 ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload size={14} /> Select files
                      <input type="file" accept=".pdf,image/*" multiple className="hidden"
                        onChange={(e) => { addQuoteFiles(e.target.files); e.target.value = ""; }}
                        disabled={quoteFiles.length >= 5} />
                    </label>
                  </div>

                  {quoteFiles.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {quoteFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-2">
                          <FileText size={13} className="text-[var(--ink-faint)] shrink-0" />
                          <span className="text-[12.5px] text-[var(--ink)] flex-1 truncate">{f.name}</span>
                          <button onClick={() => removeQuoteFile(i)} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {quoteFiles.length > 0 && (
                    <button onClick={handleExtractPricing} disabled={extracting}
                      className="btn-primary w-full mb-4 disabled:opacity-50">
                      {extracting ? <><Loader2 size={14} className="animate-spin" /> Reading your quotes...</> : <><Sparkles size={14} /> Extract pricing from {quoteFiles.length} quote{quoteFiles.length !== 1 ? "s" : ""}</>}
                    </button>
                  )}

                  {extractMessage && (
                    <div className={`rounded-xl px-4 py-3 mb-4 text-[13px] font-semibold ${extractedCount > 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-[var(--amber-light)] text-[var(--amber-deep)] border border-[var(--amber)]/20"}`}>
                      {extractMessage}
                    </div>
                  )}

                  <TipBox icon={Sparkles}>
                    Messier quotes are fine -- the AI skips anything it isn&apos;t confident about rather than guessing at a price.
                  </TipBox>
                </>
              )}

              {/* Upload supplier CSV */}
              {pricingTab === "csv" && (
                <>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                    If you have a supplier price list or materials list, upload it here and we&apos;ll add it straight to your price book.
                  </p>

                  <div className="border-2 border-dashed border-[var(--line)] rounded-2xl p-8 text-center mb-4 hover:border-[var(--amber)] hover:bg-[var(--amber-light)]/20 transition-all">
                    <Upload size={32} className="text-[var(--ink-faint)] mx-auto mb-3" />
                    <p className="text-[14px] font-semibold text-[var(--ink)] mb-1">Drop your CSV here or click to browse</p>
                    <p className="text-[12px] text-[var(--ink-faint)] mb-4">Xero, MYOB, or any CSV with item codes and prices</p>
                    <label className={`btn-primary inline-flex cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Select file</>}
                      <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={uploading} />
                    </label>
                  </div>

                  {csvMessage && (
                    <div className={`rounded-xl px-4 py-3 mb-4 text-[13px] font-semibold ${hasUploaded ? "bg-green-50 text-green-700 border border-green-200" : "bg-[var(--amber-light)] text-[var(--amber-deep)] border border-[var(--amber)]/20"}`}>
                      {csvMessage}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-6">
                    <button onClick={() => {}} className="text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink-soft)] font-semibold flex items-center gap-1 transition-colors">
                      <Download size={12} /> Download a template
                    </button>
                    <span className="text-[var(--line-subtle)]">|</span>
                    <span className="text-[12px] text-[var(--ink-faint)]">Supported: Xero, MYOB, custom CSV</span>
                  </div>

                  <TipBox icon={Sparkles}>
                    Most suppliers can email you a price list in CSV format. Just ask your rep for an &quot;item price export.&quot;
                  </TipBox>
                </>
              )}

              {/* Connect Xero */}
              {pricingTab === "xero" && (
                <>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                    Connecting Xero syncs your chart of accounts and contacts for invoicing -- it&apos;s a quick OAuth step best done from Settings so it doesn&apos;t interrupt onboarding.
                  </p>
                  <div className="rounded-xl border-2 border-[var(--line)] px-4 py-4 mb-6 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[14px] text-[var(--ink)]">Connect Xero</p>
                      <p className="text-[12.5px] text-[var(--ink-faint)]">Available anytime from Settings &gt; Integrations</p>
                    </div>
                    <ExternalLink size={16} className="text-[var(--ink-faint)] shrink-0" />
                  </div>
                  <TipBox icon={Sparkles}>
                    Finish onboarding now -- you&apos;ll find the Xero connect button waiting for you in Settings.
                  </TipBox>
                </>
              )}

              {/* Do this later */}
              {pricingTab === "later" && (
                <>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                    No problem -- you can add pricing manually as you quote, or come back to upload a CSV or past quotes anytime from Settings &gt; Price Book.
                  </p>
                  <TipBox icon={Sparkles}>
                    Swiftscope still works great with an empty price book -- you can type in prices as you go and they&apos;ll be remembered for next time.
                  </TipBox>
                </>
              )}
            </div>
          )}

          {/* ── STEP 5: How often do you quote from site? ── */}
          {step === 5 && (
            <div className="stepEnter" key="step5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-[var(--navy)] flex items-center justify-center">
                  <HardHat size={20} className="text-[var(--amber)]" />
                </div>
                <div>
                  <h1 className="font-display text-[26px] text-[var(--ink)]">How often do you quote from site?</h1>
                  <p className="text-[13px] text-[var(--ink-faint)]">This helps us show you the right tools</p>
                </div>
              </div>

              <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-6">
                Swiftscope is built for quoting on the job site. Tell us how often you quote from the field and we&apos;ll tailor your experience.
              </p>

              <div className="space-y-2.5 mb-6">
                {QUOTE_FREQUENCY_OPTIONS.map((opt) => {
                  const on = quoteFrequency === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setQuoteFrequency(opt.key)}
                      className={`w-full flex items-center gap-3 text-left rounded-xl border-2 px-4 py-3.5 transition-all ${
                        on ? "border-[var(--navy)] bg-[var(--navy)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--navy)]/40"
                      }`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${on ? "border-[var(--amber)]" : "border-[var(--ink-faint)]"}`}>
                        {on && <div className="w-2.5 h-2.5 rounded-full bg-[var(--amber)]" />}
                      </div>
                      <div>
                        <p className={`font-bold text-[14px] ${on ? "text-white" : "text-[var(ink)]"}`}>{opt.label}</p>
                        <p className={`text-[12px] ${on ? "text-[var(--steel-2)]" : "text-[var(--ink-faint)]"}`}>{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <TipBox icon={Sparkles}>
                Whether you quote daily or once a month, Swiftscope has you covered. Quote in under 4 minutes from your phone on site.
              </TipBox>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-red-800">{error}</p>
                  <button onClick={() => setError(null)} className="text-[11px] text-red-600 hover:text-red-800 font-semibold mt-1 underline">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => { setStep((s) => s - 1); setError(null); }} className="btn-secondary flex items-center gap-1.5">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <button onClick={handleContinue} disabled={step === STEPS.length && saving}
              className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : step === STEPS.length ? "Start quoting" : <>Continue <ArrowRight size={14} /></>}
            </button>
          </div>

          {step < STEPS.length && (
            <button onClick={handleSkip}
              className="w-full text-center text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink-soft)] mt-3 py-2 transition-colors font-semibold flex items-center justify-center gap-1.5">
              <SkipForward size={13} /> Skip this step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tip box helper                                                     */
/* ------------------------------------------------------------------ */

function TipBox({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="flex gap-2.5 bg-[var(--amber)]/8 border border-[var(--amber)]/20 rounded-xl px-4 py-3">
      <Icon size={16} className="text-[var(--amber)] shrink-0 mt-0.5" />
      <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{children}</p>
    </div>
  );
}
