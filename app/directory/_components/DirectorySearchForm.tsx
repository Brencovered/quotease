"use client";

import { Search, Filter, Star, ArrowUpDown, Locate } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

const ALL_TRADES = [
  "electrician", "plumber", "builder", "roofer", "painter", "carpenter",
  "tiler", "landscaper", "concreter", "fencer", "plasterer", "handyman",
];

const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician", plumber: "Plumber", builder: "Builder",
  roofer: "Roofer", painter: "Painter", carpenter: "Carpenter",
  tiler: "Tiler", landscaper: "Landscaper", concreter: "Concreter",
  fencer: "Fencer", plasterer: "Plasterer", handyman: "Handyman",
};

const REVIEW_RANGES = [
  { value: "", label: "Any reviews" },
  { value: "1-10", label: "1-10 reviews" },
  { value: "10-50", label: "10-50 reviews" },
  { value: "50-100", label: "50-100 reviews" },
  { value: "100-500", label: "100-500 reviews" },
  { value: "500+", label: "500+ reviews" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4.5", label: "4.5+ stars" },
  { value: "4.0", label: "4.0+ stars" },
  { value: "3.5", label: "3.5+ stars" },
];

const SORT_OPTIONS = [
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviews" },
  { value: "name", label: "Name A-Z" },
];

const RADIUS_OPTIONS = [
  { value: "", label: "Any distance" },
  { value: "5", label: "Within 5 km" },
  { value: "10", label: "Within 10 km" },
  { value: "25", label: "Within 25 km" },
  { value: "50", label: "Within 50 km" },
  { value: "100", label: "Within 100 km" },
];

interface DirectorySearchFormProps {
  trade: string | undefined;
  suburb: string | undefined;
  reviews: string | undefined;
  rating: string | undefined;
  sort: string | undefined;
  radius: string | undefined;
  count: number;
}

export default function DirectorySearchForm({
  trade,
  suburb,
  reviews,
  rating,
  sort,
  radius,
  count,
}: DirectorySearchFormProps) {
  const activeSort = sort ?? "rating";

  const handleChange = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    setTimeout(() => form.submit(), 0);
  }, []);

  return (
    <div id="listings" className="sticky top-0 z-20 border-b shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <form method="GET" className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center" onChange={handleChange}>
        <select name="trade" defaultValue={trade ?? ""} className="app-field text-[13px] w-auto bg-white pl-3 pr-2">
          <option value="">All trades</option>
          {ALL_TRADES.map((t) => (
            <option key={t} value={t}>{TRADE_LABELS[t]}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] z-10" />
          <input
            type="text"
            name="suburb"
            defaultValue={suburb ?? ""}
            placeholder="Suburb..."
            className="app-field pl-8 pr-3 text-[13px] w-full bg-white"
          />
        </div>

        <div className="relative">
          <Locate size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] z-10 pointer-events-none" />
          <select name="radius" defaultValue={radius ?? ""}
            className="app-field text-[13px] w-auto bg-white pl-8 pr-2"
            style={{ appearance: "none", WebkitAppearance: "none" }}>
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] z-10 pointer-events-none" />
          <select name="reviews" defaultValue={reviews ?? ""}
            className="app-field text-[13px] w-auto bg-white pl-8 pr-2"
            style={{ appearance: "none", WebkitAppearance: "none" }}>
            {REVIEW_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Star size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] z-10 pointer-events-none" />
          <select name="rating" defaultValue={rating ?? ""}
            className="app-field text-[13px] w-auto bg-white pl-8 pr-2"
            style={{ appearance: "none", WebkitAppearance: "none" }}>
            {RATING_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <ArrowUpDown size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] z-10 pointer-events-none" />
          <select name="sort" defaultValue={activeSort}
            className="app-field text-[13px] w-auto bg-white pl-8 pr-2"
            style={{ appearance: "none", WebkitAppearance: "none" }}>
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="bg-[#0a1722] text-white font-bold text-[13px] px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          Search
        </button>

        {(trade || suburb || reviews || rating || sort || radius) && (
          <Link href="/directory" className="text-[13px] font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--ink-faint)" }}>
            Clear all
          </Link>
        )}

        <span className="text-[12px] ml-auto hidden sm:block" style={{ color: "var(--ink-faint)" }}>
          {count} result{count !== 1 ? "s" : ""}
          {trade ? ` - ${TRADE_LABELS[trade] ?? trade}` : ""}
          {suburb ? ` - ${suburb}` : ""}
          {radius ? ` - ${RADIUS_OPTIONS.find((r) => r.value === radius)?.label ?? radius}` : ""}
          {reviews ? ` - ${REVIEW_RANGES.find((r) => r.value === reviews)?.label ?? reviews}` : ""}
          {rating ? ` - ${RATING_OPTIONS.find((r) => r.value === rating)?.label ?? rating}` : ""}
        </span>
      </form>
    </div>
  );
}
