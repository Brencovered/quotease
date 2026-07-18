"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MarketingNav from "@/components/MarketingNav";
import {
  Search, Loader2, CheckCircle2, ArrowRight, Star,
  MapPin, ShieldCheck, AlertCircle,
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

type Step = "search" | "resolve" | "abn" | "done";

export default function ClaimDirectoryListingPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [step, setStep] = useState<Step>("search");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [trade, setTrade] = useState("");
  const [suburb, setSuburb] = useState("");

  const [matches, setMatches] = useState<ListingMatch[]>([]);
  const [strongMatch, setStrongMatch] = useState<ListingMatch | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null | "new">(null);

  const [abn, setAbn] = useState("");
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [resultOutcome, setResultOutcome] = useState<"claimed" | "created_new" | null>(null);

  // Auth-gated -- redirect to login (returning here) if not signed in.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login?redirect=/directory/claim");
        return;
      }
      setCheckingAuth(false);
    });
  }, [router]);

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
            <p className="text-[14px] text-[#5a6b78] mb-6">
              Homeowners searching for a {trade} in {suburb} can now find you.
            </p>
            {resultSlug && (
              <a href={`/directory/${resultSlug}`} className="btn-primary inline-flex items-center gap-2">
                View my page <ArrowRight size={16} />
              </a>
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
