"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Home, Building2, User,
  Search, MapPin, Phone, Mail, FileText, Loader2, Check, Info, Wrench, ChevronRight, Camera,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TRADES = [
  "Electrician", "Plumber", "Builder", "Roofer", "Painter", "Carpenter",
  "Tiler", "Landscaper", "Concreter", "Fencer", "Plasterer", "Handyman",
];

const MIN_JOB_DESC_LENGTH = 10;
const MAX_PHOTOS = 6;

const JOB_STAGES = [
  { value: "ready", label: "Ready to hire - just need quotes" },
  { value: "warm",  label: "Actively comparing quotes" },
  { value: "planning", label: "Planning stage - flexible timing" },
];

const TIMELINES = [
  { value: "asap", label: "ASAP" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "flexible", label: "Flexible" },
];

const BUDGETS = [
  { value: "under_500", label: "Under $500" },
  { value: "500_2k", label: "$500 - $2,000" },
  { value: "2k_10k", label: "$2,000 - $10,000" },
  { value: "10k_plus", label: "$10,000+" },
  { value: "not_sure", label: "Not sure" },
];

/* ------------------------------------------------------------------ */
/*  Form state                                                         */
/* ------------------------------------------------------------------ */

interface QuoteFormData {
  trade: string;
  jobDescription: string;
  propertyType: string;
  timeline: string;
  budget: string;
  stage: string;
  location: string;
  name: string;
  email: string;
  phone: string;
  consent: boolean;
  additionalDetails: string;
}

interface UserData {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; phone?: string };
}

interface HomeownerData {
  full_name?: string | null;
  phone?: string | null;
  location?: string | null;
}

interface StepConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  isValid: () => boolean;
}

/* ------------------------------------------------------------------ */
/*  Simple toast fallback                                              */
/* ------------------------------------------------------------------ */

function useSimpleToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, showToast: setToast };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GetQuotesForm({ user, homeowner }: { user: UserData | null; homeowner: HomeownerData | null }) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast, showToast } = useSimpleToast();

  // ── Form data (backed by localStorage) ───────────────────────────
  // Must start from the exact same default on server and client --
  // reading localStorage inside the useState initializer ran during the
  // client's hydration render too, so a returning visitor with saved
  // data got a client-rendered form that didn't match the server-
  // rendered (empty) one, tripping a hydration mismatch (React #418).
  // Restoring from localStorage in an effect below avoids that: it only
  // runs after hydration has already completed.
  const [form, setForm] = useState<QuoteFormData>({
    trade: "", jobDescription: "", propertyType: "", timeline: "",
    budget: "", stage: "", location: "", name: "", email: "",
    phone: "", consent: false, additionalDetails: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("get-quotes-form");
      if (saved) setForm(JSON.parse(saved));
    } catch { /* ignore */ }
    setRestoredDraft(true);
  }, []);

  useEffect(() => {
    if (!restoredDraft) return; // don't clobber a saved draft with the initial default before it's loaded
    localStorage.setItem("get-quotes-form", JSON.stringify(form));
  }, [form, restoredDraft]);

  // ── Set initial value from URL search params (trade / suburb) ─────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const trade = sp.get("trade");
    const suburb = sp.get("suburb");
    if (trade || suburb) {
      setForm(prev => ({
        ...prev,
        ...(trade && !prev.trade ? { trade: trade.charAt(0).toUpperCase() + trade.slice(1) } : {}),
        ...(suburb && !prev.location ? { location: suburb } : {}),
      }));
    }
  }, []);

  // ── Fill from logged-in homeowner profile (autofill, not readonly) ─
  useEffect(() => {
    if (!user || !homeowner) return;
    setForm(prev => ({
      ...prev,
      name: prev.name || homeowner.full_name || user.user_metadata?.full_name || "",
      email: prev.email || user.email || "",
      phone: prev.phone || homeowner.phone || user.user_metadata?.phone || "",
      location: prev.location || homeowner.location || "",
    }));
  }, [user, homeowner]);

  // ── Helpers ──────────────────────────────────────────────────────
  const update = useCallback((patch: Partial<QuoteFormData>) => {
    setForm(prev => ({ ...prev, ...patch }));
    // clear error on field change
    for (const key of Object.keys(patch)) {
      if (errors[key]) {
        setErrors(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  }, [errors]);

  const validateStep = useCallback((s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 0) {
      if (!form.trade.trim()) newErrors.trade = "Please select a trade type.";
      if (form.jobDescription.trim().length < MIN_JOB_DESC_LENGTH) {
        newErrors.jobDescription = `Please provide at least ${MIN_JOB_DESC_LENGTH} characters. Current: ${form.jobDescription.trim().length}.`;
      }
      if (!form.propertyType) newErrors.propertyType = "Please select a property type.";
    }
    if (s === 1) {
      if (!form.timeline) newErrors.timeline = "Please select a timeline.";
      if (!form.budget) newErrors.budget = "Please select a budget.";
      if (!form.stage) newErrors.stage = "Please select where you're at.";
    }
    if (s === 2) {
      if (!form.location.trim()) newErrors.location = "Please enter your suburb.";
      if (!form.name.trim()) newErrors.name = "Please enter your name.";
      if (!form.email.trim()) newErrors.email = "Please enter your email.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) newErrors.email = "Please enter a valid email address.";
      if (!form.consent) newErrors.consent = "You must agree to be contacted.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const nextStep = useCallback(() => {
    if (validateStep(step)) setStep(step + 1);
  }, [validateStep, step]);

  const prevStep = useCallback(() => setStep(Math.max(0, step - 1)), [step]);

  // ── Submit ───────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validateStep(2)) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("trade", form.trade);
      fd.append("job_description", form.jobDescription);
      fd.append("property_type", form.propertyType);
      fd.append("timeline", form.timeline);
      fd.append("budget", form.budget);
      fd.append("stage", form.stage);
      fd.append("location", form.location);
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone || "");
      fd.append("consent", String(form.consent));
      fd.append("additional_details", form.additionalDetails);
      for (const photo of photos) fd.append("photos", photo);

      const res = await fetch("/api/job-requests", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        localStorage.removeItem("get-quotes-form");
        setSubmitted(true);
        showToast({ message: "Job posted successfully!", type: "success" });
      } else {
        showToast({ message: data.error ?? "Something went wrong. Please try again.", type: "error" });
      }
    } catch {
      showToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Steps ────────────────────────────────────────────────────────
  const steps: StepConfig[] = [
    {
      title: "Your job details",
      description: "Tell us about your job",
      icon: <FileText size={18} />,
      component: (
        <div className="space-y-5">
          {/* Trade */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              What trade do you need? <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] pointer-events-none z-10" />
              <select value={form.trade} onChange={e => update({ trade: e.target.value })}
                className={`app-field pl-9 text-[13px] ${errors.trade ? "border-red-300 ring-1 ring-red-200" : ""}`}>
                <option value="">Select a trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {errors.trade && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.trade}</p>}
          </div>

          {/* Job description */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Tell us about your job <span className="text-red-500">*</span>
            </label>
            <textarea value={form.jobDescription} onChange={e => update({ jobDescription: e.target.value })}
              placeholder="Describe what needs doing - e.g., 'Need to install 2 new power points in the kitchen and replace the bathroom exhaust fan'"
              rows={5}
              className={`app-field text-[13px] resize-none ${errors.jobDescription ? "border-red-300 ring-1 ring-red-200" : ""}`} />
            <div className="flex items-center justify-between mt-1.5">
              {errors.jobDescription ? (
                <p className="text-red-500 text-[12px] font-medium">{errors.jobDescription}</p>
              ) : (
                <p className="text-[11px] text-[var(--ink-faint)]">The more detail, the better your quotes will be.</p>
              )}
              <span className={`text-[11px] font-medium ${form.jobDescription.length < MIN_JOB_DESC_LENGTH ? "text-[var(--ink-faint)]" : "text-emerald-600"}`}>
                {form.jobDescription.length} chars
              </span>
            </div>
          </div>

          {/* Additional details -- measurements, access notes, etc */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Any measurements or extra details? <span className="text-[var(--ink-faint)] font-medium">(optional)</span>
            </label>
            <textarea value={form.additionalDetails} onChange={e => update({ additionalDetails: e.target.value })}
              placeholder="e.g., 'Ceiling height approx 2.7m', 'Roof area roughly 180m2', 'Access via side gate only'"
              rows={3}
              className="app-field text-[13px] resize-none" />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Photos <span className="text-[var(--ink-faint)] font-medium">(optional, up to {MAX_PHOTOS})</span>
            </label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-6 cursor-pointer hover:border-gray-400 transition-colors">
              <Camera size={16} className="text-[var(--ink-faint)]" />
              <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Add photos of the job</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  const tooBig = picked.find((f) => f.size > 10 * 1024 * 1024);
                  const notImage = picked.find((f) => !f.type.startsWith("image/"));
                  if (tooBig) { setPhotoError(`${tooBig.name} is too large -- please keep photos under 10MB.`); e.target.value = ""; return; }
                  if (notImage) { setPhotoError(`${notImage.name} isn't an image file.`); e.target.value = ""; return; }
                  setPhotoError(null);
                  setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
                  e.target.value = "";
                }}
              />
            </label>
            {photoError && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{photoError}</p>}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photos.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-20 object-cover rounded-lg border border-[var(--line)]"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Photos help tradies quote more accurately the first time.</p>
          </div>

          {/* Property type */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              What type of property? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "residential", icon: <Home size={16} />, label: "Residential" },
                { value: "commercial", icon: <Building2 size={16} />, label: "Commercial" },
                { value: "other", icon: <Wrench size={16} />, label: "Other" },
              ].map(({ value, icon, label }) => (
                <button key={value} onClick={() => update({ propertyType: value })}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl border text-[12px] font-semibold transition-all ${form.propertyType === value ? "border-gray-900 bg-gray-900 text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
            {errors.propertyType && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.propertyType}</p>}
          </div>
        </div>
      ),
      isValid: () => !!form.trade && form.jobDescription.length >= MIN_JOB_DESC_LENGTH && !!form.propertyType,
    },
    {
      title: "Timing & budget",
      description: "When do you need it done?",
      icon: <Info size={18} />,
      component: (
        <div className="space-y-5">
          {/* Timeline */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              When do you need it done? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIMELINES.map(({ value, label }) => (
                <button key={value} onClick={() => update({ timeline: value })}
                  className={`px-3 py-3 rounded-xl border text-[13px] font-semibold transition-all ${form.timeline === value ? "border-gray-900 bg-gray-900 text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
                  {label}
                </button>
              ))}
            </div>
            {errors.timeline && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.timeline}</p>}
          </div>

          {/* Budget */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              What&apos;s your approximate budget? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BUDGETS.map(({ value, label }) => (
                <button key={value} onClick={() => update({ budget: value })}
                  className={`px-2 py-3 rounded-xl border text-[12.5px] font-semibold transition-all ${form.budget === value ? "border-gray-900 bg-gray-900 text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
                  {label}
                </button>
              ))}
            </div>
            {errors.budget && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.budget}</p>}
          </div>

          {/* Stage */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Where are you at? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {JOB_STAGES.map(({ value, label }) => (
                <button key={value} onClick={() => update({ stage: value })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[13px] font-semibold transition-all ${form.stage === value ? "border-gray-900 bg-gray-900 text-white" : "border-[var(--line)] text-[var(--ink-soft)] hover:border-gray-400"}`}>
                  {label}
                  {form.stage === value && <Check size={15} />}
                </button>
              ))}
            </div>
            {errors.stage && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.stage}</p>}
          </div>
        </div>
      ),
      isValid: () => !!form.timeline && !!form.budget && !!form.stage,
    },
    {
      title: "Your details",
      description: "Who should tradies contact?",
      icon: <User size={18} />,
      component: (
        <div className="space-y-5">
          {/* Suburb */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              What&apos;s your suburb? <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input type="text" value={form.location} onChange={e => update({ location: e.target.value })}
                placeholder="e.g., Frankston, VIC 3199"
                className={`app-field pl-9 text-[13px] ${errors.location ? "border-red-300 ring-1 ring-red-200" : ""}`} />
            </div>
            {errors.location && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.location}</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Your full name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => update({ name: e.target.value })}
              placeholder="Enter your name"
              className={`app-field text-[13px] ${errors.name ? "border-red-300 ring-1 ring-red-200" : ""}`} />
            {errors.name && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Email address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input type="email" value={form.email} onChange={e => update({ email: e.target.value })}
                placeholder="your@email.com"
                className={`app-field pl-9 text-[13px] ${errors.email ? "border-red-300 ring-1 ring-red-200" : ""}`} />
            </div>
            {errors.email && <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[12.5px] font-bold text-[var(--ink)] mb-2.5">
              Phone number <span className="text-[var(--ink-faint)] font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input type="tel" value={form.phone} onChange={e => update({ phone: e.target.value })}
                placeholder="04XX XXX XXX"
                className="app-field pl-9 text-[13px]" />
            </div>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.consent} onChange={e => update({ consent: e.target.checked })}
              className={`mt-0.5 w-4 h-4 rounded accent-[var(--navy)] ${errors.consent ? "outline outline-2 outline-red-300 outline-offset-2" : ""}`} />
            <span className={`text-[12.5px] leading-relaxed ${errors.consent ? "text-red-500 font-medium" : "text-[var(--ink-soft)]"}`}>
              I agree to Swiftscope sharing my job details with up to 3 matched local tradies so they can contact me with quotes.
            </span>
          </label>
          {errors.consent && <p className="text-red-500 text-[12px] font-medium ml-7">{errors.consent}</p>}
        </div>
      ),
      isValid: () => !!form.location && !!form.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.consent,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="text-center py-12 px-6">
        <div className="w-16 h-16 bg-[var(--green-bg)] rounded-full flex items-center justify-center mx-auto mb-5">
          <Check size={28} className="text-[var(--green)]" />
        </div>
        <h2 className="font-display text-[1.8rem] text-[var(--ink)] mb-2">Quote request sent!</h2>
        <p className="text-[14px] text-[var(--ink-soft)] max-w-sm mx-auto mb-8">
          Up to 3 local tradies will be in touch with quotes shortly.
        </p>

        {/* Review card */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 max-w-sm mx-auto text-left">
          <p className="text-[12.5px] font-bold text-[var(--ink)] mb-3">What&apos;s next?</p>
          <div className="space-y-2.5">
            {[
              "Tradies review your job details",
              "Up to 3 will contact you with quotes",
              "You choose who to hire - no pressure",
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[var(--green-bg)] flex items-center justify-center shrink-0">
                  <Check size={11} className="text-[var(--green)]" />
                </div>
                <p className="text-[13px] text-[var(--ink-soft)]">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] font-bold transition-all ${toast.type === "success" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
          {toast.message}
        </div>
      )}

      {/* Progress header */}
      <div className="mb-6">
        {/* Step dots */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              <button onClick={() => i < step && setStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${i < step ? "bg-[var(--green-bg)] text-[var(--green)]" : i === step ? "bg-[var(--navy)] text-white" : "bg-[var(--line)] text-[var(--ink-faint)]"}`}>
                {i < step ? <Check size={14} /> : i + 1}
              </button>
              {i < steps.length - 1 && (
                <div className={`w-6 h-0.5 mx-1 ${i < step ? "bg-[var(--green)]" : "bg-[var(--line)]"}`} />
              )}
            </div>
          ))}
        </div>
        {/* Title + description */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[var(--amber-light)] flex items-center justify-center text-[var(--amber-deep)]">
            {steps[step].icon}
          </div>
          <div>
            <h2 className="font-bold text-[16px] text-[var(--ink)]">{steps[step].title}</h2>
            <p className="text-[12.5px] text-[var(--ink-faint)]">{steps[step].description}</p>
          </div>
        </div>
      </div>

      {/* Step content */}
      {steps[step].component}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-[var(--line)]">
        {step > 0 ? (
          <button onClick={prevStep}
            className="text-[13px] font-bold text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors">
            Back
          </button>
        ) : (
          <div />
        )}

        {step < steps.length - 1 ? (
          <button onClick={nextStep}
            className="flex items-center gap-2 bg-[var(--navy)] text-white font-bold text-[13.5px] px-6 py-2.5 rounded-xl hover:bg-[#121f2b] transition-colors">
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[13.5px] px-7 py-3 rounded-xl hover:bg-[var(--amber-deep)] transition-colors disabled:opacity-50">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {submitting ? "Posting..." : "Post my job"}
          </button>
        )}
      </div>
    </div>
  );
}
