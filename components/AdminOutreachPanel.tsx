"use client";

import { useState, useMemo } from "react";
import {
  Mail, Users, Filter, Send, Eye, ChevronDown, ChevronUp,
  Check, X, AlertTriangle, Sparkles, FileText, Search,
  CheckSquare, Square, Building2, UserCheck,
} from "lucide-react";

interface DirectoryListing {
  id: string; business_name: string | null; email: string;
  trades: string[]; suburb: string | null; postcode: string | null;
}
interface TradieProfile {
  id: string; business_name: string | null; contact_email: string;
  trades: string[] | null; subscription_status: string | null;
}

type ContactSource = "directory" | "registered";
interface Contact {
  id:     string;
  name:   string;
  email:  string;
  trades: string[];
  suburb: string;
  postcode: string;
  source: ContactSource;
  status: string;
}

const TEMPLATES = [
  {
    id: "intro", label: "Swiftscope intro",
    subject: "The quoting tool tradies are using to win jobs on the driveway",
    html: `<p>Hi there,</p>
<p>We're Swiftscope — a quoting and job management platform built specifically for Australian trade businesses.</p>
<p>Tradies using Swiftscope are quoting on site from their phone in minutes, sending professional quotes before leaving the driveway, and winning more jobs because their clients can say yes before anyone else calls.</p>
<p>It replaces the patchwork of tools most trade businesses are stitching together — job management, scheduling, drawing markup, and Xero sync — for a flat $45/month with no per-seat fees.</p>
<p>We're offering a free 3-day trial with no credit card required.</p>
<p><a href="https://swiftscope.com.au/signup">Start your free trial here</a></p>
<p>The Swiftscope team<br/>swiftscope.com.au</p>`,
  },
  {
    id: "followup", label: "Follow-up",
    subject: "Have you had a chance to look at Swiftscope?",
    html: `<p>Hi there,</p>
<p>Just following up on our earlier note about Swiftscope.</p>
<p>If you haven't had a chance to explore it yet, we'd love to show you how tradies are using it to quote faster and win more jobs on site.</p>
<p>The 3-day free trial is still open — no card required, takes about 5 minutes to set up.</p>
<p><a href="https://swiftscope.com.au/signup">Try Swiftscope free</a></p>
<p>The Swiftscope team</p>`,
  },
  {
    id: "directory", label: "Join the directory",
    subject: "Get found by homeowners in your area — free on Swiftscope",
    html: `<p>Hi there,</p>
<p>We've built a tradie directory at swiftscope.com.au where homeowners in your area are already searching for local trade businesses.</p>
<p>Getting listed is free. You'll get a profile page with your Google rating, your trades, and a direct contact button for homeowners to reach you.</p>
<p><a href="https://swiftscope.com.au/signup">Create your free listing</a></p>
<p>The Swiftscope team</p>`,
  },
  { id: "custom", label: "Write my own", subject: "", html: "" },
];

const TRADES = ["electrician","plumber","carpenter","roofer","painter","tiler","landscaper","builder","plasterer","concreter"];

export default function AdminOutreachPanel({
  directoryListings,
  tradieProfiles,
}: {
  directoryListings: DirectoryListing[];
  tradieProfiles:    TradieProfile[];
}) {
  // ── Build master contact list ─────────────────────────
  const allContacts = useMemo<Contact[]>(() => {
    const map = new Map<string, Contact>();

    directoryListings.forEach(l => {
      if (!l.email) return;
      const key = l.email.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id:     l.id,
          name:   l.business_name ?? l.email,
          email:  key,
          trades: l.trades ?? [],
          suburb: l.suburb ?? "",
          postcode: l.postcode ?? "",
          source: "directory",
          status: "",
        });
      }
    });

    tradieProfiles.forEach(p => {
      if (!p.contact_email) return;
      const key = p.contact_email.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id:     p.id,
          name:   p.business_name ?? p.contact_email,
          email:  key,
          trades: p.trades ?? [],
          suburb: "",
          postcode: "",
          source: "registered",
          status: p.subscription_status ?? "",
        });
      }
    });

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [directoryListings, tradieProfiles]);

  // ── Filter state ──────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [srcFilter,   setSrcFilter]   = useState<"all"|"directory"|"registered">("all");
  const [tradeFilter, setTradeFilter] = useState<string>("");
  const [stateFilter, setStateFilter] = useState<string>(""); // used as postcode filter
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => allContacts.filter(c => {
    if (srcFilter !== "all" && c.source !== srcFilter) return false;
    if (tradeFilter && !c.trades.some(t => t.toLowerCase().includes(tradeFilter))) return false;
    if (stateFilter && c.postcode !== stateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.email.includes(q) && !c.trades.some(t=>t.toLowerCase().includes(q)) && !c.suburb.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [allContacts, srcFilter, tradeFilter, stateFilter, search]);

  // ── Selection state ───────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleOne(email: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(email) ? n.delete(email) : n.add(email);
      return n;
    });
  }

  function toggleAll() {
    const filteredEmails = filtered.map(c => c.email);
    const allSelected = filteredEmails.every(e => selected.has(e));
    setSelected(prev => {
      const n = new Set(prev);
      if (allSelected) filteredEmails.forEach(e => n.delete(e));
      else filteredEmails.forEach(e => n.add(e));
      return n;
    });
  }

  function selectBySource(src: ContactSource) {
    setSelected(prev => {
      const n = new Set(prev);
      allContacts.filter(c => c.source === src).forEach(c => n.add(c.email));
      return n;
    });
  }

  const filteredAllSelected = filtered.length > 0 && filtered.every(c => selected.has(c.email));
  const filteredSomeSelected = filtered.some(c => selected.has(c.email));

  const postcodes = [...new Set(allContacts.map(c => c.postcode).filter(Boolean))].sort();
  const recipients = [...selected];

  // ── Compose ───────────────────────────────────────────
  const [templateId,  setTemplateId]  = useState(TEMPLATES[0].id);
  const [subject,     setSubject]     = useState(TEMPLATES[0].subject);
  const [html,        setHtml]        = useState(TEMPLATES[0].html);
  const [showPreview, setShowPreview] = useState(false);

  function applyTemplate(id: string) {
    const t = TEMPLATES.find(t => t.id === id)!;
    setTemplateId(id);
    if (id !== "custom") { setSubject(t.subject); setHtml(t.html); }
  }

  // ── Send ──────────────────────────────────────────────
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [confirm,  setConfirm]  = useState(false);

  async function sendEmails() {
    if (!recipients.length || !subject.trim() || !html.trim()) return;
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, subject, html, text: html.replace(/<[^>]+>/g, "") }),
      });
      const data = await res.json();
      setResult(data);
      setConfirm(false);
    } catch (e) {
      setResult({ sent: 0, failed: recipients.length, errors: [e instanceof Error ? e.message : "Unknown"] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[1.8rem] text-[var(--ink)]">Outreach</h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
          Select contacts from the directory or registered accounts, compose an email, and send.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_420px] gap-5 items-start">

        {/* ── LEFT: Contact list ─────────────────────────────── */}
        <div className="card space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-[var(--app-bg)] border border-[var(--line)] rounded-xl px-3 py-2">
              <Search size={13} className="text-[var(--ink-faint)] shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, trade..."
                className="flex-1 bg-transparent text-[13px] text-[var(--ink)] focus:outline-none placeholder:text-[var(--ink-faint)]"
              />
              {search && <button onClick={() => setSearch("")}><X size={12} className="text-[var(--ink-faint)]" /></button>}
            </div>

            {/* Source filter pills */}
            <div className="flex gap-1">
              {([
                ["all",        "All",        allContacts.length],
                ["directory",  "Directory",  directoryListings.filter(l=>l.email).length],
                ["registered", "Registered", tradieProfiles.filter(p=>p.contact_email).length],
              ] as [typeof srcFilter, string, number][]).map(([val, label, count]) => (
                <button key={val} onClick={() => setSrcFilter(val)}
                  className="flex items-center gap-1 text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ background: srcFilter === val ? "var(--navy)" : "var(--app-bg)", color: srcFilter === val ? "white" : "var(--ink-soft)", border: `1px solid ${srcFilter === val ? "var(--navy)" : "var(--line)"}` }}>
                  {val === "directory" ? <Building2 size={10} /> : val === "registered" ? <UserCheck size={10} /> : <Users size={10} />}
                  {label} <span className="opacity-60">({count})</span>
                </button>
              ))}
            </div>

            {/* Filters toggle */}
            <button onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-soft)] px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--app-bg)]">
              <Filter size={12} /> Filters
              {(tradeFilter || stateFilter) && <span className="w-1.5 h-1.5 bg-[var(--amber)] rounded-full" />}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 p-3 bg-[var(--app-bg)] rounded-xl border border-[var(--line-subtle)]">
              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Trade</p>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setTradeFilter("")}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors capitalize"
                    style={{ background: !tradeFilter ? "var(--navy)" : "var(--surface)", color: !tradeFilter ? "white" : "var(--ink-soft)", border: "1px solid var(--line)" }}>
                    All
                  </button>
                  {TRADES.map(t => (
                    <button key={t} onClick={() => setTradeFilter(tradeFilter === t ? "" : t)}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize transition-colors"
                      style={{ background: tradeFilter === t ? "var(--navy)" : "var(--surface)", color: tradeFilter === t ? "white" : "var(--ink-soft)", border: "1px solid var(--line)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {postcodes.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Postcode</p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    <button onClick={() => setStateFilter("")}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: !stateFilter ? "var(--navy)" : "var(--surface)", color: !stateFilter ? "white" : "var(--ink-soft)", border: "1px solid var(--line)" }}>
                      All
                    </button>
                    {postcodes.map(s => (
                      <button key={s} onClick={() => setStateFilter(stateFilter === s ? "" : s!)}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: stateFilter === s ? "var(--navy)" : "var(--surface)", color: stateFilter === s ? "white" : "var(--ink-soft)", border: "1px solid var(--line)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Select all bar */}
          <div className="flex items-center justify-between py-2 border-b border-[var(--line-subtle)]">
            <button onClick={toggleAll} className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-soft)]">
              {filteredAllSelected
                ? <CheckSquare size={15} className="text-[var(--navy)]" />
                : filteredSomeSelected
                  ? <CheckSquare size={15} className="text-[var(--ink-faint)]" />
                  : <Square size={15} className="text-[var(--ink-faint)]" />}
              {filteredAllSelected ? "Deselect all" : `Select all ${filtered.length} shown`}
            </button>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <>
                  <span className="text-[12px] font-bold text-[var(--amber-deep)] bg-amber-50 px-2.5 py-1 rounded-full">
                    {selected.size} selected
                  </span>
                  <button onClick={() => setSelected(new Set())} className="text-[11.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--red)]">
                    Clear
                  </button>
                </>
              )}
              <span className="text-[11.5px] text-[var(--ink-faint)]">
                {filtered.length} of {allContacts.length} shown
              </span>
            </div>
          </div>

          {/* Quick select shortcuts */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => selectBySource("directory")}
              className="flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)]">
              <Building2 size={10} /> All directory
            </button>
            <button onClick={() => selectBySource("registered")}
              className="flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)]">
              <UserCheck size={10} /> All registered
            </button>
          </div>

          {/* Contact rows */}
          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-[13px] text-[var(--ink-faint)] text-center py-8">No contacts match your filters</p>
            )}
            {filtered.map(c => {
              const isSelected = selected.has(c.email);
              return (
                <button
                  key={c.email}
                  onClick={() => toggleOne(c.email)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{ background: isSelected ? "rgba(10,23,34,.05)" : "transparent", border: `1px solid ${isSelected ? "var(--navy)" : "transparent"}` }}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[var(--line)]"}`}>
                    {isSelected && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] text-[var(--ink)] truncate">{c.name}</p>
                    <p className="text-[11.5px] text-[var(--ink-faint)] truncate">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.trades.slice(0,2).map(t => (
                      <span key={t} className="text-[10px] font-bold capitalize px-1.5 py-0.5 bg-[var(--app-bg)] border border-[var(--line)] rounded-full text-[var(--ink-soft)]">
                        {t}
                      </span>
                    ))}
                    {c.suburb && <span className="text-[10.5px] text-[var(--ink-faint)]">{c.suburb}</span>}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      c.source === "registered" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {c.source === "registered" ? "Registered" : "Directory"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Compose + Send ─────────────────────────── */}
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Compose</p>

            {/* Template picker */}
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-left transition-all text-[12px] font-semibold"
                  style={{ borderColor: templateId === t.id ? "var(--navy)" : "var(--line)", background: templateId === t.id ? "rgba(10,23,34,.04)" : "white" }}>
                  {t.id === "custom" ? <Sparkles size={12} /> : <FileText size={12} />}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Subject */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1">Subject</p>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none focus:border-[var(--navy)] transition-colors"
              />
            </div>

            {/* Body */}
            <div className="mb-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Email body (HTML)</p>
                <button onClick={() => setShowPreview(p => !p)} className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--navy)]">
                  <Eye size={12} /> {showPreview ? "Edit" : "Preview"}
                </button>
              </div>
              {showPreview ? (
                <div className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-4 text-[13.5px] min-h-[180px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <textarea value={html} onChange={e => setHtml(e.target.value)}
                  placeholder="<p>Email body HTML...</p>"
                  rows={9}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[12.5px] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--navy)] transition-colors resize-y" />
              )}
            </div>
          </div>

          {/* Send bar */}
          {!result && (
            <div className="card">
              {!confirm ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[14px] text-[var(--ink)]">
                        {selected.size === 0 ? "No recipients selected" : `${selected.size} recipient${selected.size !== 1 ? "s" : ""} selected`}
                      </p>
                      <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                        From: team@swiftscope.com.au via Resend
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirm(true)}
                      disabled={!selected.size || !subject.trim() || !html.trim()}
                      className="btn-primary px-5 py-2.5 shrink-0 disabled:opacity-40"
                    >
                      <Send size={13} /> Send
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[13.5px] text-[var(--ink)]">
                        Send to {selected.size} address{selected.size !== 1 ? "es" : ""}?
                      </p>
                      <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                        Subject: <span className="font-semibold">{subject}</span>
                      </p>
                      <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">This cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={sendEmails} disabled={sending} className="btn-primary px-5 py-2">
                      {sending ? "Sending..." : <><Send size={13} /> Confirm send</>}
                    </button>
                    <button onClick={() => setConfirm(false)} disabled={sending} className="btn-secondary px-4 py-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`card border-2 ${result.failed === 0 ? "border-green-200" : "border-amber-200"}`}>
              <div className="flex items-start gap-3">
                {result.failed === 0
                  ? <Check size={18} className="text-green-500 shrink-0 mt-0.5" />
                  : <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-bold text-[14px] text-[var(--ink)]">
                    {result.sent} sent{result.failed > 0 ? `, ${result.failed} failed` : " successfully"}
                  </p>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[11.5px] text-red-600 font-mono mt-1">{e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-[11.5px] text-[var(--ink-faint)]">...and {result.errors.length - 5} more</p>
                  )}
                </div>
                <button onClick={() => setResult(null)} className="text-[var(--ink-faint)] hover:text-[var(--red)] shrink-0">
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
