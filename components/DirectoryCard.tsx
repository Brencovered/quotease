"use client";

import { useState, useEffect, useMemo } from "react";
import { MapPin, Star, Phone, Globe, Mail, ChevronLeft, ChevronRight, X, Send, Check, BadgeCheck, MessageSquare } from "lucide-react";
import { getGoogleReviewsUrl } from "@/lib/seo/gbp";

const TRADE_LABELS: Record<string,string> = {
  electrician:"Electrician", plumber:"Plumber", builder:"Builder",
  roofer:"Roofer", painter:"Painter", carpenter:"Carpenter",
  tiler:"Tiler", landscaper:"Landscaper", concreter:"Concreter",
  fencer:"Fencer", plasterer:"Plasterer", handyman:"Handyman",
};

// A small accent colour per trade so the grid doesn't read as one flat wall
// of white cards - used for the top accent bar and the trade pill dot.
const TRADE_COLORS: Record<string,string> = {
  electrician:"#f59e0b", plumber:"#3b82f6", builder:"#64748b",
  roofer:"#ef4444", painter:"#a855f7", carpenter:"#92400e",
  tiler:"#06b6d4", landscaper:"#16a34a", concreter:"#71717a",
  fencer:"#854d0e", plasterer:"#ec4899", handyman:"#0a1722",
};

type Listing = {
  id: string; business_name: string; trades: string[] | null;
  suburb: string | null; scraped_contact_phone: string | null;
  website_url: string | null; scraped_contact_email: string | null;
  google_rating: number | null; google_reviews_count: number | null;
  photo_references: string[] | null; place_id: string | null;
  blurb: string | null; logo_url: string | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          className={i <= Math.floor(rating) ? "fill-[#f59e0b] text-[#f59e0b]" :
            (i === Math.floor(rating)+1 && rating%1>=0.5) ? "fill-[#f59e0b]/50 text-[#f59e0b]" :
            "text-gray-200 fill-gray-200"} />
      ))}
    </span>
  );
}

// Rating row doubles as a link straight to this business's Google reviews.
// `search.google.com/local/reviews?placeid=` is the standard (if unofficial)
// pattern for jumping to a reviews list rather than the write-a-review flow - 
// no API key needed, and it degrades gracefully to a normal Maps search if
// Google ever changes the behaviour.
function RatingLink({ rating, count, placeId }: { rating: number; count: number | null; placeId: string | null }) {
  const inner = (
    <>
      <Stars rating={rating} />
      <span className="text-[13px] font-bold text-gray-800">{rating.toFixed(1)}</span>
      {count != null && (
        <span className="text-[12px] text-gray-400 group-hover:text-gray-600 group-hover:underline">
          ({count.toLocaleString()} reviews)
        </span>
      )}
    </>
  );
  if (!placeId) return <div className="flex items-center gap-2 mb-3">{inner}</div>;
  return (
    <a href={getGoogleReviewsUrl(placeId)} target="_blank" rel="noopener noreferrer"
      className="group flex items-center gap-2 mb-3 w-fit -ml-1 px-1 rounded-md hover:bg-amber-50/80 transition-colors">
      {inner}
    </a>
  );
}

function PhotoSlider({ refs, name, onFirstLoad, onFirstError, visible = true }: {
  refs: string[]; name: string;
  onFirstLoad?: () => void; onFirstError?: () => void; visible?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const photos = refs.slice(0, 3);
  return (
    <div className="relative h-40 bg-gray-100 overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/places/photo?ref=${photos[idx]}&maxw=600`}
        alt={name}
        onLoad={idx === 0 ? onFirstLoad : undefined}
        onError={idx === 0 ? onFirstError : undefined}
        className={`w-full h-full object-cover transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      {visible && photos.length > 1 && (
        <>
          <button onClick={e => { e.preventDefault(); setIdx((idx-1+photos.length)%photos.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={14} />
          </button>
          <button onClick={e => { e.preventDefault(); setIdx((idx+1)%photos.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_,i) => (
              <button key={i} onClick={e => { e.preventDefault(); setIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full ${i===idx?"bg-white":"bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Extracts a bare domain from a stored website URL, e.g.
// "https://www.acmeelectrical.com.au/contact" -> "acmeelectrical.com.au"
function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// When neither the business's own logo nor a Google photo is available, show
// a small branded Swiftscope cover instead of a bare initial letter - it
// reads as "this listing is taken care of" rather than "something's missing".
function SwiftscopeCover({ trade }: { trade?: string }) {
  const accent = (trade && TRADE_COLORS[trade]) || "#ffb400";
  return (
    <div className="h-40 relative overflow-hidden flex items-center justify-center bg-[#0a1722]">
      <div className="absolute inset-0 opacity-[0.16]"
        style={{ backgroundImage: `radial-gradient(circle at 20% 25%, ${accent} 0%, transparent 45%), radial-gradient(circle at 85% 80%, ${accent} 0%, transparent 40%)` }} />
      <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full border-[10px] border-white/[0.04]" />
      <p className="relative font-display text-[1.6rem] text-[#ffb400] tracking-wide">Swiftscope</p>
    </div>
  );
}

// Logo hero: works through a small ladder of attempts and always lands on
// something - never a bare letter, never an indefinite spinner.
//
//   1. Google's favicon service (s2.favicons) - tried FIRST because Google's
//      own domain is essentially never blocked by corporate firewalls,
//      privacy extensions, or DNS filters, unlike step 2.
//   2. DuckDuckGo's icon service - a good secondary source, but it turns out
//      to be blocked outright on some networks. A blocked request often
//      doesn't fire a clean onError either, so without a hard timeout the
//      card would be stuck on a loading shimmer forever (this was the
//      "grey circle with an arrow" - a Photoslider nav button left visible
//      behind a hung, invisible image).
//   3. A real Google Places photo, if one exists.
//   4. A branded Swiftscope cover - guaranteed to render, no network call.
//
// A logo only "counts" if it loads AND isn't one of those services' tiny
// (~16px) generic "no icon found" placeholders.
type Attempt = { kind: "favicon"; src: string } | { kind: "photo" } | { kind: "cover" };
const MIN_LOGO_PX = 32;
const ATTEMPT_TIMEOUT_MS = 4000;

function LogoHero({ listing }: { listing: Listing }) {
  const domain = listing.website_url ? domainFromUrl(listing.website_url) : null;
  const photos = listing.photo_references?.filter(Boolean) ?? [];

  const attempts = useMemo<Attempt[]>(() => {
    const list: Attempt[] = [];
    if (domain) {
      list.push({ kind: "favicon", src: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` });
      list.push({ kind: "favicon", src: `https://icons.duckduckgo.com/ip3/${domain}.ico` });
    }
    if (photos.length > 0) list.push({ kind: "photo" });
    list.push({ kind: "cover" });
    return list;
  }, [domain, photos.length]);

  const [stageIdx, setStageIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const attempt = attempts[Math.min(stageIdx, attempts.length - 1)];

  const advance = () => { setLoaded(false); setStageIdx(i => Math.min(i + 1, attempts.length - 1)); };

  // Hard timeout safety net - see note above on why onError alone isn't
  // trustworthy here. Re-armed on every stage change, cleared on success.
  useEffect(() => {
    if (attempt.kind === "cover" || loaded) return;
    const t = setTimeout(advance, ATTEMPT_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIdx, loaded]);

  if (attempt.kind === "cover") return <SwiftscopeCover trade={listing.trades?.[0]} />;

  if (attempt.kind === "photo") {
    return (
      <div className="relative">
        {!loaded && <div className="absolute inset-0 shimmer z-10" />}
        <PhotoSlider refs={photos} name={listing.business_name}
          onFirstLoad={() => setLoaded(true)} onFirstError={advance} visible={loaded} />
      </div>
    );
  }

  return (
    <div className="h-40 bg-gradient-to-br from-slate-50 to-white flex items-center justify-center relative">
      {!loaded && <div className="absolute inset-0 shimmer" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt.src}
        src={attempt.src}
        alt={listing.business_name}
        onError={advance}
        onLoad={e => {
          if (e.currentTarget.naturalWidth < MIN_LOGO_PX) advance();
          else setLoaded(true);
        }}
        className={`max-h-28 max-w-[72%] object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function EnquiryModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [jobType, setJobType] = useState("");
  const [budget,  setBudget]  = useState("");
  const [stage,   setStage]   = useState("");
  const [others,  setOthers]  = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function submit() {
    if (!name || !email || !jobType) { setError("Please fill in your name, email and job description."); return; }
    setSending(true); setError("");
    const res = await fetch("/api/directory/enquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listing.id, business_name: listing.business_name,
        to_email: listing.scraped_contact_email, name, email, phone, jobType, budget, stage, others, message }),
    });
    setSending(false);
    if (res.ok) { setSent(true); }
    else { const d = await res.json().catch(()=>({})); setError(d.error ?? "Failed to send. Try again."); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-[15px] text-gray-900">Request a quote</p>
            <p className="text-[12.5px] text-gray-500">{listing.business_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><X size={16} /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-600" />
            </div>
            <p className="font-bold text-[17px] text-gray-900 mb-1">Enquiry sent!</p>
            <p className="text-[14px] text-gray-500 mb-5">{listing.business_name} will be in touch shortly.</p>
            <button onClick={onClose} className="px-6 py-2.5 border border-gray-200 rounded-xl text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="space-y-2.5">
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name *" className="app-field text-[13px]" />
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address *" type="email" className="app-field text-[13px]" />
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone number" type="tel" className="app-field text-[13px]" />
            </div>

            <textarea value={jobType} onChange={e=>setJobType(e.target.value)}
              placeholder="Describe the job - what needs doing, size of the job, any special requirements *"
              rows={3} className="app-field text-[13px] resize-none" />

            <div>
              <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget</p>
              <div className="grid grid-cols-3 gap-1.5">
                {["Under $500","$500-$2k","$2k-$10k","$10k+","Not sure"].map(b => (
                  <button key={b} onClick={()=>setBudget(b)}
                    className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition-all ${budget===b?"border-gray-900 bg-gray-900 text-white":"border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Where are you at?</p>
              <div className="space-y-1.5">
                {[
                  ["ready","Ready to go - just need the right tradie"],
                  ["warm","Exploring options - comparing a few quotes"],
                  ["planning","Planning ahead - not urgent yet"],
                ].map(([v,l]) => (
                  <button key={v} onClick={()=>setStage(v)}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all text-left text-[13px] font-semibold ${stage===v?"border-gray-900 bg-gray-900 text-white":"border-gray-200 text-gray-700 hover:border-gray-400"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Other quotes?</p>
              <div className="flex gap-2">
                {["Just you","1-2 others","3+ others"].map(o => (
                  <button key={o} onClick={()=>setOthers(o)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-all ${others===o?"border-gray-900 bg-gray-900 text-white":"border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <textarea value={message} onChange={e=>setMessage(e.target.value)}
              placeholder="Anything else? (optional)" rows={2} className="app-field text-[13px] resize-none" />

            {error && <p className="text-[12.5px] text-red-600 font-semibold">{error}</p>}

            <button onClick={submit} disabled={sending}
              className="w-full bg-[#0a1722] text-white font-bold text-[14px] py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
              <Send size={14} /> {sending ? "Sending..." : "Send enquiry"}
            </button>
            <p className="text-[11.5px] text-gray-400 text-center">Your details go directly to {listing.business_name} only.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DirectoryCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const [showEnquiry, setShowEnquiry] = useState(false);
  const primaryTrade = listing.trades?.[0];
  const accent = (primaryTrade && TRADE_COLORS[primaryTrade]) || "#0a1722";

  return (
    <>
      <div
        className="reveal bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-gray-200 transition-all duration-200 overflow-hidden flex flex-col"
        style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      >
        {/* Trade accent bar */}
        <div className="h-[3px] w-full" style={{ background: accent }} />

        {/* Logo / header area */}
        <div className="relative border-b border-gray-50">
          <LogoHero listing={listing} />

          {/* Trade badge */}
          {listing.trades?.length && (
            <div className="absolute top-3 right-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-gray-700 shadow-sm capitalize">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                {TRADE_LABELS[listing.trades[0]] ?? listing.trades[0]}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">

          {/* Name + listing */}
          <div className="flex items-start gap-2 mb-1">
            <h2 className="font-bold text-[15px] text-gray-900 leading-snug flex-1">{listing.business_name}</h2>
            <BadgeCheck size={16} className="text-blue-500 shrink-0 mt-0.5" />
          </div>

          {/* Location */}
          {listing.suburb && (
            <p className="text-[12.5px] text-gray-500 flex items-center gap-1 mb-2">
              <MapPin size={11} className="text-gray-400" /> {listing.suburb}
            </p>
          )}

          {/* Rating - clickable through to Google reviews */}
          {listing.google_rating && (
            <RatingLink rating={listing.google_rating} count={listing.google_reviews_count} placeId={listing.place_id} />
          )}

          {/* Blurb */}
          {listing.blurb && (
            <p className="text-[12.5px] text-gray-600 leading-relaxed mb-3 line-clamp-2 flex-1">{listing.blurb}</p>
          )}

          {/* Actions */}
          <div className="mt-auto space-y-2 pt-3 border-t border-gray-50">
            <button onClick={() => setShowEnquiry(true)}
              className="group w-full bg-[#0a1722] text-white font-bold text-[13.5px] py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#132538] active:scale-[0.98] transition-all">
              <MessageSquare size={14} className="group-hover:rotate-[-6deg] transition-transform" /> Request a quote
            </button>

            <div className="flex gap-2 justify-center flex-wrap">
              {listing.scraped_contact_phone && (
                <a href={`tel:${listing.scraped_contact_phone}`}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <Phone size={12} /> Call
                </a>
              )}
              {listing.website_url && (
                <a href={listing.website_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <Globe size={12} /> Website
                </a>
              )}
              {listing.scraped_contact_email && (
                <a href={`mailto:${listing.scraped_contact_email}`}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <Mail size={12} /> Email
                </a>
              )}
              {listing.place_id && (
                <a href={`https://maps.google.com/?place_id=${listing.place_id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Maps
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEnquiry && <EnquiryModal listing={listing} onClose={() => setShowEnquiry(false)} />}
    </>
  );
}
