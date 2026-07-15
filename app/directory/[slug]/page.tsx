import Link from "next/link";
import {
  Star, MapPin, Phone, Globe, Mail, Check, Shield,
  ShieldCheck, MessageSquare, ExternalLink, Wrench,
  Building2, Users, Search,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MarketingNav from "@/components/MarketingNav";
import DirectoryCard from "@/components/DirectoryCard";
import { tradieListingMeta, buildDirectorySlug } from "@/lib/seo/meta";
import { getGoogleReviewsUrl } from "@/lib/seo/gbp";
import PhotoGallery from "./_components/PhotoGallery";
import QuoteForm from "./_components/QuoteForm";
import ListingLogo from "./_components/ListingLogo";
import ReviewsSection from "./_components/ReviewsSection";
import { getPlaceReviews } from "@/lib/googleReviews";
import TradieSchema from "@/components/seo/TradieSchema";

/**
 * Temporarily off: with few tradies in the directory yet, a homeowner
 * submitting a "request a quote" enquiry that never gets a response hurts
 * trust more than not offering it at all. Flip back to true once there's
 * enough directory coverage that a submitted enquiry reliably reaches a
 * real, responsive tradie. Nothing else needs to change to re-enable --
 * the form, API route, and DB table are untouched.
 */
const QUOTE_REQUESTS_ENABLED = false;

/* ------------------------------------------------------------------ */
/*  Trade colour / label maps (synced with DirectoryCard)               */
/* ------------------------------------------------------------------ */
const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician", plumber: "Plumber", builder: "Builder",
  roofer: "Roofer", painter: "Painter", carpenter: "Carpenter",
  tiler: "Tiler", landscaper: "Landscaper", concreter: "Concreter",
  fencer: "Fencer", plasterer: "Plasterer", handyman: "Handyman",
};

const TRADE_COLORS: Record<string, string> = {
  electrician: "#f59e0b", plumber: "#3b82f6", builder: "#64748b",
  roofer: "#ef4444", painter: "#a855f7", carpenter: "#92400e",
  tiler: "#06b6d4", landscaper: "#16a34a", concreter: "#71717a",
  fencer: "#854d0e", plasterer: "#ec4899", handyman: "#0a1722",
};

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
type Listing = {
  id: string; business_name: string; trades: string[] | null;
  suburb: string | null; postcode: string | null;
  latitude: number | null; longitude: number | null;
  scraped_contact_phone: string | null;
  website_url: string | null; scraped_contact_email: string | null;
  google_rating: number | null; google_reviews_count: number | null;
  photo_references: string[] | null; place_id: string | null;
  blurb: string | null; logo_url: string | null;
};

/* ------------------------------------------------------------------ */
/*  Reusable star renderer                                              */
/* ------------------------------------------------------------------ */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14}
          className={
            i <= Math.floor(rating) ? "fill-[#f59e0b] text-[#f59e0b]"
            : i === Math.floor(rating) + 1 && rating % 1 >= 0.5
            ? "fill-[#f59e0b]/50 text-[#f59e0b]"
            : "text-gray-200 fill-gray-200"
          }
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function domainFromUrl(url: string): string | null {
  try { const h = new URL(url).hostname; return h.replace(/^www\./, ""); }
  catch { return null; }
}

/* ------------------------------------------------------------------ */
/*  Metadata (server)                                                   */
/* ------------------------------------------------------------------ */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a URL slug to a listing row. Handles two shapes:
 *  - The pretty slug buildDirectorySlug produces (business-suburb-uid6) -
 *    what the sitemap, SEO landing pages, and directory search cards all
 *    actually link to. Extracts the trailing 6-hex-char id suffix and
 *    resolves it via a Postgres function (PostgREST can't LIKE-filter a
 *    uuid column directly without a cast).
 *  - A raw UUID - what every listing page used to be linked/shared/
 *    indexed as before this fix. Still resolved (so existing bookmarks
 *    and any already-indexed raw-UUID URLs keep working), flagged via
 *    isLegacyId so the caller can 308-redirect to the canonical pretty
 *    slug instead of serving duplicate content at two URLs.
 *
 * Two candidate rows back from the suffix lookup (an astronomically
 * unlikely 6-hex-char collision) is treated as not-found rather than
 * silently guessing which business the visitor meant.
 */
async function resolveListingBySlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string
): Promise<{ listing: Listing | null; isLegacyId: boolean }> {
  if (UUID_RE.test(slug)) {
    const { data } = await supabase.from("directory_listing").select("*").eq("id", slug).single();
    return { listing: (data as Listing | null) ?? null, isLegacyId: true };
  }

  const suffix = slug.slice(-6);
  if (!/^[0-9a-f]{6}$/i.test(suffix)) return { listing: null, isLegacyId: false };

  const { data } = await supabase.rpc("resolve_directory_listing_by_uid_suffix", { p_suffix: suffix });
  if (!data || data.length !== 1) return { listing: null, isLegacyId: false };
  return { listing: data[0] as Listing, isLegacyId: false };
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { listing } = await resolveListingBySlug(supabase, slug);
  if (!listing) return { title: "Not found | Swiftscope" };
  // Canonical always points at the pretty slug, even when this metadata
  // is being generated for a request that arrived via the legacy raw-UUID
  // URL - that's the whole point of a canonical tag here: tell Google
  // there's one true URL for this listing, not two.
  const canonicalSlug = buildDirectorySlug({ id: listing.id, business_name: listing.business_name, suburb: listing.suburb ?? "" });
  return tradieListingMeta({
    business_name: listing.business_name,
    trades: listing.trades ?? [],
    suburb: listing.suburb ?? "",
    blurb: listing.blurb,
    google_rating: listing.google_rating,
    google_reviews_count: listing.google_reviews_count,
    logo_url: listing.logo_url,
    slug: canonicalSlug,
  });
}

/* ------------------------------------------------------------------ */
/*  Main page (server component)                                        */
/* ------------------------------------------------------------------ */
export default async function TradieProfilePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { listing: maybeListing, isLegacyId } = await resolveListingBySlug(supabase, slug);
  if (!maybeListing) notFound();
  const listing: Listing = maybeListing;

  // Someone hit the old raw-UUID URL (a bookmark, an already-indexed
  // link, a share from before this fix) - send them to the canonical
  // pretty-slug URL instead of rendering the same page at two addresses.
  if (isLegacyId) {
    permanentRedirect(`/directory/${buildDirectorySlug({ id: listing.id, business_name: listing.business_name, suburb: listing.suburb ?? "" })}`);
  }

  /* Similar tradies - always geographically scoped. The previous query
     used an OR between trade-match and suburb-match, so a trade match
     alone (with zero location constraint) was enough to surface a
     tiler from anywhere in the country whenever there weren't 3 exact
     suburb matches - which is exactly how a Townsville tiler ended up
     showing Melbourne-suburb tilers as "similar." Never fall back to
     an unconstrained trade-only match; if nothing nearby exists yet,
     showing fewer (or zero) results is correct, not a bug. */
  const primaryTrade = listing.trades?.[0];
  let similar: Listing[] = [];

  async function topUp(filters: { suburb?: string; postcode?: string; trade?: string }) {
    if (similar.length >= 3) return;
    const excludeIds = [listing.id, ...similar.map((s) => s.id)];
    let q = supabase.from("directory_listing").select("*").not("id", "in", `(${excludeIds.join(",")})`);
    if (filters.suburb) q = q.eq("suburb", filters.suburb);
    if (filters.postcode) q = q.eq("postcode", filters.postcode);
    if (filters.trade) q = q.contains("trades", [filters.trade]);
    const { data } = await q.limit(3 - similar.length);
    if (data) similar = [...similar, ...(data as Listing[])];
  }

  // 1. Same suburb + same trade (the actually-relevant case)
  if (listing.suburb && primaryTrade) await topUp({ suburb: listing.suburb, trade: primaryTrade });
  // 2. Same suburb, any trade
  if (listing.suburb) await topUp({ suburb: listing.suburb });
  // 3. Same postcode + same trade (a slightly wider net within the same immediate area)
  if (listing.postcode && primaryTrade) await topUp({ postcode: listing.postcode, trade: primaryTrade });
  // 4. Same postcode, any trade
  if (listing.postcode) await topUp({ postcode: listing.postcode });

  const accent    = (primaryTrade && TRADE_COLORS[primaryTrade]) || "#0a1722";
  const tradeLabel = (primaryTrade && TRADE_LABELS[primaryTrade]) ?? primaryTrade;
  const domain    = listing.website_url ? domainFromUrl(listing.website_url) : null;
  const photos    = listing.photo_references?.filter(Boolean) ?? [];
  const reviews   = listing.place_id ? await getPlaceReviews(listing.place_id) : [];

  return (
    <main className="min-h-screen bg-[var(--app-bg)]">
      <MarketingNav />

      {/* HERO BANNER */}
      <section className="bg-[#0a1722] text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[12.5px] text-white/50 mb-6">
            <Link href="/directory" className="hover:text-white/80 transition-colors">Directory</Link>
            <span>/</span>
            <span className="text-white/30">{listing.business_name}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            {/* Left */}
            <div className="flex-1">
              {tradeLabel && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm capitalize">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
                    {tradeLabel}
                  </span>
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                    <ShieldCheck size={12} /> Curated on Swiftscope
                  </span>
                </div>
              )}

              <h1 className="font-display text-[2.4rem] sm:text-[3rem] leading-tight mb-3">
                {listing.business_name}
              </h1>

              {listing.suburb && (
                <p className="flex items-center gap-1.5 text-[14px] text-white/60 mb-4">
                  <MapPin size={14} className="text-white/40" /> {listing.suburb}
                </p>
              )}

              {listing.google_rating && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5">
                    <Stars rating={listing.google_rating} />
                    <span className="text-[15px] font-bold">{listing.google_rating.toFixed(1)}</span>
                    {listing.google_reviews_count != null && (
                      <span className="text-[12.5px] text-white/50">({listing.google_reviews_count.toLocaleString()} reviews)</span>
                    )}
                  </div>
                  {listing.place_id && (
                    <a href={getGoogleReviewsUrl(listing.place_id)} target="_blank" rel="noopener noreferrer"
                      className="text-[12.5px] text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors">
                      See on Google
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Right CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              {QUOTE_REQUESTS_ENABLED && (
                <a href="#quote-form"
                  className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap">
                  <MessageSquare size={15} /> Request a quote
                </a>
              )}
              {listing.scraped_contact_phone && (
                <a href={`tel:${listing.scraped_contact_phone}`}
                  className={`${QUOTE_REQUESTS_ENABLED ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#ffb400] text-[#0a1722] hover:opacity-90"} font-bold text-[14px] px-6 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap`}>
                  <Phone size={15} /> Call now
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* INFO CARDS ROW */}
      <section className="border-b border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Services */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 reveal">
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={16} className="text-[#ffb400]" />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Services</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(listing.trades as string[] | null)?.map((t: string) => (
                  <span key={t} className="text-[12.5px] font-semibold px-2.5 py-1 rounded-lg bg-gray-50 text-gray-700 border border-gray-100 capitalize">
                    {TRADE_LABELS[t] ?? t}
                  </span>
                ))}
                {(!listing.trades || listing.trades.length === 0) && (
                  <span className="text-[12.5px] text-gray-400">General trade services</span>
                )}
              </div>
            </div>

            {/* Areas */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 reveal" style={{ animationDelay: "60ms" }}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-[#ffb400]" />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Service Area</p>
              </div>
              <p className="text-[14px] font-semibold text-gray-800 flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" /> {listing.suburb ?? "Melbourne area"}
              </p>
              <p className="text-[12px] text-gray-400 mt-1">Based in this area - services surrounding suburbs</p>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 reveal" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center gap-2 mb-3">
                <Phone size={16} className="text-[#ffb400]" />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Contact</p>
              </div>
              <div className="space-y-2">
                {listing.scraped_contact_phone && (
                  <a href={`tel:${listing.scraped_contact_phone}`} className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 hover:text-[#0a1722] transition-colors">
                    <Phone size={13} className="text-gray-400" /> {listing.scraped_contact_phone}
                  </a>
                )}
                {listing.website_url && domain && (
                  <a href={listing.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 hover:text-[#0a1722] transition-colors">
                    <Globe size={13} className="text-gray-400" /> {domain} <ExternalLink size={11} className="text-gray-300" />
                  </a>
                )}
                {!listing.scraped_contact_phone && !listing.website_url && (
                  <p className="text-[12.5px] text-gray-400">
                    {QUOTE_REQUESTS_ENABLED ? "No contact details on file. Request a quote above." : "No contact details on file."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TWO-COLUMN LAYOUT */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT COLUMN */}
          <div className="flex-1 min-w-0 space-y-8">
            {listing.blurb && (
              <div className="reveal">
                <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">About</p>
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-line">{listing.blurb}</p>
                </div>
              </div>
            )}

            {photos.length > 0 && <PhotoGallery photos={photos} name={listing.business_name} />}

            <ReviewsSection reviews={reviews} />

            {QUOTE_REQUESTS_ENABLED && (
              <div id="quote-form">
                <QuoteForm listing={{ id: listing.id, business_name: listing.business_name, scraped_contact_email: listing.scraped_contact_email }} />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (sticky) */}
          <div className="w-full lg:w-80 shrink-0 space-y-5">
            <div className="lg:sticky lg:top-6 space-y-5">
              {/* Business Info Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 reveal">
                <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl mb-4 overflow-hidden">
                  <ListingLogo logoUrl={listing.logo_url} businessName={listing.business_name} accent={accent} />
                </div>
                <h3 className="font-bold text-[15px] text-gray-900 text-center mb-1">{listing.business_name}</h3>
                {listing.google_rating && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Stars rating={listing.google_rating} />
                    <span className="text-[13px] font-bold text-gray-700">{listing.google_rating.toFixed(1)}</span>
                    {listing.google_reviews_count != null && (
                      <span className="text-[12px] text-gray-400">({listing.google_reviews_count.toLocaleString()})</span>
                    )}
                  </div>
                )}
                {listing.trades && listing.trades.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mb-4">
                    {(listing.trades as string[]).map((t: string) => (
                      <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100 capitalize">
                        {TRADE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  {listing.scraped_contact_phone && (
                    <a href={`tel:${listing.scraped_contact_phone}`} className="flex items-center justify-center gap-2 w-full bg-[#0a1722] text-white font-bold text-[13px] py-3 rounded-xl hover:opacity-90 transition-opacity">
                      <Phone size={14} /> Call
                    </a>
                  )}
                  {listing.website_url && (
                    <a href={listing.website_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 text-gray-700 font-bold text-[13px] py-2.5 rounded-xl hover:border-gray-400 transition-colors">
                      <Globe size={14} /> Visit website
                    </a>
                  )}
                  {listing.place_id && (
                    <a href={`https://maps.google.com/?place_id=${listing.place_id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 text-gray-700 font-bold text-[13px] py-2.5 rounded-xl hover:border-gray-400 transition-colors">
                      <MapPin size={14} /> View on Google Maps
                    </a>
                  )}
                </div>
              </div>

              {/* Trust Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 reveal" style={{ animationDelay: "80ms" }}>
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-3">Trust &amp; verification</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Check size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">Curated business</p>
                      <p className="text-[11.5px] text-gray-400">Contact details checked and confirmed</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Star size={14} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">Google reviews checked</p>
                      <p className="text-[11.5px] text-gray-400">Ratings sourced directly from Google</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <Shield size={14} className="text-[#ffb400]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">Swiftscope curated</p>
                      <p className="text-[11.5px] text-gray-400">Listed in our curated directory</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SIMILAR TRADIES */}
      {similar && similar.length > 0 && (
        <section className="border-t border-[var(--line)] bg-[var(--app-bg)]">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex items-center gap-2 mb-6">
              <Users size={18} className="text-[#ffb400]" />
              <h2 className="font-display text-[1.5rem] text-gray-900">
                {listing.suburb ? `Similar tradies in ${listing.suburb}` : tradeLabel ? `More ${tradeLabel}s` : "Similar tradies"}
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((s: Listing, i: number) => (
                <DirectoryCard key={s.id} listing={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BOTTOM CTA */}
      <section className="border-t border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="bg-[#0a1722] rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <p className="font-display text-[1.6rem] text-white mb-1">Need a different trade?</p>
              <p className="text-white/60 text-[14px] max-w-sm">Browse our full directory of curated listings across Melbourne&apos;s south east.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link href="/directory" className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-7 py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap">
                <Search size={15} /> Browse full directory
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TradieSchema
        businessName={listing.business_name}
        trade={primaryTrade ?? "builder"}
        suburb={listing.suburb ?? ""}
        postcode={listing.postcode}
        phone={listing.scraped_contact_phone}
        website={listing.website_url}
        logo={listing.logo_url}
        googleRating={listing.google_rating}
        reviewCount={listing.google_reviews_count}
        lat={listing.latitude}
        lng={listing.longitude}
        slug={listing.id}
        reviews={reviews}
      />
    </main>
  );
}
