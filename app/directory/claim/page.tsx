"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MarketingNav from "@/components/MarketingNav";
import {
  Search, Loader2, CheckCircle2, ArrowRight, Star,
  MapPin, ShieldCheck, AlertCircle, Mail, Lock,
} from "lucide-react";

const TRADES = [
  { key: "electrician", label: "Electrician" },
  { key: "plumber", label: "Plumber" },
  { key: "builder", label: "Builder" },
  { key: "roofer", label: "Roofer" },
  { key: "painter", label: "Painter" },
  { key: "carpenter", label: "Carpenter" },
  { key: "tiler", label: "Tiler" },
  { key: "landscaper", label: "Landscaper" },
  { key: "concreter", label: "Concreter" },
  { key: "fencer", label: "Fencer" },
  { key: "plasterer", label: "Plasterer" },
  { key: "handyman", label: "Handyman" },
];

type ListingMatch = {
  id: string;
  business_name: string;
  suburb: string | null;
  trades: string[] | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  logo_url: string | null;
  similarity: number;
};

type Step = "auth" | "search" | "resolve" | "abn" | "done";

export default function ClaimDirectoryListingPage() {
  const searchParams = useSearchParams();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState<Step>("auth");

  // Auth step -- deliberately separate from the main app's /login and
  // /signup: this is the $4.99 standalone tier's own entry point, not the
  // $45 plan's onboarding wizard, and shouldn't look or feel like it. A new
  // account created here should never be routed through /onboarding.
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState(() => searchParams.get("name") ?? "");
  const [trade, setTrade] = useState(() => searchParams.get("trade") ?? "");
  const [suburb, setSuburb] = useState(() => searchParams.get("suburb") ?? "");

  const [matches, setMatches] = useState<ListingMatch[]>([]);
  const [strongMatch, setStrongMatch] = useState<ListingMatch | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null | "new">(null);

  const [abn, setAbn] = useState("");
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [resultOutcome, setResultOutcome] = useState<"claimed" | "created_new" | null>(null);
  const [resultVerified, setResultVerified] = useState(false);

  // Already signed in (e.g. an existing $45 tradie extending into a
  // directory page) -- skip straight past the auth step.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setStep("search");
      setCheckingAuth(false);
    });
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setAuthLoading(true);
    try {
      const supabase = createClient();
      if (authMode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Explicitly back to /directory/claim -- never the $45 plan's
            // /onboarding default that a bare signUp() would otherwise send
            // an email-confirmation link to.
            emailRedirectTo: `${window.location.origin}/directory/claim`,
          },
        });
        if (signUpError) { setError(signUpError.message); return; }
        if (data.session) {
          setStep("search");
        } else {
          setCheckYourEmail(true);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) { setError(signInError.message); return; }
        setStep("search");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim() || !trade || !suburb.trim()) {
      setError("Please fill in your business name, trade, and suburb.");
      return;
    }

    setSearching(true);
    try {
      const res = await fetch("/api/directory/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, trade, suburb }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed. Please try again.");
        return;
      }
      setMatches(data.matches ?? []);
      setStrongMatch(data.strongMatch ?? null);
      setStep("resolve");
    } catch {
      setError("Search failed. Please check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  async function finaliseClaim(listingId: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/directory/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          businessName,
          trade,
          suburb,
          abn: abn.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResultSlug(data.slug);
      setResultOutcome(data.outcome);
      setResultVerified(Boolean(data.verifiedBadge));
      setStep("done");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
        <Loader2 className="animate-spin text-[#0a1722]" size={28} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      <MarketingNav />

      <div className="max-w-2xl mx-auto px-6 py-14">
        <h1 className="font-display text-[2.2rem] sm:text-[2.6rem] text-[#0a1722] leading-tight mb-3">
          Claim your directory page
        </h1>
        <p className="text-[15px] text-[#5a6b78] mb-10">
          Get a verified page in the Swiftscope directory, built for homeowners
          searching for a tradie in your area.
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-[13.5px] rounded-xl px-4 py-3 mb-6">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "auth" && (
          <div className="card p-6 rounded-2xl bg-white">
            {checkYourEmail ? (
              <div className="text-center py-4">
                <Mail size={32} className="text-[#ffb400] mx-auto mb-3" />
                <p className="text-[14px] text-[#0a1722] font-semibold mb-1">Check your email</p>
                <p className="text-[13.5px] text-[#5a6b78]">
                  We&apos;ve sent a confirmation link to {email}. Click it to come back here and set up your page.
                </p>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-5">
                <div className="flex gap-1 bg-[#f1f4f6] rounded-lg p-1 mb-1">
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup")}
                    className={`flex-1 text-[13px] font-semibold py-1.5 rounded-md transition-colors ${authMode === "signup" ? "bg-white shadow-sm text-[#0a1722]" : "text-[#5a6b78]"}`}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className={`flex-1 text-[13px] font-semibold py-1.5 rounded-md transition-colors ${authMode === "login" ? "bg-white shadow-sm text-[#0a1722]" : "text-[#5a6b78]"}`}
                  >
                    Log in
                  </button>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com.au"
                      className="app-field w-full pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97a1]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === "signup" ? "Choose a password" : "Your password"}
                      className="app-field w-full pl-9"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {authLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {authLoading ? "One moment..." : authMode === "signup" ? "Create my account" : "Log in"}
                </button>

                <p className="text-[12px] text-[#8a97a1] text-center">
                  This is just for your directory page -- not the full Swiftscope job management sign up.
                </p>
              </form>
            )}
          </div>
        )}

        {step === "search" && (
          <form onSubmit={handleSearch} className="card p-6 rounded-2xl bg-white space-y-5">
            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Business name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Smith Electrical"
                className="app-field w-full"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Trade</label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="app-field w-full"
              >
                <option value="">Select your trade</option>
                {TRADES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">Suburb</label>
              <input
                type="text"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder="e.g. Parramatta"
                className="app-field w-full"
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {searching ? "Searching..." : "Find my business"}
            </button>
          </form>
        )}

        {step === "resolve" && (
          <div className="space-y-4">
            {strongMatch ? (
              <div className="card p-6 rounded-2xl bg-white">
                <p className="text-[13px] font-semibold text-[#5a6b78] mb-4">Is this your business?</p>
                <ListingMatchCard match={strongMatch} />
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => { setSelectedListingId(strongMatch.id); setStep("abn"); }}
                    className="btn-primary flex-1"
                  >
                    Yes, this is us
                  </button>
                  <button
                    onClick={() => { setSelectedListingId("new"); setStep("abn"); }}
                    className="btn-secondary flex-1"
                  >
                    Not us
                  </button>
                </div>
              </div>
            ) : matches.length > 0 ? (
              <div className="card p-6 rounded-2xl bg-white">
                <p className="text-[13px] font-semibold text-[#5a6b78] mb-4">
                  We found a few similar listings. Is one of these you?
                </p>
                <div className="space-y-3">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedListingId(m.id); setStep("abn"); }}
                      className="w-full text-left"
                    >
                      <ListingMatchCard match={m} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setSelectedListingId("new"); setStep("abn"); }}
                  className="btn-secondary w-full mt-4"
                >
                  None of these -- create a new listing
                </button>
              </div>
            ) : (
              <div className="card p-6 rounded-2xl bg-white">
                <p className="text-[14px] text-[#5a6b78] mb-4">
                  We couldn&apos;t find an existing listing for &quot;{businessName}&quot;.
                  We&apos;ll create a brand new one for you.
                </p>
                <button
                  onClick={() => { setSelectedListingId("new"); setStep("abn"); }}
                  className="btn-primary w-full"
                >
                  Create my listing <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {step === "abn" && (
          <div className="card p-6 rounded-2xl bg-white space-y-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
              <ShieldCheck size={15} />
              Add your ABN to show a verified badge on your page (optional, can add later)
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#0a1722] mb-1.5">ABN</label>
              <input
                type="text"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="11 digits"
                className="app-field w-full"
              />
            </div>
            <button
              onClick={() => finaliseClaim(selectedListingId === "new" ? null : selectedListingId)}
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? "Setting up your page..." : "Finish setup"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="card p-8 rounded-2xl bg-white text-center">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display text-[1.6rem] text-[#0a1722] mb-2">
              {resultOutcome === "claimed" ? "Your page is claimed!" : "Your page is live!"}
            </h2>
            <p className="text-[14px] text-[#5a6b78] mb-2">
              Homeowners searching for a {trade} in {suburb} can now find you.
            </p>
            {abn && (
              <p className={`text-[13px] mb-6 ${resultVerified ? "text-emerald-600" : "text-[#8a97a1]"}`}>
                {resultVerified
                  ? "Your ABN was verified -- the Verified Business badge is now showing on your page."
                  : "We couldn't verify that ABN right now. You can add it again later from Manage your page."}
              </p>
            )}
            {resultSlug && (
              <div className="flex items-center justify-center gap-3">
                <Link href={`/directory/${resultSlug}`} className="btn-primary inline-flex items-center gap-2">
                  View my page <ArrowRight size={16} />
                </Link>
                <Link href="/directory/manage" className="btn-secondary inline-flex items-center gap-2">
                  Add photos & description
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ListingMatchCard({ match }: { match: ListingMatch }) {
  return (
    <div className="flex items-center gap-3 border border-[#e5e9ec] rounded-xl p-3">
      {match.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={match.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-[#f1f4f6] shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#0a1722] truncate">{match.business_name}</p>
        <div className="flex items-center gap-3 text-[12px] text-[#5a6b78]">
          {match.suburb && (
            <span className="flex items-center gap-1"><MapPin size={11} /> {match.suburb}</span>
          )}
          {match.google_rating && (
            <span className="flex items-center gap-1"><Star size={11} className="fill-[#f59e0b] text-[#f59e0b]" /> {match.google_rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
