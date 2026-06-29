"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, AlertTriangle } from "lucide-react";
import type { EngagementResult } from "@/lib/adminEngagement";

interface QuoteRow {
  id: string;
  client_name: string | null;
  trade: string;
  job_type: string | null;
  total_cost: number | null;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  trades: string[];
  subscription_status: string;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  onboarded_at: string | null;
  created_at: string;
  abn: string | null;
  license_number: string | null;
  business_address: string | null;
  hourly_rate: number;
  materials_margin_pct: number;
}

export default function AdminTradieDetailPanel({
  detail,
}: {
  detail: { profile: ProfileRow; quotes: QuoteRow[]; lastSignIn: string | null; engagement: EngagementResult };
}) {
  const { profile, quotes, lastSignIn, engagement } = detail;
  const [accessing, setAccessing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  async function accessAccount() {
    const confirmed = window.confirm(
      "This opens a magic-link sign-in as this tradie in a new tab.\n\n" +
      "Heads up: browser sessions are shared across tabs, so this will log YOUR browser into their account, not just the new tab. " +
      "Use an incognito/private window if you want to keep your own admin session active.\n\n" +
      "Continue?"
    );
    if (!confirmed) return;

    setAccessing(true); setAccessError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const body = await res.json();
      if (!res.ok) { setAccessError(body.error ?? "Could not generate a login link"); return; }
      window.open(body.url, "_blank");
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setAccessing(false);
    }
  }

  return (
    <div>
      <Link href="/admin/tradies" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> All tradie accounts
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">{profile.business_name || "Unnamed business"}</h1>
          <p className="text-[13.5px] text-[var(--ink-faint)]">
            {profile.contact_email} {profile.contact_phone ? `· ${profile.contact_phone}` : ""}
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={accessAccount}
            disabled={accessing}
            className="inline-flex items-center gap-1.5 bg-[var(--navy)] text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {accessing ? "Generating link..." : "Access this account"}
          </button>
          {accessError && (
            <p className="text-[12px] text-[var(--red)] mt-1.5 max-w-xs">{accessError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Engagement */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 lg:col-span-1">
          <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-3">Engagement & onboarding</p>
          <div className="flex items-end justify-between mb-1.5">
            <span className="font-display text-3xl text-[var(--ink)]">{engagement.pct}%</span>
            <span className="text-[12px] text-[var(--ink-faint)] mb-1.5">{engagement.furthestLabel}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--app-bg)] overflow-hidden mb-4">
            <div className="h-full rounded-full bg-[var(--amber)]" style={{ width: `${engagement.pct}%` }} />
          </div>
          <ul className="space-y-2">
            {engagement.milestones.map((m) => (
              <li key={m.key} className="flex items-center gap-2 text-[13px]">
                {m.done
                  ? <CheckCircle2 className="w-4 h-4 text-[var(--green)] shrink-0" />
                  : <Circle className="w-4 h-4 text-[var(--line)] shrink-0" />}
                <span className={m.done ? "text-[var(--ink)]" : "text-[var(--ink-faint)]"}>{m.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Account info */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 lg:col-span-1">
          <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-3">Account</p>
          <dl className="space-y-2 text-[13px]">
            <Row label="Trades" value={profile.trades.length ? profile.trades.join(", ") : "Not picked yet"} />
            <Row label="Plan" value={profile.subscription_plan ?? " - "} />
            <Row label="Status" value={profile.subscription_status} />
            <Row label="Trial ends" value={fmtDate(profile.trial_ends_at)} />
            <Row label="Signed up" value={fmtDate(profile.created_at)} />
            <Row label="Onboarded" value={fmtDate(profile.onboarded_at)} />
            <Row label="Last login" value={fmtDate(lastSignIn)} />
            <Row label="Hourly rate" value={`$${profile.hourly_rate}`} />
            <Row label="Margin" value={`${profile.materials_margin_pct}%`} />
          </dl>
        </div>

        {/* Business details */}
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 lg:col-span-1">
          <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-3">Business details</p>
          <dl className="space-y-2 text-[13px]">
            <Row label="ABN" value={profile.abn ?? " - "} />
            <Row label="Licence" value={profile.license_number ?? " - "} />
            <Row label="Address" value={profile.business_address ?? " - "} />
          </dl>
          {!profile.business_address && !profile.abn && (
            <p className="flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)] mt-3">
              <AlertTriangle className="w-3.5 h-3.5" /> Business profile not filled in
            </p>
          )}
        </div>
      </div>

      {/* Quotes */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
        <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold px-5 pt-4 pb-3">
          Quotes ({quotes.length})
        </p>
        {quotes.length === 0 ? (
          <p className="px-5 pb-5 text-[13.5px] text-[var(--ink-faint)]">No quotes created yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between px-5 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{q.client_name || "No client name"}</p>
                  <p className="text-[12px] text-[var(--ink-faint)]">
                    {q.trade}{q.job_type ? ` · ${q.job_type}` : ""} · {fmtDate(q.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13.5px] font-semibold text-[var(--ink)]">${(q.total_cost ?? 0).toLocaleString()}</p>
                  <p className="text-[11.5px] text-[var(--ink-faint)] capitalize">{q.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--ink-faint)]">{label}</dt>
      <dd className="font-semibold text-[var(--ink)] text-right">{value}</dd>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return " - ";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
