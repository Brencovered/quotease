"use client";

import { useState, useMemo } from "react";
import {
  Mail, Users, Filter, Send, Eye, ChevronDown, ChevronUp,
  Check, X, AlertTriangle, Sparkles, FileText,
} from "lucide-react";

interface DirectoryListing {
  id: string; business_name: string | null; email: string;
  trade: string | null; suburb: string | null; state: string | null;
}
interface TradieProfile {
  id: string; business_name: string | null; contact_email: string;
  trades: string[] | null; subscription_status: string | null;
}

// ── Email templates ──────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "intro",
    label: "Swiftscope intro",
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
    id: "followup",
    label: "Follow-up / check in",
    subject: "Have you had a chance to look at Swiftscope?",
    html: `<p>Hi there,</p>
<p>Just following up on our earlier note about Swiftscope.</p>
<p>If you haven't had a chance to explore it yet, we'd love to show you how tradies are using it to quote faster and win more jobs on site.</p>
<p>The 3-day free trial is still open — no card required, takes about 5 minutes to set up.</p>
<p><a href="https://swiftscope.com.au/signup">Try Swiftscope free</a></p>
<p>Reply to this email if you have any questions — we're always happy to help.</p>
<p>The Swiftscope team</p>`,
  },
  {
    id: "directory",
    label: "Join the directory",
    subject: "Get found by homeowners in your area — free on Swiftscope",
    html: `<p>Hi there,</p>
<p>We've built a tradie directory at swiftscope.com.au where homeowners in your area are already searching for local trade businesses.</p>
<p>Getting listed is free. You'll get a profile page with your Google rating, your trades, and a direct contact button for homeowners to reach you.</p>
<p>If you want to go further, the full Swiftscope platform — quoting, job management, scheduling, and Xero sync — is $45/month flat. But the directory listing costs nothing.</p>
<p><a href="https://swiftscope.com.au/signup">Create your free listing</a></p>
<p>The Swiftscope team</p>`,
  },
  {
    id: "custom",
    label: "Write my own",
    subject: "",
    html: "",
  },
];

const TRADES = ["electrician","plumber","carpenter","roofer","painter","tiler","landscaper","builder","plasterer","concreter"];

export default function AdminOutreachPanel({
  directoryListings,
  tradieProfiles,
}: {
  directoryListings: DirectoryListing[];
  tradieProfiles:    TradieProfile[];
}) {
  // Audience
  const [audience, setAudience]       = useState<"directory" | "registered" | "both">("directory");
  const [tradeFilter, setTradeFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Compose
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [subject,    setSubject]    = useState(TEMPLATES[0].subject);
  const [html,       setHtml]       = useState(TEMPLATES[0].html);
  const [showPreview, setShowPreview] = useState(false);

  // Send state
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [confirm,  setConfirm]  = useState(false);

  function applyTemplate(id: string) {
    const t = TEMPLATES.find(t => t.id === id)!;
    setTemplateId(id);
    if (id !== "custom") { setSubject(t.subject); setHtml(t.html); }
  }

  // Build recipient list
  const recipients = useMemo(() => {
    const emails = new Set<string>();

    if (audience === "directory" || audience === "both") {
      directoryListings.forEach(l => {
        if (!l.email) return;
        if (tradeFilter.length && l.trade && !tradeFilter.some(t => l.trade!.toLowerCase().includes(t))) return;
        if (stateFilter && l.state !== stateFilter) return;
        emails.add(l.email.toLowerCase());
      });
    }

    if (audience === "registered" || audience === "both") {
      tradieProfiles.forEach(p => {
        if (!p.contact_email) return;
        if (tradeFilter.length && p.trades && !p.trades.some(t => tradeFilter.includes(t.toLowerCase()))) return;
        emails.add(p.contact_email.toLowerCase());
      });
    }

    return [...emails];
  }, [audience, tradeFilter, stateFilter, directoryListings, tradieProfiles]);

  const states = [...new Set(directoryListings.map(l => l.state).filter(Boolean))].sort();

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
      setResult({ sent: 0, failed: recipients.length, errors: [e instanceof Error ? e.message : "Unknown error"] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[1.8rem] text-[var(--ink)]">Outreach</h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
          Send email campaigns to directory listings and registered tradies via Swiftscope.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">

        {/* ── LEFT: Audience ─────────────────────────────── */}
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Audience</p>

            {/* Source */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                ["directory",   "Directory",  directoryListings.length],
                ["registered",  "Registered", tradieProfiles.length],
                ["both",        "Both",       directoryListings.length + tradieProfiles.length],
              ] as [typeof audience, string, number][]).map(([val, label, count]) => (
                <button key={val} onClick={() => setAudience(val)}
                  className="flex flex-col items-center py-3 rounded-xl border-2 transition-all"
                  style={{ borderColor: audience === val ? "var(--navy)" : "var(--line)", background: audience === val ? "var(--navy)" : "var(--surface)" }}>
                  <Users size={16} className={audience === val ? "text-[var(--amber)] mb-1" : "text-[var(--ink-faint)] mb-1"} />
                  <p className={`font-bold text-[12px] ${audience === val ? "text-white" : "text-[var(--ink)]"}`}>{label}</p>
                  <p className={`text-[11px] ${audience === val ? "text-white/60" : "text-[var(--ink-faint)]"}`}>{count} contacts</p>
                </button>
              ))}
            </div>

            {/* Filters */}
            <button onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] mb-2">
              <Filter size={13} />
              Filters
              {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {(tradeFilter.length > 0 || stateFilter) && (
                <span className="ml-1 text-[11px] font-bold text-[var(--amber-deep)] bg-amber-50 px-1.5 py-0.5 rounded-full">
                  {tradeFilter.length + (stateFilter ? 1 : 0)} active
                </span>
              )}
            </button>

            {showFilters && (
              <div className="space-y-3 mb-3">
                <div>
                  <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">Trade</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TRADES.map(t => (
                      <button key={t} onClick={() => setTradeFilter(prev =>
                        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                      )}
                        className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full capitalize transition-colors"
                        style={{
                          background: tradeFilter.includes(t) ? "var(--navy)" : "var(--app-bg)",
                          color: tradeFilter.includes(t) ? "white" : "var(--ink-soft)",
                          border: `1px solid ${tradeFilter.includes(t) ? "var(--navy)" : "var(--line)"}`,
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {states.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1.5">State</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setStateFilter("")}
                        className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                        style={{ background: !stateFilter ? "var(--navy)" : "var(--app-bg)", color: !stateFilter ? "white" : "var(--ink-soft)", border: `1px solid ${!stateFilter ? "var(--navy)" : "var(--line)"}` }}>
                        All states
                      </button>
                      {states.map(s => (
                        <button key={s} onClick={() => setStateFilter(s === stateFilter ? "" : s!)}
                          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                          style={{ background: stateFilter === s ? "var(--navy)" : "var(--app-bg)", color: stateFilter === s ? "white" : "var(--ink-soft)", border: `1px solid ${stateFilter === s ? "var(--navy)" : "var(--line)"}` }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recipient count */}
            <div className="flex items-center justify-between bg-[var(--app-bg)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-[var(--amber-deep)]" />
                <span className="font-bold text-[14px] text-[var(--ink)]">{recipients.length} recipients</span>
              </div>
              {recipients.length > 0 && (
                <span className="text-[11.5px] text-[var(--ink-faint)]">
                  {recipients.slice(0, 2).join(", ")}{recipients.length > 2 ? ` +${recipients.length - 2} more` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Compose ─────────────────────────────── */}
        <div className="space-y-4">
          <div className="card">
            <p className="section-tag mb-3">Compose</p>

            {/* Template picker */}
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-2">Template</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all text-[12.5px] font-semibold"
                    style={{ borderColor: templateId === t.id ? "var(--navy)" : "var(--line)", background: templateId === t.id ? "rgba(10,23,34,.04)" : "white" }}>
                    {t.id === "custom" ? <Sparkles size={12} /> : <FileText size={12} />}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)] mb-1">Subject line</p>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none focus:border-[var(--navy)] transition-colors"
              />
            </div>

            {/* Body */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">Email body (HTML)</p>
                <button onClick={() => setShowPreview(p => !p)} className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--navy)]">
                  <Eye size={12} /> {showPreview ? "Hide" : "Preview"}
                </button>
              </div>
              {showPreview ? (
                <div
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-4 text-[13.5px] min-h-[180px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <textarea
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  placeholder="<p>Your email body HTML...</p>"
                  rows={8}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[12.5px] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--navy)] transition-colors resize-y"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Send bar ──────────────────────────────────────── */}
      {!result && (
        <div className="card">
          {!confirm ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-[14px] text-[var(--ink)]">
                  Ready to send to {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
                </p>
                <p className="text-[12.5px] text-[var(--ink-soft)] mt-0.5">
                  From: team@swiftscope.com.au via Resend
                </p>
              </div>
              <button
                onClick={() => setConfirm(true)}
                disabled={!recipients.length || !subject.trim() || !html.trim()}
                className="btn-primary px-6 py-3 shrink-0 disabled:opacity-40"
              >
                <Send size={14} /> Review and send
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[14px] text-[var(--ink)]">
                    Confirm: send to {recipients.length} email address{recipients.length !== 1 ? "es" : ""}?
                  </p>
                  <p className="text-[12.5px] text-[var(--ink-soft)] mt-0.5">
                    Subject: <span className="font-semibold">{subject}</span>
                  </p>
                  <p className="text-[12px] text-[var(--ink-faint)] mt-1">This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={sendEmails}
                  disabled={sending}
                  className="btn-primary px-6 py-2.5 shrink-0"
                >
                  {sending ? "Sending..." : <><Send size={13} /> Yes, send now</>}
                </button>
                <button onClick={() => setConfirm(false)} disabled={sending} className="btn-secondary px-5 py-2.5">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Result ────────────────────────────────────────── */}
      {result && (
        <div className={`card border-2 ${result.failed === 0 ? "border-green-200" : "border-amber-200"}`}>
          <div className="flex items-start gap-3">
            {result.failed === 0
              ? <Check size={20} className="text-green-500 shrink-0 mt-0.5" />
              : <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-bold text-[15px] text-[var(--ink)]">
                {result.sent} sent{result.failed > 0 ? `, ${result.failed} failed` : " successfully"}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[11.5px] text-red-600 font-mono">{e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-[11.5px] text-[var(--ink-faint)]">...and {result.errors.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setResult(null)} className="text-[var(--ink-faint)] hover:text-[var(--red)] shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
