"use client";

import { useEffect, useState } from "react";
import { Camera, Check, FileText, MessageSquare, Phone, Send, X } from "lucide-react";
import {
  isAllowedEnquiryFile,
  MAX_ENQUIRY_FILES,
} from "@/lib/directoryEnquiryPhotos";

type Listing = {
  id: string;
  business_name: string;
  scraped_contact_email: string | null;
  is_claimed?: boolean;
  owner_email?: string | null;
  scraped_contact_phone?: string | null;
  suburb?: string | null;
};

const URGENCY = [
  { id: "asap", label: "Ready to start soon" },
  { id: "checking", label: "Just checking prices" },
  { id: "later", label: "Planning ahead" },
] as const;

const BUDGETS = ["Under $500", "$500-$2k", "$2k-$10k", "$10k+", "Not sure"];

const OTHER_QUOTES = [
  { id: "none", label: "No other quotes yet" },
  { id: "one", label: "I have one quote" },
  { id: "few", label: "I have a few quotes" },
  { id: "comparing", label: "Just comparing" },
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
  const [siteSuburb, setSiteSuburb] = useState(listing.suburb ?? "");
  const [budget, setBudget] = useState("");
  const [urgency, setUrgency] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [otherQuotes, setOtherQuotes] = useState("");
  const [otherQuoteNotes, setOtherQuoteNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    setPreviews(urls);
    return () => {
      for (const url of urls) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [files]);

  function addFiles(picked: File[]) {
    const next: File[] = [];
    for (const file of picked) {
      const problem = isAllowedEnquiryFile(file);
      if (problem) {
        setFileError(problem);
        return;
      }
      next.push(file);
    }
    setFileError("");
    setFiles((prev) => [...prev, ...next].slice(0, MAX_ENQUIRY_FILES));
  }

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
    const toEmail = listing.is_claimed && listing.owner_email ? listing.owner_email : listing.scraped_contact_email;
    const othersLabel = OTHER_QUOTES.find((o) => o.id === otherQuotes)?.label ?? "";
    const others = [othersLabel, otherQuoteNotes.trim()].filter(Boolean).join(". ");

    const fd = new FormData();
    fd.append("listing_id", listing.id);
    fd.append("business_name", listing.business_name);
    if (toEmail) fd.append("to_email", toEmail);
    fd.append("is_claimed", listing.is_claimed ? "true" : "false");
    fd.append("name", name);
    fd.append("email", email);
    fd.append("phone", phone);
    fd.append("jobType", jobType);
    fd.append("site_suburb", siteSuburb);
    fd.append("budget", budget);
    fd.append("urgency", urgency);
    fd.append("customerType", customerType);
    fd.append("others", others);
    fd.append("message", notes);
    for (const file of files) fd.append("photos", file);

    const res = await fetch("/api/directory/enquire", { method: "POST", body: fd });
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
        <p className="font-bold text-[17px] text-gray-900 mb-1">Quote request sent</p>
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
            The more you tell them, the sharper the price. Photos and drawings help a lot.
          </p>
        </div>
      </div>

      <div className="space-y-3">
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
        <input
          value={siteSuburb}
          onChange={(e) => setSiteSuburb(e.target.value)}
          placeholder="Suburb the job is in"
          autoComplete="address-level2"
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
            Photos or drawings
          </p>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 cursor-pointer hover:border-gray-400 transition-colors">
            <Camera size={15} className="text-gray-400" />
            <span className="text-[12.5px] font-semibold text-gray-600">
              Add site photos, a sketch, or a plan
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          {fileError && <p className="text-[12px] text-red-600 font-semibold mt-1.5">{fileError}</p>}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {files.map((file, i) => (
                <div key={`${file.name}-${i}`} className="relative">
                  {previews[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[i]} alt={file.name} className="w-full h-16 object-cover rounded-lg border border-gray-100" />
                  ) : (
                    <div className="w-full h-16 rounded-lg border border-gray-100 bg-gray-50 flex flex-col items-center justify-center px-1">
                      <FileText size={14} className="text-gray-400" />
                      <p className="text-[10px] text-gray-500 truncate w-full text-center">{file.name}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0a1722] text-white flex items-center justify-center"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-1.5">
            Up to {MAX_ENQUIRY_FILES} files. Photos, sketches, or a PDF plan. 10MB each.
          </p>
        </div>

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

        <div>
          <p className="text-[11.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Budget
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {BUDGETS.map((b) => (
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
            Already got quotes?
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {OTHER_QUOTES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOtherQuotes(o.id === otherQuotes ? "" : o.id)}
                className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                  otherQuotes === o.id
                    ? "border-[#0a1722] bg-[#0a1722] text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {(otherQuotes === "one" || otherQuotes === "few") && (
            <input
              value={otherQuoteNotes}
              onChange={(e) => setOtherQuoteNotes(e.target.value)}
              placeholder="What did they quote, if you want to share"
              className="app-field text-[13px] mt-2"
            />
          )}
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

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Access, measurements, materials you want used, or anything else the tradie should know"
          rows={3}
          className="app-field text-[13px] resize-none"
        />

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
