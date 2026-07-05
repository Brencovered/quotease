"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AccountDangerZone({
  businessName,
  subscriptionStatus,
  hasSubscription,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  compAccess,
}: {
  businessName: string;
  subscriptionStatus: string | null;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  compAccess: boolean;
}) {
  return (
    <div className="card border-2 border-red-100 mt-6">
      <p className="section-tag mb-1 !text-red-600">Danger zone</p>
      <CancelSubscriptionRow
        subscriptionStatus={subscriptionStatus}
        hasSubscription={hasSubscription}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        currentPeriodEnd={currentPeriodEnd}
        compAccess={compAccess}
      />
      <div className="border-t border-[var(--line)] mt-4 pt-4">
        <DeleteAccountRow businessName={businessName} />
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function CancelSubscriptionRow({
  subscriptionStatus, hasSubscription, cancelAtPeriodEnd, currentPeriodEnd, compAccess,
}: {
  subscriptionStatus: string | null;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  compAccess: boolean;
}) {
  const [pending, setPending] = useState(cancelAtPeriodEnd);
  const [periodEnd, setPeriodEnd] = useState(currentPeriodEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(resume: boolean) {
    if (!resume) {
      const confirmed = window.confirm(
        `Cancel your subscription? You'll keep access until ${fmtDate(periodEnd) || "the end of your current billing period"}, then it won't renew.`
      );
      if (!confirmed) return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/account/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update subscription.");
      setPending(json.cancelAtPeriodEnd);
      if (json.currentPeriodEnd) setPeriodEnd(json.currentPeriodEnd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update subscription.");
    } finally {
      setLoading(false);
    }
  }

  if (compAccess) {
    return (
      <div>
        <p className="font-semibold text-[var(--ink)] mb-1">Subscription</p>
        <p className="text-[13px] text-[var(--ink-faint)]">
          Your account has complimentary access, so there&apos;s no subscription to cancel.
        </p>
      </div>
    );
  }

  if (!hasSubscription) {
    return (
      <div>
        <p className="font-semibold text-[var(--ink)] mb-1">Subscription</p>
        <p className="text-[13px] text-[var(--ink-faint)]">
          {subscriptionStatus === "trialing" ? "You're on a free trial -- no active subscription to cancel yet." : "No active subscription found."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-semibold text-[var(--ink)] mb-1">Subscription</p>
      {pending ? (
        <>
          <p className="text-[13px] text-[var(--ink-soft)] mb-2">
            Your subscription is set to cancel on <strong>{fmtDate(periodEnd)}</strong>. You&apos;ll keep full access until then.
          </p>
          <button onClick={() => toggle(true)} disabled={loading} className="btn-secondary">
            {loading ? "Updating..." : "Resume subscription"}
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-[var(--ink-faint)] mb-2">
            {periodEnd ? `Active until ${fmtDate(periodEnd)}, renews automatically.` : "Active, renews automatically."}
          </p>
          <button
            onClick={() => toggle(false)}
            disabled={loading}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            {loading ? "Updating..." : "Cancel subscription"}
          </button>
        </>
      )}
      {error && <p className="text-[12.5px] text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function DeleteAccountRow({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = businessName.trim();
  const matches = expected.length > 0 && confirmText.trim().toLowerCase() === expected.toLowerCase();

  async function handleDelete() {
    if (!matches) return;
    setDeleting(true); setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmBusinessName: confirmText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not delete account.");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
      setDeleting(false);
    }
  }

  return (
    <div>
      <p className="font-semibold text-[var(--ink)] mb-1">Delete account</p>
      {!open ? (
        <>
          <p className="text-[13px] text-[var(--ink-faint)] mb-2">
            Permanently deletes your account and everything in it -- quotes, clients, price book, job files. This cannot be undone.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
          >
            Delete my account
          </button>
        </>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-[13px] text-red-800 font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle size={14} /> This can&apos;t be undone
          </p>
          <p className="text-[12.5px] text-red-700 mb-3">
            All quotes, clients, price book items, and job files will be permanently deleted, any active
            subscription will be canceled immediately, and you&apos;ll be logged out for good.
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
              {deleting ? "Deleting..." : "Permanently delete my account"}
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
