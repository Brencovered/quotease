"use client";

import { useState } from "react";
import { Check, MessageSquare, Phone, Send } from "lucide-react";

type Listing = {
  id: string;
  business_name: string;
  scraped_contact_email: string | null;
  is_claimed?: boolean;
  owner_email?: string | null;
  scraped_contact_phone?: string | null;
};

const URGENCY = [
  { id: "asap", label: "Ready to start soon" },
  { id: "checking", label: "Just checking prices" },
  { id: "later", label: "Planning ahead" },
] as const;

export default function QuoteForm({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobType, setJobType] = useState("");
  const [budget, setBudget] = useState("");
  const [urgency, setUrgency] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [showExtras, setShowExtras] = useState(false);

  async function submit() {
    if (!name || !email || !jobType || !urgency) {
      setError("Please fill in name, email, job description, and where you are at.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setError("");
    // Claimed listing: goes straight to the account's real email, not the
    // (possibly stale) scraped contact address. Unclaimed: the API route
    // itself falls back to Swiftscope's inbox if the scraped address is
    // missing/invalid, and includes a claim-your-page nudge.
    const toEmail = listing.is_claimed && listing.owner_email ? listing.owner_email : listing.scraped_contact_email;
    const res = await fetch("/api/directory/enquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id: listing.id,
        business_name: listing.business_name,
        to_email: toEmail,
        is_claimed: listing.is_claimed ?? false,
        name,
        email,
        phone,
        jobType,
        budget,
        urgency,
        customerType,
      }),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not send. Try again, or email team@swiftscope.com.au.");
    }
  }

  if (sent) {
    return (
      <div className={`bg-white rounded-2xl border border-gray-100 text-center ${compact ? "p-6" : "p-8"}`}>
        <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={24} className="text-green-600" />
        </div>
        <p className="font-bold text-[17px] text-gray-900 mb-1">
          Quote request sent
        </p>
        <p className="text-[14px] text-gray-500 mb-1">
          {listing.business_name} will be in touch shortly.
        </p>
        <p className="text-[12.5px] text-gray-400">
          {listing.is_claimed
            ? "Your details go directly to the tradie. Swiftscope never shares them with anyone else."
            : "Swiftscope will pass this quote request on to them for you."}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 ${compact ? "p-5" : "p-6"}`}>
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#0a1722] flex items-center justify-center shrink-0">
          <MessageSquare size={15} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-[15px] text-gray-900 leading-tight">
            Get a quote from {listing.business_name}
          </p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Free to send. No account needed. They come back with a price.
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2 mb-4">
        {[
          { n: "1", t: "Describe the job" },
          { n: "2", t: "They get the request" },
          { n: "3", t: "They reply with a price" },
        ].map((step) => (
          <li key={step.n} className="rounded-lg bg-[#f6f8fa] px-2 py-2 text-center">
            <p className="text-[10px] font-extrabold text-[#ffb400]">{step.n}</p>
            <p className="text-[10.5px] font-semibold text-gray-600 leading-snug">{step.t}</p>
          </li>
        ))}
      </ol>

      <div className="space-y-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name *"
          autoComplete="name"
          className="app-field text-[13px]"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address *"
          type="email"
          autoComplete="email"
          className="app-field text-[13px]"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          type="tel"
          autoComplete="tel"
          className="app-field text-[13px]"
        />

        <textarea
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          placeholder="What needs doing, roughly how big, and when *"
          rows={compact ? 3 : 4}
          className="app-field text-[13px] resize-none"
        />

        <div>
          <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Where are you at? *
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {URGENCY.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setUrgency(o.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[12.5px] font-semibold border transition-all ${
                  urgency === o.id
                    ? "border-[#0a1722] bg-[#0a1722] text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="text-[12.5px] font-semibold text-[#0a1722] hover:underline"
        >
          {showExtras ? "Hide extra details" : "Add budget or job type (optional)"}
        </button>

        {showExtras && (
          <div className="space-y-3 pt-1">
            <div>
              <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Budget
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {["Under $500", "$500-$2k", "$2k-$10k", "$10k+", "Not sure"].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b === budget ? "" : b)}
                    className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                      budget === b
                        ? "border-[#0a1722] bg-[#0a1722] text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Job type
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {["Residential", "Commercial"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCustomerType(t === customerType ? "" : t)}
                    className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                      customerType === t
                        ? "border-[#0a1722] bg-[#0a1722] text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-[12.5px] text-red-700 font-semibold">{error}</p>
          </div>
        )}

        <button
          onClick={submit}
          disabled={sending}
          className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Send size={14} /> {sending ? "Sending..." : "Send quote request"}
        </button>

        <p className="text-[11.5px] text-gray-400 text-center leading-snug">
          {listing.is_claimed
            ? `Your details go directly to ${listing.business_name} only.`
            : `Swiftscope will pass this quote on to ${listing.business_name} for you.`}
        </p>

        {listing.scraped_contact_phone && (
          <a
            href={`tel:${listing.scraped_contact_phone}`}
            className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-gray-600 hover:text-[#0a1722]"
          >
            <Phone size={13} /> Prefer to talk? Call {listing.scraped_contact_phone}
          </a>
        )}
      </div>
    </div>
  );
}
