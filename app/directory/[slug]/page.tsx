"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Mail,
  Check,
  Shield,
  ShieldCheck,
  BadgeCheck,
  MessageSquare,
  ExternalLink,
  Send,
  Wrench,
  Building2,
  Users,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MarketingNav from "@/components/MarketingNav";
import DirectoryCard from "@/components/DirectoryCard";
import { tradieListingMeta } from "@/lib/seo/meta";
import { getGoogleReviewsUrl } from "@/lib/seo/gbp";

/* ------------------------------------------------------------------ */
/*  Trade colour / label maps (synced with DirectoryCard)               */
/* ------------------------------------------------------------------ */
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

const TRADE_COLORS: Record<string, string> = {
  electrician: "#f59e0b",
  plumber: "#3b82f6",
  builder: "#64748b",
  roofer: "#ef4444",
  painter: "#a855f7",
  carpenter: "#92400e",
  tiler: "#06b6d4",
  landscaper: "#16a34a",
  concreter: "#71717a",
  fencer: "#854d0e",
  plasterer: "#ec4899",
  handyman: "#0a1722",
};

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
type Listing = {
  id: string;
  business_name: string;
  trades: string[] | null;
  suburb: string | null;
  scraped_contact_phone: string | null;
  website_url: string | null;
  scraped_contact_email: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  photo_references: string[] | null;
  place_id: string | null;
  blurb: string | null;
  logo_url: string | null;
};

/* ------------------------------------------------------------------ */
/*  Reusable star renderer (matches DirectoryCard)                      */
/* ------------------------------------------------------------------ */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={
            i <= Math.floor(rating)
              ? "fill-[#f59e0b] text-[#f59e0b]"
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
/*  Small helpers                                                       */
/* ------------------------------------------------------------------ */
function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Client component - Quote Request Form                               */
/* ------------------------------------------------------------------ */
function QuoteRequestForm({
  listing,
}: {
  listing: Listing;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobType, setJobType] = useState("");
  const [budget, setBudget] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name || !email || !jobType) {
      setError("Please fill in your name, email and job description.");
      return;
    }
    setSending(true);
    setError("");
    const res = await fetch("/api/directory/enquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id: listing.id,
        business_name: listing.business_name,
        to_email: listing.scraped_contact_email,
        name,
        email,
        phone,
        jobType,
        budget,
      }),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to send. Try again.");
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center reveal">
        <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={24} className="text-green-600" />
        </div>
        <p className="font-bold text-[17px] text-gray-900 mb-1">
          Quote request sent!
        </p>
        <p className="text-[14px] text-gray-500 mb-1">
          {listing.business_name} will be in touch shortly.
        </p>
        <p className="text-[12.5px] text-gray-400">
          Your details go directly to the tradie - Swiftscope never shares
          them with anyone else.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 reveal">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#0a1722] flex items-center justify-center">
          <MessageSquare size={15} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-[15px] text-gray-900">
            Request a quote
          </p>
          <p className="text-[12px] text-gray-500">
            From {listing.business_name}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name *"
          className="app-field text-[13px]"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address *"
          type="email"
          className="app-field text-[13px]"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          type="tel"
          className="app-field text-[13px]"
        />

        <textarea
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          placeholder="Describe the job - what needs doing, size of the job, any special requirements *"
          rows={4}
          className="app-field text-[13px] resize-none"
        />

        <div>
          <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Budget (optional)
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {["Under $500", "$500-$2k", "$2k-$10k", "$10k+", "Not sure"].map(
              (b) => (
                <button
                  key={b}
                  onClick={() => setBudget(b === budget ? "" : b)}
                  className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                    budget === b
                      ? "border-[#0a1722] bg-[#0a1722] text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {b}
                </button>
              ),
            )}
          </div>
        </div>

        {error && (
          <p className="text-[12.5px] text-red-600 font-semibold">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={sending}
          className="w-full bg-[#0a1722] text-white font-bold text-[14px] py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Send size={14} /> {sending ? "Sending..." : "Send quote request"}
        </button>

        <p className="text-[11.5px] text-gray-400 text-center">
          Your details go directly to {listing.business_name} only.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Photo gallery (client - uses state for carousel)                    */
/* ------------------------------------------------------------------ */
function PhotoGallery({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}) {
  const [idx, setIdx] = useState(0);
  const visible = photos.slice(0, 6);

  return (
    <div className="reveal">
      <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Photos
      </p>

      {/* Main photo */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/places/photo?ref=${visible[idx]}&maxw=800`}
          alt={`${name} - photo ${idx + 1}`}
          className="w-full h-full object-cover"
        />
        {visible.length > 1 && (
          <>
            <button
              onClick={() =>
                setIdx((i) => (i - 1 + visible.length) % visible.length)
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % visible.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {visible.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === idx ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {visible.length > 1 && (
        <div className="flex gap-2">
          {visible.map((ref, i) => (
            <button
              key={ref}
              onClick={() => setIdx(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                i === idx ? "border-[#ffb400]" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/places/photo?ref=${ref}&maxw=150`}
                alt={`${name} thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Server component - main page                                        */
/* ------------------------------------------------------------------ */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("directory_listing")
    .select("*")
    .eq("id", slug)
    .single();

  if (!listing) return { title: "Not found | Swiftscope" };

  return tradieListingMeta({
    ...listing,
    slug,
  });
}

export default async function TradieProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  /* Fetch the listing */
  const { data: listing } = await supabase
    .from("directory_listing")
    .select("*")
    .eq("id", slug)
    .single();

  if (!listing) notFound();

  /* Fetch similar tradies */
  const primaryTrade = listing.trades?.[0];
  let similarQuery = supabase
    .from("directory_listing")
    .select("*")
    .neq("id", listing.id)
    .limit(3);

  if (primaryTrade) {
    similarQuery = similarQuery.or(
      `trades.cs.{${primaryTrade}},suburb.eq.${listing.suburb}`,
    );
  } else if (listing.suburb) {
    similarQuery = similarQuery.eq("suburb", listing.suburb);
  }

  const { data: similar } = await similarQuery;

  /* Derived values */
  const accent =
    (primaryTrade && TRADE_COLORS[primaryTrade]) || "#0a1722";
  const tradeLabel =
    (primaryTrade && TRADE_LABELS[primaryTrade]) ?? primaryTrade;
  const domain = listing.website_url
    ? domainFromUrl(listing.website_url)
    : null;
  const photos = listing.photo_references?.filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-[var(--app-bg)]">
      <MarketingNav />

      {/* ============================================================ */}
      {/*  HERO BANNER                                                 */}
      {/* ============================================================ */}
      <section className="bg-[#0a1722] text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[12.5px] text-white/50 mb-6">
            <Link
              href="/directory"
              className="hover:text-white/80 transition-colors"
            >
              Directory
            </Link>
            <span>/</span>
            <span className="text-white/30">{listing.business_name}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            {/* Left: name, trade, location, rating */}
            <div className="flex-1">
              {/* Trade badge */}
              {tradeLabel && (
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm capitalize"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: accent }}
                    />
                    {tradeLabel}
                  </span>
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                    <ShieldCheck size={12} /> Verified on Swiftscope
                  </span>
                </div>
              )}

              {/* Business name */}
              <h1 className="font-display text-[2.4rem] sm:text-[3rem] leading-tight mb-3">
                {listing.business_name}
              </h1>

              {/* Suburb */}
              {listing.suburb && (
                <p className="flex items-center gap-1.5 text-[14px] text-white/60 mb-4">
                  <MapPin size={14} className="text-white/40" />
                  {listing.suburb}
                </p>
              )}

              {/* Rating */}
              {listing.google_rating && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5">
                    <Stars rating={listing.google_rating} />
                    <span className="text-[15px] font-bold">
                      {listing.google_rating.toFixed(1)}
                    </span>
                    {listing.google_reviews_count != null && (
                      <span className="text-[12.5px] text-white/50">
                        ({listing.google_reviews_count.toLocaleString()} reviews)
                      </span>
                    )}
                  </div>
                  {listing.place_id && (
                    <a
                      href={getGoogleReviewsUrl(listing.place_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12.5px] text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors"
                    >
                      See on Google
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Right: CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href="#quote-form"
                className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <MessageSquare size={15} /> Request a quote
              </a>
              {listing.scraped_contact_phone && (
                <a
                  href={`tel:${listing.scraped_contact_phone}`}
                  className="bg-white/10 text-white font-bold text-[14px] px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Phone size={15} /> Call now
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  INFO CARDS ROW                                              */}
      {/* ============================================================ */}
      <section className="border-b border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Services card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 reveal">
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={16} className="text-[#ffb400]" />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                  Services
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {listing.trades?.map((t) => (
                  <span
                    key={t}
                    className="text-[12.5px] font-semibold px-2.5 py-1 rounded-lg bg-gray-50 text-gray-700 border border-gray-100 capitalize"
                  >
                    {TRADE_LABELS[t] ?? t}
                  </span>
                ))}
                {(!listing.trades || listing.trades.length === 0) && (
                  <span className="text-[12.5px] text-gray-400">
                    General trade services
                  </span>
                )}
              </div>
            </div>

            {/* Areas card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 reveal" style={{ animationDelay: "60ms" }}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-[#ffb400]" />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                  Service Area
                </p>
              </div>
              <p className="text-[14px] font-semibold text-gray-800 flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" />
                {listing.suburb ?? "Melbourne area"}
              </p>
              <p className="text-[12px] text-gray-400 mt-1">
                Based in this area - services surrounding suburbs
              </p>
            </div>

            {/* Contact card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 reveal" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center gap-2 mb-3">
                <Phone size={16} className="text-[#ffb400]" />
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                  Contact
                </p>
              </div>
              <div className="space-y-2">
                {listing.scraped_contact_phone && (
                  <a
                    href={`tel:${listing.scraped_contact_phone}`}
                    className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 hover:text-[#0a1722] transition-colors"
                  >
                    <Phone size={13} className="text-gray-400" />
                    {listing.scraped_contact_phone}
                  </a>
                )}
                {listing.scraped_contact_email && (
                  <a
                    href={`mailto:${listing.scraped_contact_email}`}
                    className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 hover:text-[#0a1722] transition-colors"
                  >
                    <Mail size={13} className="text-gray-400" />
                    <span className="truncate">{listing.scraped_contact_email}</span>
                  </a>
                )}
                {listing.website_url && domain && (
                  <a
                    href={listing.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 hover:text-[#0a1722] transition-colors"
                  >
                    <Globe size={13} className="text-gray-400" />
                    {domain}
                    <ExternalLink size={11} className="text-gray-300" />
                  </a>
                )}
                {!listing.scraped_contact_phone &&
                  !listing.scraped_contact_email &&
                  !listing.website_url && (
                    <p className="text-[12.5px] text-gray-400">
                      No contact details on file. Request a quote above.
                    </p>
                  )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TWO-COLUMN LAYOUT                                           */}
      {/* ============================================================ */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* --------------- LEFT COLUMN --------------- */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* About / Blurb */}
            {listing.blurb && (
              <div className="reveal">
                <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  About
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-line">
                    {listing.blurb}
                  </p>
                </div>
              </div>
            )}

            {/* Photo Gallery */}
            {photos.length > 0 && (
              <PhotoGallery photos={photos} name={listing.business_name} />
            )}

            {/* Quote Request Form */}
            <div id="quote-form">
              <QuoteRequestForm listing={listing} />
            </div>
          </div>

          {/* --------------- RIGHT COLUMN (sticky) --------------- */}
          <div className="w-full lg:w-80 shrink-0 space-y-5">
            <div className="lg:sticky lg:top-6 space-y-5">
              {/* Business Info Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 reveal">
                {/* Logo or placeholder */}
                <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl mb-4 overflow-hidden">
                  {listing.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={listing.logo_url}
                      alt={listing.business_name}
                      className="max-h-20 max-w-[80%] object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <div
                        className="w-12 h-12 rounded-xl mx-auto mb-1 flex items-center justify-center"
                        style={{ background: accent }}
                      >
                        <Wrench size={20} className="text-white" />
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                        Swiftscope
                      </p>
                    </div>
                  )}
                </div>

                {/* Name */}
                <h3 className="font-bold text-[15px] text-gray-900 text-center mb-1">
                  {listing.business_name}
                </h3>

                {/* Rating */}
                {listing.google_rating && (
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Stars rating={listing.google_rating} />
                    <span className="text-[13px] font-bold text-gray-700">
                      {listing.google_rating.toFixed(1)}
                    </span>
                    {listing.google_reviews_count != null && (
                      <span className="text-[12px] text-gray-400">
                        ({listing.google_reviews_count.toLocaleString()})
                      </span>
                    )}
                  </div>
                )}

                {/* Trade tags */}
                {listing.trades && listing.trades.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mb-4">
                    {listing.trades.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100 capitalize"
                      >
                        {TRADE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Contact buttons */}
                <div className="space-y-2">
                  {listing.scraped_contact_phone && (
                    <a
                      href={`tel:${listing.scraped_contact_phone}`}
                      className="flex items-center justify-center gap-2 w-full bg-[#0a1722] text-white font-bold text-[13px] py-3 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      <Phone size={14} /> Call
                    </a>
                  )}
                  {listing.website_url && (
                    <a
                      href={listing.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 text-gray-700 font-bold text-[13px] py-2.5 rounded-xl hover:border-gray-400 transition-colors"
                    >
                      <Globe size={14} /> Visit website
                    </a>
                  )}
                  {listing.scraped_contact_email && (
                    <a
                      href={`mailto:${listing.scraped_contact_email}`}
                      className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 text-gray-700 font-bold text-[13px] py-2.5 rounded-xl hover:border-gray-400 transition-colors"
                    >
                      <Mail size={14} /> Send email
                    </a>
                  )}
                  {listing.place_id && (
                    <a
                      href={`https://maps.google.com/?place_id=${listing.place_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 text-gray-700 font-bold text-[13px] py-2.5 rounded-xl hover:border-gray-400 transition-colors"
                    >
                      <MapPin size={14} /> View on Google Maps
                    </a>
                  )}
                </div>
              </div>

              {/* Trust Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 reveal" style={{ animationDelay: "80ms" }}>
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Trust &amp; verification
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Check size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">
                        Verified business
                      </p>
                      <p className="text-[11.5px] text-gray-400">
                        Contact details checked and confirmed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Star size={14} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">
                        Google reviews checked
                      </p>
                      <p className="text-[11.5px] text-gray-400">
                        Ratings sourced directly from Google
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <Shield size={14} className="text-[#ffb400]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">
                        Swiftscope verified
                      </p>
                      <p className="text-[11.5px] text-gray-400">
                        Listed in our verified tradie directory
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SIMILAR TRADIES                                             */}
      {/* ============================================================ */}
      {similar && similar.length > 0 && (
        <section className="border-t border-[var(--line)] bg-[var(--app-bg)]">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex items-center gap-2 mb-6">
              <Users size={18} className="text-[#ffb400]" />
              <h2 className="font-display text-[1.5rem] text-gray-900">
                {listing.suburb
                  ? `Similar tradies in ${listing.suburb}`
                  : tradeLabel
                    ? `More ${tradeLabel}s`
                    : "Similar tradies"}
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

      {/* ============================================================ */}
      {/*  BOTTOM CTA                                                  */}
      {/* ============================================================ */}
      <section className="border-t border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="bg-[#0a1722] rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <p className="font-display text-[1.6rem] text-white mb-1">
                Need a different trade?
              </p>
              <p className="text-white/60 text-[14px] max-w-sm">
                Browse our full directory of verified tradies across
                Melbourne&apos;s south east.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/directory"
                className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-7 py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Search size={15} /> Browse full directory
              </Link>
              <Link
                href="/get-quotes"
                className="bg-white/10 text-white font-bold text-[14px] px-7 py-3.5 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                Get quotes <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
