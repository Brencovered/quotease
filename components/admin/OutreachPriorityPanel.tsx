"use client";

import { useState } from "react";
import { Mail, Phone, Globe, Send, RefreshCw, Check, Eye, ArrowLeft, X } from "lucide-react";

export interface OutreachCandidate {
  id: string;
  businessName: string;
  suburb: string | null;
  sessions: number;
  googleRating: number | null;
  googleReviewsCount: number | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
}

interface SendResult {
  sent: number;
  skippedNoEmail: number;
  skippedAlreadyClaimed: number;
  failed: number;
  errors: string[];
}

interface EmailPreview {
  id: string;
  businessName: string;
  toEmail: string | null;
  isClaimed: boolean;
  subject: string;
  html: string;
}

/**
 * Wires the traffic+review-validated candidate list to the existing
 * send-claim-invite endpoint, with two things added on top of the
 * bare "click Send" version: manual email entry for candidates the
 * scraper never found one for (real ask: "add an email address to
 * the businesses we don't have one for"), and a genuine review step
 * before anything sends (real ask: "I need to be able to review the
 * emails going out") - the actual rendered subject/body per business,
 * not just a selected-count, via a dedicated preview endpoint that
 * renders the exact same template send-claim-invite uses without
 * sending anything.
 *
 * Keeps candidates in local state (initialised from the server-
 * fetched props) so a manually-added email updates the UI immediately
 * without needing a full page reload.
 */
export default function OutreachPriorityPanel({ candidates: initialCandidates }: { candidates: OutreachCandidate[] }) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const emailable = candidates.filter(c => c.email);
  const [selected, setSelected] = useState<Set<string>>(new Set(emailable.map(c => c.id)));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previews, setPreviews] = useState<EmailPreview[] | null>(null);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startEditingEmail(id: string) {
    setEditingId(id);
    setEmailDraft("");
  }

  async function saveEmail(id: string) {
    const trimmed = emailDraft.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return; // basic sanity check, not exhaustive validation
    setSavingEmail(true);
    const res = await fetch("/api/admin/directory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, private_email: trimmed }),
    });
    if (res.ok) {
      setCandidates((prev) => prev.map(c => c.id === id ? { ...c, email: trimmed } : c));
      setSelected((prev) => new Set(prev).add(id));
      setEditingId(null);
    }
    setSavingEmail(false);
  }

  async function loadPreview() {
    if (selected.size === 0) return;
    setLoadingPreview(true);
    setPreviews(null);
    const res = await fetch("/api/admin/directory/preview-claim-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingIds: [...selected] }),
    });
    const data = await res.json();
    setPreviews(data.previews ?? []);
    setLoadingPreview(false);
  }

  async function confirmSend() {
    if (!previews || previews.length === 0) return;
    setSending(true);
    setResult(null);
    const res = await fetch("/api/admin/directory/send-claim-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingIds: previews.map(p => p.id) }),
    });
    const data = await res.json();
    setResult(data);
    setSending(false);
    setPreviews(null);
  }

  if (candidates.length === 0) {
    return (
      <div className="card">
        <p className="text-[12.5px] text-[var(--ink-faint)]">No qualifying candidates right now</p>
      </div>
    );
  }

  // Review step - shows the exact rendered email per selected business
  // before the real send happens.
  if (previews) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Reviewing {previews.length} email{previews.length !== 1 ? "s" : ""} before sending</p>
          <button onClick={() => setPreviews(null)} className="flex items-center gap-1 text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
            <ArrowLeft size={12} /> Back to selection
          </button>
        </div>

        <div className="card space-y-2 max-h-[480px] overflow-y-auto">
          {previews.map((p) => (
            <div key={p.id} className="border-b border-[var(--line)] last:border-0 pb-2 last:pb-0">
              <button
                onClick={() => setExpandedPreviewId(expandedPreviewId === p.id ? null : p.id)}
                className="w-full flex items-center justify-between gap-3 py-1.5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[var(--ink)] truncate">{p.businessName}</p>
                  <p className="text-[11px] text-[var(--ink-faint)] truncate">
                    To: {p.toEmail ?? "no email"} · {p.subject}
                  </p>
                </div>
                <Eye size={14} className="text-[var(--ink-faint)] shrink-0" />
              </button>
              {expandedPreviewId === p.id && (
                <div className="bg-[var(--app-bg)] rounded-lg p-3 mt-1">
                  <div className="bg-white rounded border border-[var(--line)] p-3" dangerouslySetInnerHTML={{ __html: p.html }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={confirmSend}
          disabled={sending}
          className="btn-primary px-5 py-2.5 flex items-center gap-2 text-[13px]"
        >
          {sending
            ? <><RefreshCw size={13} className="animate-spin" /> Sending...</>
            : <><Send size={13} /> Confirm & send {previews.length} email{previews.length !== 1 ? "s" : ""}</>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="space-y-3">
          {candidates.map((c) => {
            const isSelected = selected.has(c.id);
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => c.email && toggle(c.id)}
                    disabled={!c.email}
                    title={c.email ? undefined : "No email on file - add one to enable sending"}
                    className={[
                      "shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      !c.email ? "border-[var(--line)] bg-[var(--app-bg)] cursor-not-allowed" :
                      isSelected ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[var(--line)]",
                    ].join(" ")}
                  >
                    {isSelected && c.email && <Check size={11} className="text-white" />}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13px] text-[var(--ink)]">{c.businessName}</span>
                      {c.suburb && <span className="text-[11.5px] text-[var(--ink-faint)]">{c.suburb}</span>}
                      {c.googleRating != null && (
                        <span className="text-[11px] font-bold text-amber-700">
                          {c.googleRating}★ ({c.googleReviewsCount})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11.5px] text-[var(--ink-soft)]">
                      {c.phone && <span className="flex items-center gap-1"><Phone size={11} /> {c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>}
                      {c.websiteUrl && (
                        <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--navy)]">
                          <Globe size={11} /> Website
                        </a>
                      )}
                    </div>
                    {!c.email && !isEditing && (
                      <button
                        onClick={() => startEditingEmail(c.id)}
                        className="mt-1.5 text-[11px] font-semibold text-[var(--navy)] hover:underline"
                      >
                        + Add email
                      </button>
                    )}
                    {isEditing && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <input
                          type="email"
                          autoFocus
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEmail(c.id)}
                          placeholder="owner@business.com.au"
                          className="app-field text-[12px] py-1 px-2 w-56"
                        />
                        <button
                          onClick={() => saveEmail(c.id)}
                          disabled={savingEmail}
                          className="text-[11px] font-bold text-white bg-[var(--navy)] px-2.5 py-1 rounded-lg"
                        >
                          {savingEmail ? "..." : "Save"}
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-[var(--ink-faint)]">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-[var(--ink-faint)] whitespace-nowrap">{c.sessions} views</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={loadPreview}
          disabled={loadingPreview || selected.size === 0}
          className="btn-primary px-5 py-2.5 flex items-center gap-2 text-[13px]"
        >
          {loadingPreview
            ? <><RefreshCw size={13} className="animate-spin" /> Loading...</>
            : <><Eye size={13} /> Review {selected.size} email{selected.size !== 1 ? "s" : ""} before sending</>}
        </button>
        {emailable.length < candidates.length && (
          <span className="text-[11.5px] text-[var(--ink-faint)]">
            {candidates.length - emailable.length} candidate{candidates.length - emailable.length !== 1 ? "s have" : " has"} no email - add one above to include
          </span>
        )}
      </div>

      {result && (
        <div className="bg-[var(--app-bg)] rounded-xl px-4 py-3 text-[12.5px] space-y-1">
          <p><span className="font-bold text-green-600">{result.sent}</span> sent</p>
          {result.skippedAlreadyClaimed > 0 && <p className="text-[var(--ink-faint)]">{result.skippedAlreadyClaimed} skipped - claimed since this list loaded</p>}
          {result.failed > 0 && <p className="text-red-600">{result.failed} failed{result.errors.length > 0 ? `: ${result.errors[0]}` : ""}</p>}
        </div>
      )}
    </div>
  );
}
