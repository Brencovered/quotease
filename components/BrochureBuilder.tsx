"use client";

/**
 * BrochureBuilder
 * ─────────────────
 * Split-pane brochure editor. Left = controls, Right = live branded preview.
 * Preview updates in real time as the tradie edits.
 * Supports 3 layout templates. Print-to-PDF via window.print().
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Palette, Upload, Eye, Download, Sparkles, Save, X,
  Plus, Trash2, Check, ChevronDown, ChevronUp, Image as ImageIcon,
  FileText, Briefcase, Star, AlignLeft, LayoutTemplate,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ───────────────────────────────────────────────────────── */
interface Branding {
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  branding_primary_color: string | null;
  branding_tagline: string | null;
  branding_email_footer: string | null;
}

interface Job {
  id: string;
  client_name: string | null;
  site_address: string | null;
  total_cost: number | null;
  completed_at: string | null;
}

interface Quote {
  id: string;
  client_name: string | null;
  total_cost: number | null;
}

interface ServiceItem {
  label: string;
  unit_cost: number;
  supplier?: string;
}

interface QuoteItem {
  label: string;
  qty: number;
  total: number;
}

interface Testimonial {
  text: string;
  author?: string;
}

type Layout = "modern" | "classic" | "bold";

const LAYOUTS: { id: Layout; label: string; desc: string }[] = [
  { id: "modern",  label: "Modern",  desc: "Clean white with colour accents" },
  { id: "classic", label: "Classic", desc: "Traditional left-aligned layout" },
  { id: "bold",    label: "Bold",    desc: "Full-colour header, dark contrast" },
];

const COLOR_PRESETS = [
  "#0a1722","#1e40af","#b45309","#15803d",
  "#7c3aed","#be123c","#0e7490","#4338ca",
  "#f97316","#0891b2",
];

/* ══════════════════════════════════════════════════════════════════
   BROCHURE BUILDER COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function BrochureBuilder({
  branding,
  completedJobs,
  quotes,
  serviceMaterials,
}: {
  branding:        Branding | null;
  completedJobs:   Job[];
  quotes:          Quote[];
  serviceMaterials: ServiceItem[];
}) {
  const supabase = createClient();

  /* ── Branding state ─────────────────────────────────────────── */
  const [logoUrl,      setLogoUrl]      = useState(branding?.logo_url ?? "");
  const [accentColor,  setAccentColor]  = useState(branding?.branding_primary_color ?? "#0a1722");
  const [bizName,      setBizName]      = useState(branding?.business_name ?? "");
  const [tagline,      setTagline]      = useState(branding?.branding_tagline ?? "");
  const [phone,        setPhone]        = useState(branding?.contact_phone ?? "");
  const [email,        setEmail]        = useState(branding?.contact_email ?? "");

  /* ── Content state ──────────────────────────────────────────── */
  const [layout,        setLayout]        = useState<Layout>("modern");
  const [heroText,      setHeroText]      = useState("");
  const [aboutText,     setAboutText]     = useState("");
  const [tcs,           setTcs]           = useState("");
  const [customSections, setCustomSections] = useState<{ id: string; heading: string; body: string }[]>([]);

  /* ── Section toggles ────────────────────────────────────────── */
  const [showServices,    setShowServices]    = useState(true);
  const [showRecentWork,  setShowRecentWork]  = useState(true);
  const [showFromQuote,   setShowFromQuote]   = useState(false);
  const [showTestimonials,setShowTestimonials] = useState(false);
  const [showTcs,         setShowTcs]         = useState(false);

  /* ── Quote items ────────────────────────────────────────────── */
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [quoteItems,      setQuoteItems]      = useState<QuoteItem[]>([]);

  /* ── Testimonials ───────────────────────────────────────────── */
  const [testimonials, setTestimonials] = useState<Testimonial[]>([
    { text: "", author: "" },
  ]);

  /* ── Images ─────────────────────────────────────────────────── */
  const [images,     setImages]     = useState<string[]>([]);
  const [uploading,  setUploading]  = useState(false);

  /* ── Scraper ─────────────────────────────────────────────────── */
  const [websiteUrl,   setWebsiteUrl]   = useState("");
  const [scraping,     setScraping]     = useState(false);
  const [scrapeMsg,    setScrapeMsg]    = useState("");

  /* ── UI state ────────────────────────────────────────────────── */
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [activePanel, setActivePanel] = useState<"brand" | "content" | "sections">("brand");
  const [showPreview, setShowPreview] = useState(true);

  const fileRef  = useRef<HTMLInputElement>(null);
  const imgRef   = useRef<HTMLInputElement>(null);

  /* ── Sync branding from props ───────────────────────────────── */
  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logo_url ?? "");
      setAccentColor(branding.branding_primary_color ?? "#0a1722");
      setBizName(branding.business_name ?? "");
      setTagline(branding.branding_tagline ?? "");
      setPhone(branding.contact_phone ?? "");
      setEmail(branding.contact_email ?? "");
    }
  }, [branding]);

  /* ── Load quote items when selected ───────────────────────────── */
  useEffect(() => {
    if (!selectedQuoteId || !showFromQuote) { setQuoteItems([]); return; }
    supabase.from("quotes").select("intake_data, total_cost").eq("id", selectedQuoteId).single()
      .then(({ data }) => {
        if (!data) return;
        const si = data.intake_data?.site_items as Array<{ label: string; qty: number; materialsCost: number; labourHrs: number }> | null;
        if (si?.length) {
          setQuoteItems(si.map(it => ({ label: it.label, qty: it.qty ?? 1, total: (it.materialsCost ?? 0) + (it.labourHrs ?? 0) * 95 })));
        }
      });
  }, [selectedQuoteId, showFromQuote, supabase]);

  /* ── Logo upload ─────────────────────────────────────────────── */
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("logos").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
      setLogoUrl(publicUrl);
    }
    setUploading(false);
    e.target.value = "";
  }

  /* ── Image upload ────────────────────────────────────────────── */
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/brochure/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("brochure-images").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("brochure-images").getPublicUrl(path);
      setImages(prev => [...prev, publicUrl]);
    }
    e.target.value = "";
  }

  /* ── Scrape website ──────────────────────────────────────────── */
  async function scrapeWebsite() {
    if (!websiteUrl.trim()) return;
    setScraping(true); setScrapeMsg("");
    try {
      const res = await fetch("/api/comms/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.about) setAboutText(prev => prev ? prev + "\n\n" + data.about : data.about);
        if (data.businessName && !bizName) setBizName(data.businessName);
        if (data.logo && !logoUrl) setLogoUrl(data.logo);
        if (data.testimonials?.length) {
          setTestimonials(data.testimonials.map((t: Testimonial) => ({ text: t.text, author: t.author ?? "" })));
          setShowTestimonials(true);
        }
        setScrapeMsg(`Scraped${data.about ? " about text," : ""}${data.testimonials?.length ? " testimonials," : ""} done.`);
      } else {
        setScrapeMsg("Could not scrape that URL.");
      }
    } catch { setScrapeMsg("Scrape failed."); }
    setScraping(false);
  }

  /* ── Save brochure settings ──────────────────────────────────── */
  async function save() {
    setSaving(true);
    await fetch("/api/comms/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branding_primary_color: accentColor,
        branding_tagline: tagline || null,
        brochure_title: bizName,
        brochure_logo: logoUrl,
        brochure_color: accentColor,
        brochure_tcs: tcs,
        brochure_images: images,
        brochure_sections: { showServices, showRecentWork, showFromQuote, showTestimonials, showTcs },
        brochure_custom_text: aboutText,
        brochure_hero_text: heroText,
        brochure_layout: layout,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addCustomSection() {
    setCustomSections(prev => [...prev, { id: Math.random().toString(36).slice(2), heading: "New section", body: "" }]);
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[20px] text-[var(--ink)]">Brochure Builder</h2>
          <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
            Build a branded company brochure. Preview updates live as you edit.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(p => !p)}
            className="btn-secondary text-[12px] py-1.5 px-3 flex items-center gap-1.5"
          >
            <Eye size={13} /> {showPreview ? "Hide preview" : "Show preview"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary text-[12px] py-1.5 px-3 flex items-center gap-1.5"
          >
            {saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> {saving ? "Saving..." : "Save"}</>}
          </button>
        </div>
      </div>

      <div className={`grid gap-5 ${showPreview ? "lg:grid-cols-2" : "grid-cols-1"}`}>

        {/* ── LEFT: Editor ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Panel nav */}
          <div className="flex gap-1 bg-[var(--app-bg)] rounded-xl p-1">
            {([
              ["brand",    "Brand",    Palette],
              ["content",  "Content",  AlignLeft],
              ["sections", "Sections", LayoutTemplate],
            ] as [typeof activePanel, string, React.ElementType][]).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setActivePanel(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
                style={{
                  background: activePanel === key ? "white" : "transparent",
                  color:      activePanel === key ? "var(--navy)" : "var(--ink-faint)",
                  boxShadow:  activePanel === key ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Brand panel */}
          {activePanel === "brand" && (
            <div className="space-y-4">
              <div className="card space-y-4">
                <p className="section-tag">Brand identity</p>

                {/* Logo */}
                <div>
                  <p className="text-[11.5px] font-bold uppercase text-[var(--ink-faint)] mb-2">Logo</p>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl border-2 border-[var(--line)] bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl
                        ? <img src={logoUrl} alt="" className="w-full h-full object-contain p-1" />
                        : <ImageIcon size={20} className="text-[var(--ink-faint)]" />}
                    </div>
                    <div className="space-y-1.5">
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="btn-secondary text-[12px] py-1.5 px-3 w-full"
                      >
                        {uploading ? "Uploading..." : logoUrl ? "Change logo" : "Upload logo"}
                      </button>
                      {logoUrl && (
                        <button onClick={() => setLogoUrl("")} className="text-[11px] text-[var(--red)] font-semibold block">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business name */}
                <div>
                  <p className="text-[11.5px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Business name</p>
                  <input value={bizName} onChange={e => setBizName(e.target.value)}
                    placeholder="e.g. Smith Electrical Services"
                    className="app-field text-[13.5px]" />
                </div>

                {/* Tagline */}
                <div>
                  <p className="text-[11.5px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Tagline</p>
                  <input value={tagline} onChange={e => setTagline(e.target.value)}
                    placeholder="e.g. Quality electrical work since 2005"
                    className="app-field text-[13.5px]" />
                </div>

                {/* Contact */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11.5px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Phone</p>
                    <input value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="04XX XXX XXX" className="app-field text-[13px]" />
                  </div>
                  <div>
                    <p className="text-[11.5px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Email</p>
                    <input value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@business.com" className="app-field text-[13px]" />
                  </div>
                </div>
              </div>

              {/* Accent colour */}
              <div className="card space-y-3">
                <p className="section-tag">Brand colour</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(c => (
                    <button key={c} onClick={() => setAccentColor(c)}
                      className="w-8 h-8 rounded-full border-2 transition-transform"
                      style={{
                        background: c,
                        borderColor: accentColor === c ? "var(--navy)" : "transparent",
                        transform: accentColor === c ? "scale(1.15)" : "scale(1)",
                      }} />
                  ))}
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border border-[var(--line)]" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full shrink-0" style={{ background: accentColor }} />
                  <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    className="app-field text-[12px] py-1.5 w-24 font-mono" />
                </div>
              </div>

              {/* Layout */}
              <div className="card space-y-3">
                <p className="section-tag">Layout template</p>
                <div className="space-y-2">
                  {LAYOUTS.map(l => (
                    <button key={l.id} onClick={() => setLayout(l.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                      style={{
                        borderColor: layout === l.id ? "var(--navy)" : "var(--line)",
                        background:  layout === l.id ? "rgba(10,23,34,.04)" : "white",
                      }}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${layout === l.id ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[var(--line)]"}`}>
                        {layout === l.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div>
                        <p className="font-bold text-[13px] text-[var(--ink)]">{l.label}</p>
                        <p className="text-[11px] text-[var(--ink-faint)]">{l.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Content panel */}
          {activePanel === "content" && (
            <div className="space-y-4">
              {/* Website scraper */}
              <div className="card space-y-3">
                <p className="section-tag">Auto-fill from website</p>
                <p className="text-[12px] text-[var(--ink-faint)]">
                  Enter your website URL and we'll pull your about text, services, and testimonials automatically.
                </p>
                <div className="flex gap-2">
                  <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourbusiness.com.au"
                    className="app-field flex-1 text-[13px]" />
                  <button onClick={scrapeWebsite} disabled={scraping || !websiteUrl.trim()}
                    className="btn-secondary shrink-0 text-[12px] py-2 px-3">
                    {scraping ? "Scraping..." : <><Sparkles size={12} /> Fill</>}
                  </button>
                </div>
                {scrapeMsg && <p className="text-[12px] text-green-600 font-semibold">{scrapeMsg}</p>}
              </div>

              {/* Hero text */}
              <div className="card space-y-2">
                <p className="section-tag">Hero message</p>
                <p className="text-[11.5px] text-[var(--ink-faint)]">A short punchy line at the top of your brochure.</p>
                <input value={heroText} onChange={e => setHeroText(e.target.value)}
                  placeholder="e.g. Licensed, insured, and on time — every time."
                  className="app-field text-[13.5px]" />
              </div>

              {/* About */}
              <div className="card space-y-2">
                <p className="section-tag">About your business</p>
                <textarea value={aboutText} onChange={e => setAboutText(e.target.value)}
                  rows={5} placeholder="Tell clients who you are, your experience, your guarantee..."
                  className="app-field text-[13px] resize-none" />
              </div>

              {/* Images */}
              <div className="card space-y-3">
                <p className="section-tag">Photos</p>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--line)]">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 border-0">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <button onClick={() => imgRef.current?.click()}
                  className="flex items-center gap-2 border-2 border-dashed border-[var(--line)] rounded-xl py-3 px-4 w-full hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
                  <Upload size={15} className="text-[var(--ink-faint)]" />
                  <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Add photo</span>
                </button>
              </div>

              {/* Custom sections */}
              {customSections.length > 0 && (
                <div className="space-y-3">
                  {customSections.map((sec, i) => (
                    <div key={sec.id} className="card space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={sec.heading} onChange={e =>
                          setCustomSections(prev => prev.map((s, j) => j === i ? { ...s, heading: e.target.value } : s))}
                          className="app-field font-bold text-[13px] flex-1" placeholder="Section heading" />
                        <button onClick={() => setCustomSections(prev => prev.filter((_, j) => j !== i))}
                          className="text-[var(--ink-faint)] hover:text-[var(--red)] border-0 bg-transparent p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <textarea value={sec.body}
                        onChange={e => setCustomSections(prev => prev.map((s, j) => j === i ? { ...s, body: e.target.value } : s))}
                        rows={4} className="app-field text-[13px] resize-none" placeholder="Section content..." />
                    </div>
                  ))}
                </div>
              )}

              <button onClick={addCustomSection}
                className="btn-secondary w-full text-[12.5px] py-2 flex items-center justify-center gap-1.5">
                <Plus size={13} /> Add custom section
              </button>

              {/* T&Cs */}
              <div className="card space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showTcs} onChange={e => setShowTcs(e.target.checked)}
                    className="w-4 h-4 accent-[var(--navy)]" />
                  <span className="font-bold text-[13px] text-[var(--ink)]">Include terms and conditions</span>
                </label>
                {showTcs && (
                  <textarea value={tcs} onChange={e => setTcs(e.target.value)}
                    rows={3} className="app-field text-[12.5px] resize-none"
                    placeholder="e.g. Valid for 30 days. 50% deposit required on acceptance." />
                )}
              </div>
            </div>
          )}

          {/* Sections panel */}
          {activePanel === "sections" && (
            <div className="card space-y-4">
              <p className="section-tag">Include sections</p>

              {/* Services */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={showServices} onChange={e => setShowServices(e.target.checked)}
                    className="w-4 h-4 accent-[var(--navy)]" />
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-[var(--amber-deep)]" />
                    <div>
                      <p className="text-[13px] font-bold text-[var(--ink)]">Services and pricing</p>
                      <p className="text-[11px] text-[var(--ink-faint)]">{serviceMaterials.length} items from your price book</p>
                    </div>
                  </div>
                </label>
              </div>

              {/* Recent work */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={showRecentWork} onChange={e => setShowRecentWork(e.target.checked)}
                    className="w-4 h-4 accent-[var(--navy)]" />
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-[var(--green)]" />
                    <div>
                      <p className="text-[13px] font-bold text-[var(--ink)]">Recent work</p>
                      <p className="text-[11px] text-[var(--ink-faint)]">{completedJobs.length} completed jobs</p>
                    </div>
                  </div>
                </label>
              </div>

              {/* From quote */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={showFromQuote} onChange={e => setShowFromQuote(e.target.checked)}
                    className="w-4 h-4 accent-[var(--navy)]" />
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-[var(--blue)]" />
                    <div>
                      <p className="text-[13px] font-bold text-[var(--ink)]">From a quote</p>
                      <p className="text-[11px] text-[var(--ink-faint)]">Pull line items from an existing quote</p>
                    </div>
                  </div>
                </label>
                {showFromQuote && (
                  <select value={selectedQuoteId} onChange={e => setSelectedQuoteId(e.target.value)}
                    className="app-field text-[12.5px] ml-7">
                    <option value="">Select a quote...</option>
                    {quotes.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.client_name || "Unnamed"} -- ${(q.total_cost ?? 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Testimonials */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={showTestimonials} onChange={e => setShowTestimonials(e.target.checked)}
                    className="w-4 h-4 accent-[var(--navy)]" />
                  <div className="flex items-center gap-2">
                    <Star size={14} className="text-[var(--amber-deep)]" />
                    <p className="text-[13px] font-bold text-[var(--ink)]">Client testimonials</p>
                  </div>
                </label>
                {showTestimonials && (
                  <div className="ml-7 space-y-2">
                    {testimonials.map((t, i) => (
                      <div key={i} className="bg-[var(--app-bg)] rounded-xl p-3 space-y-2">
                        <textarea value={t.text}
                          onChange={e => setTestimonials(prev => prev.map((tm, j) => j === i ? { ...tm, text: e.target.value } : tm))}
                          rows={2} className="app-field text-[12.5px] resize-none" placeholder="What the client said..." />
                        <div className="flex gap-2 items-center">
                          <input value={t.author ?? ""} onChange={e =>
                            setTestimonials(prev => prev.map((tm, j) => j === i ? { ...tm, author: e.target.value } : tm))}
                            className="app-field text-[12px] flex-1" placeholder="Client name (optional)" />
                          {testimonials.length > 1 && (
                            <button onClick={() => setTestimonials(prev => prev.filter((_, j) => j !== i))}
                              className="text-[var(--ink-faint)] hover:text-[var(--red)] border-0 bg-transparent p-1">
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setTestimonials(prev => [...prev, { text: "", author: "" }])}
                      className="btn-secondary text-[11.5px] py-1.5 px-3 flex items-center gap-1">
                      <Plus size={12} /> Add testimonial
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Live preview ──────────────────────────────────── */}
        {showPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase text-[var(--ink-faint)] tracking-wide">Live preview</p>
              <button
                onClick={() => window.print()}
                className="btn-primary text-[12px] py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download size={12} /> Print to PDF
              </button>
            </div>

            <div className="print-preview border border-[var(--line)] rounded-2xl overflow-hidden bg-white shadow-sm">
              <BrochurePreview
                layout={layout}
                accentColor={accentColor}
                logoUrl={logoUrl}
                bizName={bizName}
                tagline={tagline}
                heroText={heroText}
                aboutText={aboutText}
                phone={phone}
                email={email}
                images={images}
                showServices={showServices}
                showRecentWork={showRecentWork}
                showFromQuote={showFromQuote}
                showTestimonials={showTestimonials}
                showTcs={showTcs}
                serviceMaterials={serviceMaterials}
                completedJobs={completedJobs}
                quoteItems={quoteItems}
                testimonials={testimonials}
                customSections={customSections}
                tcs={tcs}
              />
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-preview { display: block !important; border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BROCHURE PREVIEW COMPONENT
   Renders differently based on layout (modern / classic / bold)
══════════════════════════════════════════════════════════════════ */
function BrochurePreview({
  layout, accentColor, logoUrl, bizName, tagline, heroText, aboutText,
  phone, email, images, showServices, showRecentWork, showFromQuote,
  showTestimonials, showTcs, serviceMaterials, completedJobs, quoteItems,
  testimonials, customSections, tcs,
}: {
  layout: Layout; accentColor: string; logoUrl: string; bizName: string;
  tagline: string; heroText: string; aboutText: string;
  phone: string; email: string; images: string[];
  showServices: boolean; showRecentWork: boolean; showFromQuote: boolean;
  showTestimonials: boolean; showTcs: boolean;
  serviceMaterials: ServiceItem[]; completedJobs: Job[]; quoteItems: QuoteItem[];
  testimonials: { text: string; author?: string }[];
  customSections: { id: string; heading: string; body: string }[];
  tcs: string;
}) {
  const isLight = isLightColor(accentColor);
  const contrastText = isLight ? "#0a1722" : "#ffffff";

  if (layout === "bold") {
    return (
      <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Full-colour header */}
        <div style={{ background: accentColor, padding: "2.5rem 2rem 2rem", color: contrastText }}>
          {logoUrl && (
            <img src={logoUrl} alt="" style={{ height: 52, width: "auto", objectFit: "contain", marginBottom: 12, filter: isLight ? "none" : "brightness(0) invert(1)" }} />
          )}
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{bizName || "Your Business Name"}</h1>
          {tagline && <p style={{ fontSize: 14, margin: "6px 0 0", opacity: 0.85 }}>{tagline}</p>}
          {heroText && <p style={{ fontSize: 16, margin: "16px 0 0", fontWeight: 700, lineHeight: 1.4 }}>{heroText}</p>}
        </div>

        {/* Image strip */}
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 4, maxHeight: 160, overflow: "hidden" }}>
            {images.slice(0, 4).map((img, i) => (
              <img key={i} src={img} alt="" style={{ flex: 1, objectFit: "cover", minWidth: 0 }} />
            ))}
          </div>
        )}

        <div style={{ padding: "1.5rem 2rem" }}>
          <BrochureBody {...{ aboutText, showServices, showRecentWork, showFromQuote, showTestimonials, showTcs, serviceMaterials, completedJobs, quoteItems, testimonials, customSections, tcs, accentColor }} />
          <BrochureFooter phone={phone} email={email} bizName={bizName} accentColor={accentColor} />
        </div>
      </div>
    );
  }

  if (layout === "classic") {
    return (
      <div style={{ fontFamily: "Georgia, serif", padding: "2.5rem 2rem" }}>
        {/* Left-aligned header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          {logoUrl && (
            <img src={logoUrl} alt="" style={{ height: 56, width: "auto", objectFit: "contain" }} />
          )}
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: accentColor, fontFamily: "system-ui" }}>
              {bizName || "Your Business Name"}
            </h1>
            {tagline && <p style={{ fontSize: 13, margin: "4px 0 0", color: "#6b7280", fontFamily: "system-ui" }}>{tagline}</p>}
          </div>
        </div>
        {/* Divider */}
        <div style={{ height: 2, background: accentColor, marginBottom: 20, width: "100%" }} />
        {heroText && <p style={{ fontSize: 15, fontStyle: "italic", color: "#374151", marginBottom: 20, fontFamily: "Georgia, serif" }}>&ldquo;{heroText}&rdquo;</p>}
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`, gap: 8, marginBottom: 20 }}>
            {images.slice(0, 3).map((img, i) => (
              <img key={i} src={img} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
            ))}
          </div>
        )}
        <BrochureBody {...{ aboutText, showServices, showRecentWork, showFromQuote, showTestimonials, showTcs, serviceMaterials, completedJobs, quoteItems, testimonials, customSections, tcs, accentColor }} />
        <BrochureFooter phone={phone} email={email} bizName={bizName} accentColor={accentColor} />
      </div>
    );
  }

  // Modern (default)
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Clean header */}
      <div style={{ padding: "2rem 2rem 1.5rem", borderBottom: `4px solid ${accentColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logoUrl && (
            <img src={logoUrl} alt="" style={{ height: 52, width: "auto", objectFit: "contain" }} />
          )}
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: "#0a1722" }}>
              {bizName || "Your Business Name"}
            </h1>
            {tagline && <p style={{ fontSize: 13, margin: "3px 0 0", color: "#6b7280" }}>{tagline}</p>}
          </div>
        </div>
        {heroText && (
          <p style={{ fontSize: 15, fontWeight: 700, color: accentColor, margin: "14px 0 0", lineHeight: 1.4 }}>
            {heroText}
          </p>
        )}
      </div>

      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(images.length, 4)}, 1fr)`, gap: 6, padding: "12px 16px" }}>
          {images.slice(0, 4).map((img, i) => (
            <img key={i} src={img} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8 }} />
          ))}
        </div>
      )}

      <div style={{ padding: "1rem 2rem 1.5rem" }}>
        <BrochureBody {...{ aboutText, showServices, showRecentWork, showFromQuote, showTestimonials, showTcs, serviceMaterials, completedJobs, quoteItems, testimonials, customSections, tcs, accentColor }} />
        <BrochureFooter phone={phone} email={email} bizName={bizName} accentColor={accentColor} />
      </div>
    </div>
  );
}

function BrochureBody({
  aboutText, showServices, showRecentWork, showFromQuote, showTestimonials, showTcs,
  serviceMaterials, completedJobs, quoteItems, testimonials, customSections, tcs, accentColor,
}: {
  aboutText: string; showServices: boolean; showRecentWork: boolean;
  showFromQuote: boolean; showTestimonials: boolean; showTcs: boolean;
  serviceMaterials: ServiceItem[]; completedJobs: Job[]; quoteItems: QuoteItem[];
  testimonials: { text: string; author?: string }[];
  customSections: { id: string; heading: string; body: string }[];
  tcs: string; accentColor: string;
}) {
  function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 18, height: 3, background: accentColor, borderRadius: 2, flexShrink: 0 }} />
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "#0a1722", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {children}
        </h3>
      </div>
    );
  }

  return (
    <div style={{ lineHeight: 1.6 }}>
      {aboutText && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line" }}>{aboutText}</p>
        </div>
      )}

      {customSections.filter(s => s.heading && s.body).map(sec => (
        <div key={sec.id} style={{ marginBottom: 20 }}>
          <SectionHeading>{sec.heading}</SectionHeading>
          <p style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-line" }}>{sec.body}</p>
        </div>
      ))}

      {showServices && serviceMaterials.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeading>Our services</SectionHeading>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {serviceMaterials.slice(0, 20).map((m, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "5px 0", color: "#374151", fontWeight: 600 }}>{m.label}</td>
                  <td style={{ padding: "5px 0", textAlign: "right", color: accentColor, fontWeight: 700 }}>
                    ${Number(m.unit_cost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {serviceMaterials.length > 20 && (
            <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", marginTop: 4 }}>
              ...and {serviceMaterials.length - 20} more services
            </p>
          )}
        </div>
      )}

      {showRecentWork && completedJobs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeading>Recent work</SectionHeading>
          {completedJobs.slice(0, 8).map((j) => (
            <div key={j.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 600, color: "#374151" }}>{j.client_name || "Private client"}</span>
                {j.site_address && <span style={{ color: "#9ca3af", marginLeft: 6 }}>{j.site_address}</span>}
              </div>
              <span style={{ fontWeight: 700, color: accentColor }}>${(j.total_cost ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {showFromQuote && quoteItems.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeading>Project scope</SectionHeading>
          {quoteItems.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
              <span style={{ color: "#374151", fontWeight: 600 }}>{m.qty}x {m.label}</span>
              <span style={{ color: accentColor, fontWeight: 700 }}>${m.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {showTestimonials && testimonials.filter(t => t.text).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeading>What our clients say</SectionHeading>
          {testimonials.filter(t => t.text).map((t, i) => (
            <div key={i} style={{ background: "#f9fafb", borderLeft: `3px solid ${accentColor}`, padding: "10px 12px", marginBottom: 8, borderRadius: "0 6px 6px 0" }}>
              <p style={{ fontSize: 12, color: "#374151", fontStyle: "italic", margin: 0 }}>&ldquo;{t.text}&rdquo;</p>
              {t.author && <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, margin: "4px 0 0" }}>{t.author}</p>}
            </div>
          ))}
        </div>
      )}

      {showTcs && tcs && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Terms &amp; Conditions
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "pre-line" }}>{tcs}</p>
        </div>
      )}
    </div>
  );
}

function BrochureFooter({ phone, email, bizName, accentColor }: { phone: string; email: string; bizName: string; accentColor: string }) {
  if (!phone && !email && !bizName) return null;
  return (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `2px solid ${accentColor}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div>
        {bizName && <p style={{ fontSize: 13, fontWeight: 800, color: "#0a1722", margin: 0 }}>{bizName}</p>}
        <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
          {phone && <span style={{ fontSize: 11, color: "#6b7280" }}>{phone}</span>}
          {email && <span style={{ fontSize: 11, color: "#6b7280" }}>{email}</span>}
        </div>
      </div>
      <p style={{ fontSize: 10, color: "#d1d5db", margin: 0 }}>
        Generated by Swiftscope
      </p>
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
