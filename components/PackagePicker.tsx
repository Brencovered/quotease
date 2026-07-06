"use client";

/**
 * PackagePicker
 * -------------
 * Lets a tradie start a quote from one of their saved packages, right from
 * inside the quote wizard, instead of having to know packages live under
 * Materials > Packages and click through from there. Selecting a package
 * reloads the wizard with ?package_id=<id> -- the same mechanism the
 * Materials > Packages tab's "Use in new quote" link already uses, so
 * pricing/materials pre-fill exactly the same way.
 *
 * Shown at the start of the wizard (Customer step) where nothing has been
 * entered yet, so there's nothing to lose by reloading the page.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, ChevronRight, X, Clock, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";

interface PkgSummary {
  id: string;
  title: string;
  description: string | null;
  labour_hours: number | null;
  item_count: number;
  total_cost: number;
}

export default function PackagePicker({ trade }: { trade: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PkgSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  function usePackage(pkg: PkgSummary) {
    router.push(`?package_id=${pkg.id}&trade=${trade}`);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3 hover:bg-[var(--amber)]/10 transition-colors mb-4"
      >
        <span className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--amber-deep)]">
          <Package size={16} /> Start from a saved package
        </span>
        <ChevronRight size={15} className="text-[var(--amber-deep)]" />
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
                  No saved packages for this trade yet — you can create one under Materials &gt; Packages.
                </p>
              )}
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => usePackage(pkg)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--app-bg)]"
                >
                  <p className="text-[13.5px] font-bold text-[var(--ink)]">{pkg.title}</p>
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
