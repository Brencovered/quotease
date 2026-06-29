"use client";

import { useState } from "react";
import { MapPin, Star, Phone, Globe, Mail, ChevronLeft, ChevronRight, X, Send, Check, BadgeCheck, MessageSquare } from "lucide-react";

const TRADE_LABELS: Record<string,string> = {
  electrician:"Electrician", plumber:"Plumber", builder:"Builder",
  roofer:"Roofer", painter:"Painter", carpenter:"Carpenter",
  tiler:"Tiler", landscaper:"Landscaper", concreter:"Concreter",
  fencer:"Fencer", plasterer:"Plasterer", handyman:"Handyman",
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

function PhotoSlider({ refs, name }: { refs: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const photos = refs.slice(0, 3);
  return (
    <div className="relative h-48 bg-gray-100 overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/places/photo?ref=${photos[idx]}&maxw=600`}
        alt={name} loading="lazy"
        className="w-full h-full object-cover"
      />
      {photos.length > 1 && (
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

// Logo hero: tries to render the business's actual logo (sourced from their
// own website's icon, since the free Clearbit Logo API that most projects
// used for this was shut down in Dec 2025). Falls back through two no-key
// favicon services, then to the photo slider, then to a plain letter tile.
// Each stage only kicks in on a real load failure (onError), not preemptively.
function LogoHero({ listing }: { listing: Listing }) {
  const domain = listing.website_url ? domainFromUrl(listing.website_url) : null;
  const photos = listing.photo_references?.filter(Boolean) ?? [];
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0: DuckDuckGo icon, 1: Google favicon, 2: exhausted

  if (!domain || stage === 2) {
    // No website to source a logo from, or both logo services failed.
    return photos.length > 0 ? (
      <PhotoSlider refs={photos} name={listing.business_name} />
    ) : (
      <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
        <span className="font-display text-[3.5rem] text-slate-300">
          {listing.business_name.charAt(0)}
        </span>
      </div>
    );
  }

  const src = stage === 0
    ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div className="h-36 bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={listing.business_name}
        loading="lazy"
        onError={() => setStage(s => (s === 0 ? 1 : 2))}
        className="max-h-20 max-w-[60%] object-contain"
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
              placeholder="Describe the job — what needs doing, size of the job, any special requirements *"
              rows={3} className="app-field text-[13px] resize-none" />

            <div>
              <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget</p>
              <div className="grid grid-cols-3 gap-1.5">
                {["Under $500","$500–$2k","$2k–$10k","$10k+","Not sure"].map(b => (
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
                  ["ready","Ready to go — just need the right tradie"],
                  ["warm","Exploring options — comparing a few quotes"],
                  ["planning","Planning ahead — not urgent yet"],
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
                {["Just you","1–2 others","3+ others"].map(o => (
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

export default function DirectoryCard({ listing }: { listing: Listing }) {
  const [showEnquiry, setShowEnquiry] = useState(false);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">

        {/* Logo / header area */}
        <div className="relative border-b border-gray-50">
          <LogoHero listing={listing} />

          {/* Trade badge */}
          {listing.trades?.length && (
            <div className="absolute top-3 right-3">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-gray-700 shadow-sm capitalize">
                {TRADE_LABELS[listing.trades[0]] ?? listing.trades[0]}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">

          {/* Name + verified */}
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

          {/* Rating */}
          {listing.google_rating && (
            <div className="flex items-center gap-2 mb-3">
              <Stars rating={listing.google_rating} />
              <span className="text-[13px] font-bold text-gray-800">{listing.google_rating.toFixed(1)}</span>
              {listing.google_reviews_count != null && (
                <span className="text-[12px] text-gray-400">({listing.google_reviews_count.toLocaleString()} reviews)</span>
              )}
            </div>
          )}

          {/* Blurb */}
          {listing.blurb && (
            <p className="text-[12.5px] text-gray-600 leading-relaxed mb-3 line-clamp-2 flex-1">{listing.blurb}</p>
          )}

          {/* Actions */}
          <div className="mt-auto space-y-2 pt-3 border-t border-gray-50">
            <button onClick={() => setShowEnquiry(true)}
              className="w-full bg-[#0a1722] text-white font-bold text-[13.5px] py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              <MessageSquare size={14} /> Request a quote
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
