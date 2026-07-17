"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, BookOpen } from "lucide-react";

export type PriceBookResult = {
  id: string; supplier: string; sku: string | null;
  description: string; unit: string; cost_price: number;
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function PriceBookSearch({
  trade,
  onSelect,
  placeholder = "Search your supplier price books...",
  initialValue = "",
}: {
  trade?: string;
  onSelect: (item: PriceBookResult) => void;
  placeholder?: string;
  initialValue?: string;
}) {
  const [query,    setQuery]    = useState(initialValue);
  const [results,  setResults]  = useState<PriceBookResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  // Whether this business has ANY price book items at all for this trade -
  // checked once on mount, separately from any individual search. Defaults
  // to true (assume a price book exists) so we never flash an incorrect
  // "No price book" message before this check has resolved.
  const [businessHasPriceBook, setBusinessHasPriceBook] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  const debouncedQ = useDebounce(query, 280);

  useEffect(() => {
    let cancelled = false;
    async function checkExists() {
      const params = new URLSearchParams({ checkExists: "1" });
      if (trade) params.set("trade", trade);
      try {
        const res = await fetch(`/api/pricebook?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setBusinessHasPriceBook(!!data.hasAny);
        }
      } catch { /* leave default assumption in place */ }
    }
    checkExists();
    return () => { cancelled = true; };
  }, [trade]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ q, limit: "15" });
    if (trade) params.set("trade", trade);
    const res = await fetch(`/api/pricebook?${params}`);
    const data = await res.json();
    setResults(data.items ?? []);
    setOpen(true);
    setLoading(false);
  }, [trade]);

  useEffect(() => { search(debouncedQ); }, [debouncedQ, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(item: PriceBookResult) {
    setQuery(item.description);
    setOpen(false);
    onSelect(item);
  }

  const SUPPLIER_LABELS: Record<string, string> = {
    reece: "Reece", tradelink: "Tradelink", middys: "Middy's",
    rexel: "Rexel", neca: "NECA", custom: "Custom",
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        {loading
          ? <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[var(--amber)] border-t-transparent rounded-full animate-spin" />
          : <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
        }
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="app-field pl-8 text-[13px]"
          placeholder={placeholder}
        />
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-amber-600">
            <BookOpen size={12} />
            <span>{businessHasPriceBook ? "No matches" : "No price book"}</span>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[var(--line)] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map(item => (
            <button key={item.id} type="button"
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-[var(--app-bg)] text-left border-b border-[var(--line-subtle)] last:border-0"
              onClick={() => select(item)}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{item.description}</p>
                <p className="text-[11px] text-[var(--ink-faint)]">
                  {SUPPLIER_LABELS[item.supplier] ?? item.supplier}
                  {item.sku ? ` · ${item.sku}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold text-[var(--ink)]">${item.cost_price.toFixed(2)}</p>
                <p className="text-[10.5px] text-[var(--ink-faint)]">/{item.unit}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
