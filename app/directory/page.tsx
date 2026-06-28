import Link from "next/link";
import { Globe, MapPin, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const TRADES = ["electrician", "plumber", "roofer", "builder", "carpenter", "painter"];

type DirectoryListing = {
  id: string;
  business_name: string;
  trades: string[];
  website_url: string | null;
  suburb: string | null;
  postcode: string | null;
  is_claimed: boolean;
  logo_url: string | null;
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ trade?: string; suburb?: string }>;
}) {
  const { trade, suburb } = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("directory_public")
    .select("*")
    .order("business_name", { ascending: true });

  if (trade) query = query.contains("trades", [trade]);
  if (suburb) query = query.ilike("suburb", `%${suburb}%`);

  const { data: listings, error } = await query;

  return (
    <main className="min-h-screen" style={{ background: "var(--app-bg)" }}>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--amber-deep)" }}>
          Internal preview — not linked publicly yet
        </div>
        <h1 className="font-display text-3xl mb-1" style={{ color: "var(--ink)" }}>
          Find a local tradie
        </h1>
        <p className="mb-8" style={{ color: "var(--ink-soft)" }}>
          Browse tradies by trade and suburb across SwiftScope&apos;s directory.
        </p>

        <form
          method="GET"
          className="flex flex-wrap gap-3 mb-8 p-4 rounded-[var(--radius)]"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          <select
            name="trade"
            defaultValue={trade ?? ""}
            className="px-3 py-2 rounded-[var(--radius-sm)] text-sm"
            style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
          >
            <option value="">All trades</option>
            {TRADES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="suburb"
            placeholder="Suburb (e.g. Seaford)"
            defaultValue={suburb ?? ""}
            className="px-3 py-2 rounded-[var(--radius-sm)] text-sm flex-1 min-w-[180px]"
            style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
          />

          <button
            type="submit"
            className="px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold"
            style={{ background: "var(--amber)", color: "var(--navy)" }}
          >
            Search
          </button>

          {(trade || suburb) && (
            <Link
              href="/directory"
              className="px-4 py-2 rounded-[var(--radius-sm)] text-sm self-center"
              style={{ color: "var(--ink-soft)" }}
            >
              Clear
            </Link>
          )}
        </form>

        {error && (
          <div
            className="p-4 rounded-[var(--radius)] mb-6 text-sm"
            style={{ background: "var(--red-bg)", color: "var(--red)" }}
          >
            Couldn&apos;t load listings: {error.message}
          </div>
        )}

        {!error && listings?.length === 0 && (
          <div className="text-sm" style={{ color: "var(--ink-faint)" }}>
            No tradies match that search yet.
          </div>
        )}

        <div className="grid gap-3">
          {listings?.map((listing: DirectoryListing) => (
            <div
              key={listing.id}
              className="p-5 rounded-[var(--radius)] flex items-start justify-between gap-4"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold text-base" style={{ color: "var(--ink)" }}>
                    {listing.business_name}
                  </h2>
                  {listing.is_claimed && (
                    <span
                      className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "var(--green-bg)", color: "var(--green)" }}
                    >
                      <BadgeCheck size={12} /> Claimed
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {listing.trades?.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: "var(--amber-light)", color: "var(--amber-deep)" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                  <MapPin size={14} /> {listing.suburb ?? "Service area not set"}
                </div>
              </div>

              {listing.website_url && (
                <a
                  href={listing.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-[var(--radius-sm)] whitespace-nowrap"
                  style={{ background: "var(--blue-bg)", color: "var(--blue)" }}
                >
                  <Globe size={14} /> Website
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs" style={{ color: "var(--ink-faint)" }}>
          {listings?.length ?? 0} tradies shown. Contact-via-SwiftScope and quote requests aren&apos;t wired up yet —
          this is a browse-only preview of the directory data.
        </p>
      </div>
    </main>
  );
}
