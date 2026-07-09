"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  MapPin,
  ArrowRight,
  ClipboardList,
  Star,
  Shield,
  Sparkles,
  CircleDot,
} from "lucide-react";

const ALL_TRADES = [
  "electrician",
  "plumber",
  "builder",
  "roofer",
  "painter",
  "carpenter",
  "tiler",
  "landscaper",
  "concreter",
  "fencer",
  "plasterer",
  "handyman",
];

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician",
  plumber: "Plumber",
  builder: "Builder",
  roofer: "Roofer",
  painter: "Painter",
  carpenter: "Carpenter",
  tiler: "Tiler",
  landscaper: "Landscaper",
  concreter: "Concreter",
  fencer: "Fencer",
  plasterer: "Plasterer",
  handyman: "Handyman",
};

const RADIUS_OPTIONS = [
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
  { value: "50", label: "50 km" },
  { value: "100", label: "100 km" },
];

interface FindTradieHeroSearchProps {
  count: number;
}

export default function FindTradieHeroSearch({
  count,
}: FindTradieHeroSearchProps) {
  const router = useRouter();
  const [trade, setTrade] = useState("");
  const [postcode, setPostcode] = useState("");
  const [radius, setRadius] = useState("25");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");

      if (!postcode.trim()) {
        setError("Please enter your postcode");
        return;
      }

      const params = new URLSearchParams();
      if (trade) params.set("trade", trade);
      params.set("postcode", postcode.trim());
      params.set("radius", radius);

      router.push(`/directory?${params.toString()}`);
    },
    [trade, postcode, radius, router]
  );

  return (
    <section className="relative overflow-hidden bg-[#0a1722]">
      {/* Subtle radial gradient orb behind the form */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.15) 0%, transparent 60%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -40%)",
        }}
      />

      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-6">
          <Sparkles size={14} className="text-[#ffb400]" />
          <span className="text-[11px] font-bold tracking-[.2em] uppercase text-[#ffb400]">
            Swiftscope Directory
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-[2.4rem] sm:text-[3rem] lg:text-[3.6rem] text-white leading-[1.05] mb-4">
          Find the right tradie for your job
        </h1>

        {/* Subtext */}
        <p className="text-[15px] sm:text-[16px] max-w-lg mx-auto mb-10 leading-relaxed text-[#8b96a1]">
          Search from {count} curated tradie listings across Australia. Real
          reviews, verified ratings.
        </p>

        {/* Step indicator */}
        <p className="text-[11px] font-bold tracking-[.15em] uppercase text-[#8b96a1] mb-4">
          Step 1 of 2 — Tell us what you need
        </p>

        {/* Search form card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-left shadow-xl">
          <form onSubmit={handleSubmit}>
            <div className="grid sm:grid-cols-12 gap-3 sm:gap-4 items-end">
              {/* Trade select */}
              <div className="sm:col-span-4 relative">
                <label
                  htmlFor="trade"
                  className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5"
                >
                  Trade
                </label>
                <div className="relative">
                  <Wrench
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none"
                  />
                  <select
                    id="trade"
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    className="app-field text-[14px] pl-9 pr-3 bg-white w-full appearance-none"
                    style={{ appearance: "none" }}
                  >
                    <option value="">What trade do you need?</option>
                    {ALL_TRADES.map((t) => (
                      <option key={t} value={t}>
                        {TRADE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postcode input */}
              <div className="sm:col-span-4 relative">
                <label
                  htmlFor="postcode"
                  className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5"
                >
                  Postcode
                </label>
                <div className="relative">
                  <MapPin
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none"
                  />
                  <input
                    id="postcode"
                    type="text"
                    inputMode="numeric"
                    value={postcode}
                    onChange={(e) => {
                      setPostcode(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="e.g. 3199"
                    className="app-field text-[14px] pl-9 pr-3 bg-white w-full"
                  />
                </div>
              </div>

              {/* Radius select */}
              <div className="sm:col-span-2 relative">
                <label
                  htmlFor="radius"
                  className="block text-[12px] font-bold text-[var(--ink-soft)] mb-1.5"
                >
                  Radius
                </label>
                <div className="relative">
                  <CircleDot
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none"
                  />
                  <select
                    id="radius"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="app-field text-[14px] pl-9 pr-3 bg-white w-full appearance-none"
                    style={{ appearance: "none" }}
                  >
                    {RADIUS_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit button */}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-5 py-[11px] rounded-xl hover:bg-[#e89e00] transition-colors"
                >
                  Find
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-[13px] font-semibold text-red-600 mt-3">
                {error}
              </p>
            )}
          </form>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-5 sm:gap-8 mt-8">
          {[
            { icon: ClipboardList, text: `${count}+ Curated listings` },
            { icon: Star, text: "Real Google reviews" },
            { icon: Shield, text: "Free for homeowners" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 text-[12.5px] font-semibold text-[#8b96a1]"
            >
              <Icon size={14} className="text-[#ffb400]" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
