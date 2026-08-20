"use client";

/**
 * PackagePicker
 * -------------
 * Lets a tradie start a quote from one of their saved packages, right from
 * inside the quote wizard, instead of having to know packages live under
 * Materials > Packages and click through from there.
 *
 * Selecting a package fetches its line items and hands them to the caller
 * via onSelect, which merges them straight into the wizard's in-memory
 * scope list (setSiteItems) - the same "package" source channel that
 * ScopeItem already had a slot for. This deliberately does NOT navigate or
 * reload the page (an earlier version did, via ?package_id=<id>, which
 * wiped every other field in the wizard the moment it ran). Because
 * nothing here touches the URL or remounts anything, it's safe to render
 * on the Quote capture step, mid-workflow, where a package is actually
 * useful - not just at the very start before anything's been entered.
 */

import { useEffect, useState } from "react";
import { Package, ChevronRight, X, Clock, DollarSign, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import type { ScopeItem } from "@/components/ScopeOfWorkStep";

interface PkgSummary {
  id: string;
  title: string;
  description: string | null;
  labour_hours: number | null;
  item_count: number;
  total_cost: number;
}

export default function PackagePicker({ trade, onSelect }: { trade: string; onSelect: (items: ScopeItem[]) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PkgSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const businessId = await getActiveBusinessId(supabase, userData.user.id);
        const { data } = await supabase
          .from("packages")
          .select("id, title, description, labour_hours, package_items(qty, unit_cost)")
          .eq("profile_id", businessId)
          .eq("trade", trade)
          .eq("status", "active")
          .order("title");
        const rows = (data ?? []) as unknown as Array<{
          id: string; title: string; description: string | null; labour_hours: number | null;
          package_items: { qty: number; unit_cost: number }[] | null;
        }>;
        setPackages(rows.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          labour_hours: p.labour_hours,
          item_count: p.package_items?.length ?? 0,
          total_cost: (p.package_items ?? []).reduce((s, i) => s + i.qty * i.unit_cost, 0),
        })));
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    })();
  }, [open, loaded, trade]);

  async function selectPackage(pkg: PkgSummary) {
    setAdding(pkg.id);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("package_items")
        .select("label, qty, unit, unit_cost")
        .eq("package_id", pkg.id)
        .order("sort_order");
      const rows = (data ?? []) as Array<{ label: string; qty: number; unit: string; unit_cost: number }>;

      const items: ScopeItem[] = rows.map((r) => ({
        id: Math.random().toString(36).slice(2),
        label: r.label,
        qty: r.qty,
        unit: r.unit,
        note: "",
        materialsCost: r.qty * r.unit_cost,
        labourHrs: 0,
        source: "package",
      }));

      // Packages carry one total labour figure for the whole bundle rather
      // than per-item hours, so that becomes its own line rather than being
      // split arbitrarily across the material items above.
      if (pkg.labour_hours) {
        items.push({
          id: Math.random().toString(36).slice(2),
          label: `${pkg.title} - labour`,
          qty: pkg.labour_hours,
          unit: "hrs",
          note: "",
          materialsCost: 0,
          labourHrs: pkg.labour_hours,
          source: "package",
        });
      }

      onSelect(items);
      setOpen(false);
    } finally {
      setAdding(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl px-4 py-3 hover:border-[var(--navy)]/40 transition-colors mb-4 shadow-sm"
      >
        <span className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--ink)]">
          <Package size={16} className="text-[var(--navy)]" /> Add a saved package
        </span>
        <ChevronRight size={15} className="text-[var(--ink-faint)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-[var(--surface)] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="font-bold text-[15px] text-[var(--ink)]">Choose a package</p>
              <button onClick={() => setOpen(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] p-1">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-2 pb-4">
              {loading && <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-6">Loading...</p>}
              {!loading && packages.length === 0 && (
                <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-6">
                  No saved packages for this trade yet - you can create one under Materials &gt; Packages.
                </p>
              )}
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => selectPackage(pkg)}
                  disabled={adding !== null}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--app-bg)] disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-bold text-[var(--ink)]">{pkg.title}</p>
                    {adding === pkg.id && <Loader2 size={14} className="animate-spin text-[var(--ink-faint)] shrink-0" />}
                  </div>
                  {pkg.description && (
                    <p className="text-[12px] text-[var(--ink-faint)] truncate">{pkg.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[11.5px] text-[var(--ink-faint)]">
                    <span>{pkg.item_count} item{pkg.item_count === 1 ? "" : "s"}</span>
                    {pkg.labour_hours != null && (
                      <span className="inline-flex items-center gap-0.5"><Clock size={10} /> {pkg.labour_hours}h</span>
                    )}
                    <span className="inline-flex items-center gap-0.5"><DollarSign size={10} /> ${pkg.total_cost.toLocaleString()} materials</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
