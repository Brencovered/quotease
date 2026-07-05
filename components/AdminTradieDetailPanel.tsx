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
  comp_access?: boolean;
  ai_analyses_limit_override?: number | null;
  ai_free_analyses_used?: number;
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
            <Row label="Status" value={profile.comp_access ? `${profile.subscription_status} (comp access)` : profile.subscription_status} />
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

      {/* Account controls */}
      <AccountControlsCard profile={profile} />

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

/* ------------------------------------------------------------------ */
/* Account controls: trial extension, comp access, AI drawings limit  */
/* ------------------------------------------------------------------ */

function AccountControlsCard({ profile }: { profile: ProfileRow }) {
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(profile.trial_ends_at);
  const [compAccess, setCompAccess] = useState<boolean>(profile.comp_access ?? false);
  const [aiLimit, setAiLimit] = useState<string>(
    profile.ai_analyses_limit_override != null ? String(profile.ai_analyses_limit_override) : ""
  );
  const [saving, setSaving] = useState<string | null>(null); // which control is saving
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function apply(controls: { trialEndsAt?: string | null; compAccess?: boolean; aiLimitOverride?: number | null }, which: string) {
    setSaving(which); setError(null); setSavedMsg(null);
    try {
      const res = await fetch("/api/admin/account-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, ...controls }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      if ("trial_ends_at" in json.profile) setTrialEndsAt(json.profile.trial_ends_at);
      if ("comp_access" in json.profile) setCompAccess(json.profile.comp_access);
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(null);
    }
  }

  function extendTrial(days: number) {
    const base = trialEndsAt && new Date(trialEndsAt) > new Date() ? new Date(trialEndsAt) : new Date();
    base.setDate(base.getDate() + days);
    apply({ trialEndsAt: base.toISOString() }, "trial");
  }

  const trialActive = !!trialEndsAt && new Date(trialEndsAt) > new Date();

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 mb-6">
      <p className="text-[11px] tracking-[.1em] uppercase text-[var(--amber-deep)] font-bold mb-4">
        Account controls
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Trial extension */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)] mb-1">Trial</p>
          <p className="text-[12px] text-[var(--ink-faint)] mb-2">
            {trialActive
              ? `Ends ${fmtDate(trialEndsAt)}`
              : trialEndsAt
                ? `Expired ${fmtDate(trialEndsAt)}`
                : "No trial set"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => extendTrial(7)}
              disabled={saving !== null}
              className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--amber)] disabled:opacity-50"
            >
              +7 days
            </button>
            <button
              onClick={() => extendTrial(30)}
              disabled={saving !== null}
              className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--amber)] disabled:opacity-50"
            >
              +30 days
            </button>
            <button
              onClick={() => extendTrial(90)}
              disabled={saving !== null}
              className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--amber)] disabled:opacity-50"
            >
              +90 days
            </button>
          </div>
          <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">
            Extends from {trialActive ? "current end date" : "today"}
          </p>
        </div>

        {/* Comp access */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)] mb-1">Free access</p>
          <p className="text-[12px] text-[var(--ink-faint)] mb-2">
            {compAccess
              ? "Complimentary access ON — billing bypassed"
              : "Normal billing applies"}
          </p>
          <button
            onClick={() => {
              const next = !compAccess;
              const confirmed = window.confirm(
                next
                  ? "Grant complimentary access? This tradie will never hit the billing wall until you turn it off."
                  : "Revoke complimentary access? If their trial has expired and they have no subscription, they'll be sent to billing on next page load."
              );
              if (confirmed) apply({ compAccess: next }, "comp");
            }}
            disabled={saving !== null}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
              compAccess ? "bg-[var(--amber)]" : "bg-[var(--line)]"
            }`}
            aria-label="Toggle complimentary access"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                compAccess ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* AI drawings limit */}
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)] mb-1">AI drawing analyses</p>
          <p className="text-[12px] text-[var(--ink-faint)] mb-2">
            Used: {profile.ai_free_analyses_used ?? 0} · Limit:{" "}
            {profile.ai_analyses_limit_override != null
              ? `${profile.ai_analyses_limit_override} (custom)`
              : "3 (default)"}
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={0}
              max={10000}
              value={aiLimit}
              onChange={(e) => setAiLimit(e.target.value)}
              placeholder="e.g. 50"
              className="w-24 text-[13px] px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-transparent"
            />
            <button
              onClick={() => {
                const n = aiLimit.trim() === "" ? null : parseInt(aiLimit, 10);
                if (n !== null && (isNaN(n) || n < 0)) { setError("Limit must be 0 or more"); return; }
                apply({ aiLimitOverride: n }, "ai");
              }}
              disabled={saving !== null}
              className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--amber)] disabled:opacity-50"
            >
              Set
            </button>
            <button
              onClick={() => { setAiLimit(""); apply({ aiLimitOverride: null }, "ai"); }}
              disabled={saving !== null}
              className="text-[12px] px-2.5 py-1.5 rounded-lg text-[var(--ink-faint)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              Reset to default
            </button>
          </div>
          <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">
            Empty + Set, or Reset, restores the default (3)
          </p>
        </div>
      </div>

      {(error || savedMsg || saving) && (
        <p className={`text-[12px] mt-3 ${error ? "text-red-600" : "text-[var(--green)]"}`}>
          {error ?? (saving ? "Saving..." : savedMsg)}
        </p>
      )}

      <DeleteAccountZone profile={profile} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Danger zone: permanent account deletion                            */
/* ------------------------------------------------------------------ */

function DeleteAccountZone({ profile }: { profile: ProfileRow }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const expected = (profile.business_name ?? "").trim();
  const matches = confirmText.trim().toLowerCase() === expected.toLowerCase() && expected.length > 0;

  async function handleDelete() {
    if (!matches) return;
    setDeleting(true); setError(null);
    try {
      const res = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 pt-5 border-t border-[var(--line)]">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Account deleted.</p>
        <Link href="/admin/tradies" className="text-[12.5px] text-[var(--amber-deep)] hover:underline">Back to tradie list</Link>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-5 border-t border-[var(--line)]">
      <p className="text-[11px] tracking-[.1em] uppercase text-red-600 font-bold mb-2">Danger zone</p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
        >
          Delete this account
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md">
          <p className="text-[13px] text-red-800 font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle size={14} /> This permanently deletes everything
          </p>
          <p className="text-[12.5px] text-red-700 mb-3">
            All quotes, clients, price book items, job files, and invoices for{" "}
            <strong>{expected || "this account"}</strong> will be permanently deleted, any active
            subscription will be canceled immediately, and the login will be removed. This cannot be undone.
          </p>
          <p className="text-[12px] text-red-700 mb-2">
            Type <strong>{expected}</strong> to confirm:
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full text-[13px] px-2.5 py-1.5 rounded-lg border border-red-300 bg-white mb-3"
            placeholder={expected}
          />
          {error && <p className="text-[12px] text-red-700 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={!matches || deleting}
              className="text-[12.5px] font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmText(""); setError(null); }}
              disabled={deleting}
              className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
