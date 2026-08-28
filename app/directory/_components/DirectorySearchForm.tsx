"use client";

import { Search, Filter, Star, ArrowUpDown, Locate } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  postcode: string | undefined;
  search: string | undefined;
  reviews: string | undefined;
  rating: string | undefined;
  sort: string | undefined;
  radius: string | undefined;
  count: number;
}

export default function DirectorySearchForm({
  trade,
  postcode,
  search,
  reviews,
  rating,
  sort,
  radius,
  count,
}: DirectorySearchFormProps) {
  const activeSort = sort ?? "rating";
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Client-side navigation with scroll: false - a native <form> submit
  // (the previous approach) does a full browser page reload, which
  // resets scroll to the top by default. That's exactly why changing
  // trade (or any filter) sent the tradie back to the top of the page
  // instead of staying where they were looking at results.
  const navigate = useCallback((form: HTMLFormElement) => {
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/directory?${qs}` : "/directory", { scroll: false });
    });
  }, [router]);

  const handleChange = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    navigate(e.currentTarget);
  }, [navigate]);

  // Real data surfaced this: a genuine visitor typing "Lime plumbing" one
  // letter at a time produced seven separate full navigations, seven
  // server-side searches, and seven distinct $pageview captures for what
  // was one person doing one thing. The form-level onChange above fires
  // on every keystroke from the free-text search and postcode inputs, not
  // just on the dropdowns it was clearly designed for (a single click on
  // a <select> is naturally one event; a text field is not). Debounced
  // separately below so a dropdown still applies the instant it is
  // clicked -- there is nothing to wait for there -- while typed input
  // waits for a pause before it navigates.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFormChange = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "text") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const form = e.currentTarget;
      debounceRef.current = setTimeout(() => navigate(form), 450);
      return;
    }
    // A dropdown, or anything else: apply immediately, and drop any
    // pending debounced text-input navigation so it cannot fire a moment
    // later with stale field values.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    handleChange(e);
  }, [handleChange, navigate]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Enter-to-submit while a debounce is still pending should navigate
    // immediately with the current value, not wait out the timer too.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    navigate(e.currentTarget);
  }, [navigate]);

  return (
    <div id="listings" className="sticky top-[72px] z-30 border-b shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <form className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2 items-center" onChange={handleFormChange} onSubmit={handleSubmit}>
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
            name="search"
            defaultValue={search ?? ""}
            placeholder="Name or service"
            className="app-field pl-8 pr-3 text-[13px] w-full bg-white"
          />
        </div>

        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] z-10" />
          <input
            type="text"
            name="postcode"
            defaultValue={postcode ?? ""}
            placeholder="Postcode, e.g. 3199"
            inputMode="numeric"
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

        {(trade || postcode || search || reviews || rating || sort || radius) && (
          <Link href="/directory" className="text-[13px] font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--ink-faint)" }}>
            Clear all
          </Link>
        )}
      </form>
      <div className="max-w-6xl mx-auto px-6 pb-3">
        <p className="text-[14px] font-extrabold" style={{ color: "var(--ink)" }}>
          {count} result{count !== 1 ? "s" : ""}
          <span className="font-semibold" style={{ color: "var(--ink-faint)" }}>
            {search ? ` · "${search}"` : ""}
            {trade ? ` · ${TRADE_LABELS[trade] ?? trade}` : ""}
            {postcode ? ` · ${postcode}` : ""}
            {radius ? ` · ${RADIUS_OPTIONS.find((r) => r.value === radius)?.label ?? radius}` : ""}
            {reviews ? ` · ${REVIEW_RANGES.find((r) => r.value === reviews)?.label ?? reviews}` : ""}
            {rating ? ` · ${RATING_OPTIONS.find((r) => r.value === rating)?.label ?? rating}` : ""}
          </span>
        </p>
      </div>
    </div>
  );
}
