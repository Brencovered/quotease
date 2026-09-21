"use client";

import { useState } from "react";
import { Mail, Phone, Globe, Send, RefreshCw, Check } from "lucide-react";

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

export default function OutreachPriorityPanel({ candidates }: { candidates: OutreachCandidate[] }) {
  const emailable = candidates.filter(c => c.email);
  const [selected, setSelected] = useState<Set<string>>(new Set(emailable.map(c => c.id)));
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (selected.size === 0) return;
    setSending(true);
    setResult(null);
    const res = await fetch("/api/admin/directory/send-claim-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingIds: [...selected] }),
    });
    const data = await res.json();
    setResult(data);
    setSending(false);
  }

  if (candidates.length === 0) {
    return (
      <div className="card">
        <p className="text-[12.5px] text-[var(--ink-faint)]">No qualifying candidates right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="space-y-3">
          {candidates.map((c) => {
            const isSelected = selected.has(c.id);
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => c.email && toggle(c.id)}
                    disabled={!c.email}
                    title={c.email ? undefined : "No email on file - can't be sent to"}
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
          onClick={sendInvites}
          disabled={sending || selected.size === 0}
          className="btn-primary px-5 py-2.5 flex items-center gap-2 text-[13px]"
        >
          {sending
            ? <><RefreshCw size={13} className="animate-spin" /> Sending...</>
            : <><Send size={13} /> Send claim invite to {selected.size} business{selected.size !== 1 ? "es" : ""}</>}
        </button>
        {emailable.length < candidates.length && (
          <span className="text-[11.5px] text-[var(--ink-faint)]">
            {candidates.length - emailable.length} candidate{candidates.length - emailable.length !== 1 ? "s have" : " has"} no email on file, can&apos;t be sent to
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
