"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Check, ChevronRight } from "lucide-react";

const TRADES = [
  "electrician","plumber","builder","roofer","painter","carpenter",
  "tiler","landscaper","concreter","fencer","plasterer","handyman",
];

const TRADE_LABELS: Record<string,string> = {
  electrician:"Electrician", plumber:"Plumber", builder:"Builder",
  roofer:"Roofer", painter:"Painter", carpenter:"Carpenter",
  tiler:"Tiler", landscaper:"Landscaper", concreter:"Concreter",
  fencer:"Fencer", plasterer:"Plasterer", handyman:"Handyman",
};

const BUDGETS = ["Under $500","$500–$2k","$2k–$10k","$10k–$50k","$50k+","Not sure yet"];
const TIMELINES = ["ASAP","Within 2 weeks","Within a month","1–3 months","Just planning ahead"];
const TEMPS = [
  { value:"early", label:"Early stage", desc:"I&apos;m exploring options, not ready to commit yet" },
  { value:"warm",  label:"Warm",        desc:"I&apos;m interested in speaking with a tradie soon" },
  { value:"hot",   label:"Hot",         desc:"Budget approved, ready to go" },
];

type User = { id: string; email?: string } | null;
type Homeowner = { name: string; phone: string; suburb: string; postcode: string } | null;

export default function GetQuotesForm({ user, homeowner }: { user: User; homeowner: Homeowner }) {
  const [step, setStep] = useState(1);

  // Step 1 -- account
  const [name,     setName]     = useState(homeowner?.name ?? "");
  const [email,    setEmail]    = useState(user?.email ?? "");
  const [phone,    setPhone]    = useState(homeowner?.phone ?? "");
  const [password, setPassword] = useState("");

  // Step 2 -- job
  const [trade,       setTrade]       = useState("");
  const [suburb,      setSuburb]      = useState(homeowner?.suburb ?? "");
  const [postcode,    setPostcode]    = useState(homeowner?.postcode ?? "");
  const [description, setDescription] = useState("");
  const [budget,      setBudget]      = useState("");
  const [timeline,    setTimeline]    = useState("");
  const [temp,        setTemp]        = useState("early");
  const [numQuotes,   setNumQuotes]   = useState(3);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  async function submitStep1() {
    if (!name || !email || !phone) { setError("Please fill in all fields."); return; }
    if (!user && !password) { setError("Please set a password for your account."); return; }
    setError(""); setStep(2);
  }

  async function submitJob() {
    if (!trade || !suburb || !description) {
      setError("Please fill in trade, suburb and job description."); return;
    }
    setSaving(true); setError("");
    const supabase = createClient();

    let userId = user?.id;

    // Create account if not logged in
    if (!user) {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { name } },
      });
      if (authErr) { setError(authErr.message); setSaving(false); return; }
      userId = authData.user?.id;
    }

    if (!userId) { setError("Could not create account. Try again."); setSaving(false); return; }

    // Upsert homeowner profile
    await supabase.from("homeowner_profiles").upsert({
      id: userId, name, email, phone, suburb, postcode,
    }, { onConflict: "id" });

    // Create job request
    const { data: request, error: reqErr } = await supabase
      .from("job_requests")
      .insert({
        homeowner_id:      userId,
        trade,
        suburb,
        postcode,
        description,
        budget,
        timeline,
        lead_temperature:  temp,
        num_quotes_wanted: numQuotes,
        status:            "open",
      })
      .select("id")
      .single();

    if (reqErr) { setError(reqErr.message); setSaving(false); return; }

    // Trigger alert emails to tradies
    await fetch("/api/job-requests/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id }),
    });

    setSaving(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-[var(--green-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-[var(--green)]" />
        </div>
        <h2 className="font-display text-[1.6rem] text-[var(--ink)] mb-2">Request sent!</h2>
        <p className="text-[14px] text-[var(--ink-faint)] max-w-sm mx-auto mb-6">
          We&apos;ve alerted local {TRADE_LABELS[trade] ?? trade}s in {suburb}.
          Up to {numQuotes} will contact you directly - usually within a few hours.
        </p>
        <Link href="/directory" className="btn-secondary inline-flex">Browse the directory</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[1,2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors ${step >= s ? "bg-[var(--navy)] text-white" : "bg-[var(--line)] text-[var(--ink-faint)]"}`}>
              {step > s ? <Check size={13} /> : s}
            </div>
            <span className={`text-[12.5px] font-semibold ${step >= s ? "text-[var(--ink)]" : "text-[var(--ink-faint)]"}`}>
              {s === 1 ? "Your details" : "Job details"}
            </span>
            {s < 2 && <ChevronRight size={14} className="text-[var(--ink-faint)]" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card space-y-3">
          <p className="font-semibold text-[var(--ink)] mb-1">Your contact details</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">
            {user ? "Confirm your details before submitting." : "Create a free account so tradies can contact you and you can track your requests."}
          </p>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Your full name *" className="app-field text-[13px]" />
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address *" type="email" className="app-field text-[13px]"
            disabled={!!user} />
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone number *" type="tel" className="app-field text-[13px]" />
          {!user && (
            <input value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Create a password *" type="password" className="app-field text-[13px]" />
          )}
          {error && <p className="text-[12.5px] text-[var(--red)] font-semibold">{error}</p>}
          <button onClick={submitStep1} className="btn-primary w-full justify-center">
            Next - Job details <ChevronRight size={14} />
          </button>
          {!user && (
            <p className="text-[12px] text-[var(--ink-faint)] text-center">
              Already have an account? <Link href="/login" className="text-[var(--navy)] font-semibold">Log in</Link>
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {/* Trade */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">What trade do you need? *</p>
            <div className="grid grid-cols-3 gap-2">
              {TRADES.map(t => (
                <button key={t} onClick={() => setTrade(t)}
                  className={`px-3 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors ${trade === t ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                  {TRADE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">Where is the job? *</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input value={suburb} onChange={e => setSuburb(e.target.value)}
                  placeholder="Suburb *" className="app-field text-[13px]" />
              </div>
              <input value={postcode} onChange={e => setPostcode(e.target.value)}
                placeholder="Postcode" className="app-field text-[13px]" />
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">Describe the job *</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Tell tradies what you need done. The more detail the better - size, access, any special requirements..."
              rows={4} className="app-field text-[13px] resize-none" />
          </div>

          {/* Budget */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">Budget</p>
            <div className="grid grid-cols-3 gap-2">
              {BUDGETS.map(b => (
                <button key={b} onClick={() => setBudget(b)}
                  className={`px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${budget === b ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">Timeline</p>
            <div className="grid grid-cols-2 gap-2">
              {TIMELINES.map(t => (
                <button key={t} onClick={() => setTimeline(t)}
                  className={`px-3 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors text-left ${timeline === t ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Lead temp */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">Where are you at?</p>
            <div className="space-y-2">
              {TEMPS.map(t => (
                <button key={t.value} onClick={() => setTemp(t.value)}
                  className={`w-full px-4 py-3 rounded-xl border transition-colors text-left ${temp === t.value ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] hover:border-[var(--navy)]"}`}>
                  <p className={`font-semibold text-[13.5px] ${temp === t.value ? "text-[var(--amber)]" : "text-[var(--ink)]"}`}>{t.label}</p>
                  <p className={`text-[12px] ${temp === t.value ? "text-white/70" : "text-[var(--ink-faint)]"}`} dangerouslySetInnerHTML={{ __html: t.desc }} />
                </button>
              ))}
            </div>
          </div>

          {/* Num quotes */}
          <div className="card">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-3">
              How many tradies do you want to hear from?
            </p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setNumQuotes(n)}
                  className={`w-12 h-12 rounded-xl font-bold text-[15px] border transition-colors ${numQuotes === n ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-faint)] hover:border-[var(--navy)]"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[var(--ink-faint)] mt-2">Default is 3. More quotes = more options but more calls.</p>
          </div>

          {error && <p className="text-[12.5px] text-[var(--red)] font-semibold px-1">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setError(""); }} className="btn-secondary">← Back</button>
            <button onClick={submitJob} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? "Submitting..." : "Submit request"}
            </button>
          </div>

          <p className="text-[12px] text-[var(--ink-faint)] text-center">
            Your contact details are only shared with tradies who claim your request.
          </p>
        </div>
      )}
    </div>
  );
}
