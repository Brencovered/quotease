"use client";

import { useState } from "react";
import { MapPin, Star, Phone, Globe, Mail, ChevronLeft, ChevronRight, X, Send, Check } from "lucide-react";

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
  photo_references: string[] | null; place_id: string | null; blurb: string | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          className={i <= Math.floor(rating) ? "fill-[#ffb400] text-[#ffb400]" :
            (i === Math.floor(rating)+1 && rating%1>=0.5) ? "fill-[#ffb400]/50 text-[#ffb400]" :
            "text-[var(--line)]"} />
      ))}
    </span>
  );
}

function PhotoSlider({ refs, name }: { refs: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const photos = refs.slice(0, 3);
  return (
    <div className="relative h-44 bg-[var(--app-bg)] overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/places/photo?ref=${photos[idx]}&maxw=600`}
        alt={name} loading="lazy"
        className="w-full h-full object-cover transition-opacity duration-300"
      />
      {photos.length > 1 && (
        <>
          <button onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setIdx((idx + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EnquiryModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [jobType,   setJobType]   = useState("");
  const [budget,    setBudget]    = useState("");
  const [stage,     setStage]     = useState("");
  const [others,    setOthers]    = useState("");
  const [message,   setMessage]   = useState("");
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState("");

  async function submit() {
    if (!name || !email || !jobType) { setError("Please fill in your name, email and job description."); return; }
    setSending(true); setError("");
    const res = await fetch("/api/directory/enquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id:    listing.id,
        business_name: listing.business_name,
        to_email:      listing.scraped_contact_email,
        name, email, phone, jobType, budget, stage, others, message,
      }),
    });
    setSending(false);
    if (res.ok) { setSent(true); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to send. Try again."); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <div>
            <p className="font-bold text-[15px] text-[var(--ink)]">Request a quote</p>
            <p className="text-[12.5px] text-[var(--ink-faint)]">{listing.business_name}</p>
          </div>
          <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)]"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-[var(--green-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-[var(--green)]" />
            </div>
            <p className="font-bold text-[16px] text-[var(--ink)] mb-1">Enquiry sent!</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] mb-5">
              {listing.business_name} will be in touch shortly.
            </p>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Your details */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Your details</p>
              <div className="space-y-2">
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name *" className="app-field text-[13px]" />
                <input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Your email *" type="email" className="app-field text-[13px]" />
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="Your phone (optional)" type="tel" className="app-field text-[13px]" />
              </div>
            </div>

            {/* Job details */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">About the job</p>
              <textarea value={jobType} onChange={e => setJobType(e.target.value)}
                placeholder="What do you need done? *" rows={3}
                className="app-field text-[13px] resize-none" />
            </div>

            {/* Budget */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Budget</p>
              <div className="grid grid-cols-2 gap-2">
                {["Under $500","$500-$2k","$2k-$10k","$10k+","Not sure yet"].map(b => (
                  <button key={b} onClick={() => setBudget(b)}
                    className={`px-3 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors text-left ${budget === b ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Where are you at?</p>
              <div className="grid grid-cols-1 gap-2">
                {["Ready to go, just need the right tradie","Exploring options and comparing quotes","Planning ahead, not urgent yet"].map(s => (
                  <button key={s} onClick={() => setStage(s)}
                    className={`px-3 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors text-left ${stage === s ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Other quotes */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Have you spoken to other tradies?</p>
              <div className="flex gap-2">
                {["No, just you","Yes, 1-2 others","Yes, 3+ others"].map(o => (
                  <button key={o} onClick={() => setOthers(o)}
                    className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${others === o ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra */}
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Anything else the tradie should know? (optional)" rows={2}
              className="app-field text-[13px] resize-none" />

            {error && <p className="text-[12.5px] text-[var(--red)] font-semibold">{error}</p>}

            <button onClick={submit} disabled={sending} className="btn-primary w-full justify-center">
              <Send size={14} /> {sending ? "Sending..." : "Send enquiry"}
            </button>
            <p className="text-[11.5px] text-[var(--ink-faint)] text-center">
              Your details are sent directly to {listing.business_name}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DirectoryCard({ listing }: { listing: Listing }) {
  const [showEnquiry, setShowEnquiry] = useState(false);
  const photos = listing.photo_references?.filter(Boolean) ?? [];

  return (
    <>
      <div className="card flex flex-col overflow-hidden p-0">
        {photos.length > 0 ? (
          <PhotoSlider refs={photos} name={listing.business_name} />
        ) : (
          <div className="h-32 bg-gradient-to-br from-[var(--amber-light)] to-[var(--app-bg)] flex items-center justify-center">
            <span className="font-display text-[3rem] text-[var(--amber-deep)] opacity-30">
              {listing.business_name.charAt(0)}
            </span>
          </div>
        )}

        <div className="p-4 flex flex-col flex-1">
          {listing.trades?.length && (
            <span className="inline-block text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--amber-light)] text-[var(--amber-deep)] mb-2 w-fit">
              {listing.trades.map(t => TRADE_LABELS[t] ?? t).join(", ")}
            </span>
          )}

          <h2 className="font-bold text-[15px] text-[var(--ink)] leading-snug mb-1">{listing.business_name}</h2>

          {listing.suburb && (
            <p className="text-[12px] text-[var(--ink-faint)] flex items-center gap-1 mb-2">
              <MapPin size={11} /> {listing.suburb}
            </p>
          )}

          {listing.blurb && (
            <p className="text-[12.5px] text-[var(--ink-soft)] leading-snug mb-2 line-clamp-2">{listing.blurb}</p>
          )}

          {listing.google_rating && (
            <div className="flex items-center gap-1.5 mb-3">
              <Stars rating={listing.google_rating} />
              <span className="text-[12.5px] font-bold text-[var(--ink)]">{listing.google_rating.toFixed(1)}</span>
              {listing.google_reviews_count != null && (
                <span className="text-[12px] text-[var(--ink-faint)]">({listing.google_reviews_count.toLocaleString()})</span>
              )}
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-[var(--line-subtle)] space-y-2">
            {/* Enquire button */}
            <button onClick={() => setShowEnquiry(true)}
              className="btn-primary w-full justify-center text-[13px] py-2.5">
              Request a quote
            </button>

            {/* Secondary contact links */}
            <div className="flex flex-wrap gap-2 items-center">
              {listing.scraped_contact_phone && (
                <a href={`tel:${listing.scraped_contact_phone}`}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[var(--navy)] hover:opacity-70">
                  <Phone size={12} /> {listing.scraped_contact_phone}
                </a>
              )}
              <div className="flex gap-2 ml-auto">
                {listing.scraped_contact_email && (
                  <a href={`mailto:${listing.scraped_contact_email}`}
                    className="flex items-center gap-1 text-[12px] text-[var(--blue)] hover:opacity-70 font-semibold">
                    <Mail size={12} /> Email
                  </a>
                )}
                {listing.website_url && (
                  <a href={listing.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] text-[var(--blue)] hover:opacity-70 font-semibold">
                    <Globe size={12} /> Website
                  </a>
                )}
                {listing.place_id && (
                  <a href={`https://maps.google.com/?place_id=${listing.place_id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[12px] text-[var(--ink-faint)] hover:opacity-70 font-semibold">
                    Maps
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEnquiry && <EnquiryModal listing={listing} onClose={() => setShowEnquiry(false)} />}
    </>
  );
}
