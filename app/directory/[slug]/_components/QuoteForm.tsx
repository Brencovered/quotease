"use client";

import { useState } from "react";
import { Check, MessageSquare, Send } from "lucide-react";

type Listing = {
  id: string;
  business_name: string;
  scraped_contact_email: string | null;
};

export default function QuoteForm({ listing }: { listing: Listing }) {
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-[12.5px] text-red-700 font-semibold">{error}</p>
            <p className="text-[11.5px] text-red-500 mt-1">
              Your request has been saved and our team will follow up. You can also email hello@swiftscope.com.au
            </p>
          </div>
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
