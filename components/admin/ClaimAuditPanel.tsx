"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Check, Clock, RefreshCw, Shield, Trash2, Users, X } from "lucide-react";

interface Summary {
  totalAttempts: number;
  claimedExistingListing: number;
  claimedButUnverified: number;
  createdNew: number;
  disputed: number;
  missingIp: number;
}

interface PendingClaim {
  attemptId: string;
  business: string;
  suburb: string;
  trade: string;
  listingId: string;
  profileId: string;
  accountEmail: string | null;
  ip: string | null;
  verifiedViaEmail: string | null;
  at: string;
}

interface SharedIp {
  ip: string;
  accountCount: number;
  profileIds: string[];
}

interface UnverifiedClaim {
  business: string;
  suburb: string;
  listingId: string;
  profileId: string;
  ip: string | null;
  at: string;
}

interface AttemptRow {
  id: string;
  attempted_business_name: string;
  suburb: string;
  trade: string;
  outcome: string;
  ip_address: string | null;
  verified_via_email: string | null;
  created_at: string;
}

interface SignupRow {
  id: string;
  profileId: string | null;
  business: string | null;
  method: string | null;
  ip: string | null;
  at: string;
}

interface BlockedIp {
  ip_address: string;
  reason: string;
  blocked_by: string | null;
  created_at: string;
}

/**
 * DeleteAccountButton is used next to every profileId shown on this page
 * (pending claims, shared IPs, unverified claims) - wired to the existing
 * /api/admin/delete-account endpoint (purge_now) rather than a new
 * deletion mechanism, that one already handles Stripe cancellation, the
 * directory_listing cleanup just added to it, team_members, and the auth
 * user itself.
 */
function DeleteAccountButton({ profileId, label }: { profileId: string; label?: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "working" | "done">("idle");

  async function purge() {
    setState("working");
    const res = await fetch("/api/admin/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, action: "purge_now" }),
    });
    setState(res.ok ? "done" : "idle");
  }

  if (state === "done") return <span className="text-[11px] font-semibold text-[var(--ink-faint)]">Deleted</span>;
  if (state === "confirm") {
    return (
      <span className="flex items-center gap-1">
        <button onClick={purge} className="text-[11px] font-bold text-white bg-red-600 px-2 py-1 rounded">Confirm delete</button>
        <button onClick={() => setState("idle")} className="text-[11px] text-[var(--ink-faint)] px-1">Cancel</button>
      </span>
    );
  }
  return (
    <button onClick={() => setState("confirm")} disabled={state === "working"}
      className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 shrink-0">
      {state === "working" ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />} {label ?? "Delete account"}
    </button>
  );
}

export default function ClaimAuditPanel({
  summary, pending, sharedIps, unverifiedClaims, disputed, recent, recentSignups, blocklist,
}: {
  summary: Summary;
  pending: PendingClaim[];
  sharedIps: SharedIp[];
  unverifiedClaims: UnverifiedClaim[];
  disputed: { business: string; listingId: string; profileId: string; ip: string | null; at: string }[];
  recent: AttemptRow[];
  recentSignups: SignupRow[];
  blocklist: BlockedIp[];
}) {
  const [blockedNow, setBlockedNow] = useState<Set<string>>(new Set(blocklist.map(b => b.ip_address)));
  const [ipPending, setIpPending] = useState<string | null>(null);
  const [resolvedAttempts, setResolvedAttempts] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState<string | null>(null);

  async function blockIp(ip: string, reason: string) {
    setIpPending(ip);
    const res = await fetch("/api/admin/ip-blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, reason }),
    });
    if (res.ok) setBlockedNow((prev) => new Set(prev).add(ip));
    setIpPending(null);
  }

  async function unblockIp(ip: string) {
    setIpPending(ip);
    const res = await fetch(`/api/admin/ip-blocklist?ip=${encodeURIComponent(ip)}`, { method: "DELETE" });
    if (res.ok) setBlockedNow((prev) => { const next = new Set(prev); next.delete(ip); return next; });
    setIpPending(null);
  }

  // Small, reused wherever a single IP needs a block/unblock affordance
  // (the Recent attempts and Recent signups tables both list an IP per
  // row with no other context needed - the dedicated sections above
  // have their own richer version with more context in the reason).
  function BlockIpCell({ ip, reason }: { ip: string | null; reason: string }) {
    if (!ip) return <span className="text-[11.5px] text-[var(--ink-faint)]">—</span>;
    if (blockedNow.has(ip)) {
      return (
        <button onClick={() => unblockIp(ip)} disabled={ipPending === ip}
          className="text-[10.5px] font-bold text-green-700 hover:underline">
          Blocked
        </button>
      );
    }
    return (
      <button onClick={() => blockIp(ip, reason)} disabled={ipPending === ip}
        className="flex items-center gap-1 text-[10.5px] font-bold text-red-600 hover:underline">
        {ipPending === ip ? <RefreshCw size={10} className="animate-spin" /> : <Ban size={10} />} Block
      </button>
    );
  }

  async function resolveClaim(attemptId: string, decision: "approve" | "reject") {
    setResolving(attemptId);
    const res = await fetch("/api/admin/directory/resolve-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, decision }),
    });
    if (res.ok) setResolvedAttempts((prev) => new Set(prev).add(attemptId));
    setResolving(null);
  }

  const visiblePending = pending.filter((p) => !resolvedAttempts.has(p.attemptId));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Stat label="Pending review" value={visiblePending.length} warn={visiblePending.length > 0} />
        <Stat label="Total attempts" value={summary.totalAttempts} />
        <Stat label="Claimed existing" value={summary.claimedExistingListing} />
        <Stat label="New listings" value={summary.createdNew} />
        <Stat label="Disputed" value={summary.disputed} warn={summary.disputed > 0} />
        <Stat label="No IP recorded" value={summary.missingIp} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[var(--amber)]" />
          <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Pending review</h2>
        </div>
        <p className="text-[12px] text-[var(--ink-faint)] -mt-2">
          Nothing here is live - approve to activate the claim/listing, reject to leave it as it was (or delete it, for a self-created one)
        </p>
        <div className="card">
          {visiblePending.length === 0 ? (
            <p className="text-[12.5px] text-[var(--ink-faint)]">None waiting</p>
          ) : (
            <div className="space-y-3">
              {visiblePending.map((p) => (
                <div key={p.attemptId} className="flex items-start justify-between gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13px] text-[var(--ink)]">{p.business}</span>
                      <span className="text-[11.5px] text-[var(--ink-faint)]">{p.suburb} · {p.trade}</span>
                      {p.verifiedViaEmail ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">Email verified</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Not verified</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--ink-faint)] font-mono mt-0.5">
                      {p.accountEmail ?? "no account email"} · {p.ip ?? "no IP"} · {new Date(p.at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => resolveClaim(p.attemptId, "approve")} disabled={resolving === p.attemptId}
                      className="flex items-center gap-1 text-[11.5px] font-bold text-white bg-green-600 px-2.5 py-1.5 rounded-lg">
                      {resolving === p.attemptId ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />} Approve
                    </button>
                    <button onClick={() => resolveClaim(p.attemptId, "reject")} disabled={resolving === p.attemptId}
                      className="flex items-center gap-1 text-[11.5px] font-bold text-[var(--ink)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg">
                      <X size={11} /> Reject
                    </button>
                    <DeleteAccountButton profileId={p.profileId} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--amber)]" />
          <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Shared IPs across accounts</h2>
        </div>
        <p className="text-[12px] text-[var(--ink-faint)] -mt-2">One person running several &quot;businesses&quot; - the clearest signal available</p>
        <div className="card">
          {sharedIps.length === 0 ? (
            <p className="text-[12.5px] text-[var(--ink-faint)]">None currently</p>
          ) : (
            <div className="space-y-2">
              {sharedIps.map((s) => (
                <div key={s.ip} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
                  <div>
                    <p className="font-mono text-[13px] font-semibold text-[var(--ink)]">{s.ip}</p>
                    <p className="text-[11.5px] text-[var(--ink-faint)]">{s.accountCount} accounts from this address</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {blockedNow.has(s.ip) ? (
                      <button onClick={() => unblockIp(s.ip)} disabled={ipPending === s.ip}
                        className="flex items-center gap-1.5 text-[11.5px] font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                        <Shield size={12} /> Blocked - unblock
                      </button>
                    ) : (
                      <button onClick={() => blockIp(s.ip, `${s.accountCount} accounts from this IP - reviewed on /admin/claim-audit`)} disabled={ipPending === s.ip}
                        className="flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg">
                        {ipPending === s.ip ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={12} />} Block IP
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-[var(--amber)]" />
          <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Unverified claims on existing listings</h2>
        </div>
        <p className="text-[12px] text-[var(--ink-faint)] -mt-2">
          Historical, from before approval was required - took over an imported listing without proving control of the address it already carried
        </p>
        <div className="card">
          {unverifiedClaims.length === 0 ? (
            <p className="text-[12.5px] text-[var(--ink-faint)]">None currently</p>
          ) : (
            <div className="space-y-2">
              {unverifiedClaims.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--ink)]">{c.business} <span className="text-[var(--ink-faint)] font-normal">{c.suburb}</span></p>
                    <p className="text-[11px] text-[var(--ink-faint)] font-mono">{c.ip ?? "no IP recorded"} · {new Date(c.at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.ip && !blockedNow.has(c.ip) && (
                      <button onClick={() => blockIp(c.ip!, `Unverified claim on ${c.business} - reviewed on /admin/claim-audit`)} disabled={ipPending === c.ip}
                        className="flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg">
                        {ipPending === c.ip ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={12} />} Block IP
                      </button>
                    )}
                    <DeleteAccountButton profileId={c.profileId} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {disputed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Disputed attempts</h2>
          <p className="text-[12px] text-[var(--ink-faint)] -mt-2">Tried to claim an already-claimed listing - usually innocent, occasionally not</p>
          <div className="card">
            <div className="space-y-2">
              {disputed.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-[12.5px] py-1.5 border-b border-[var(--line)] last:border-0">
                  <div>
                    <span className="font-semibold text-[var(--ink)]">{d.business}</span>
                    <span className="text-[var(--ink-faint)] font-mono ml-2">{d.ip ?? "no IP"} · {new Date(d.at).toLocaleString()}</span>
                  </div>
                  <DeleteAccountButton profileId={d.profileId} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Currently blocked IPs</h2>
        <div className="card">
          {blockedNow.size === 0 ? (
            <p className="text-[12.5px] text-[var(--ink-faint)]">None blocked</p>
          ) : (
            <div className="space-y-2">
              {[...blockedNow].map((ip) => {
                const entry = blocklist.find(b => b.ip_address === ip);
                return (
                  <div key={ip} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
                    <div>
                      <p className="font-mono text-[13px] font-semibold text-[var(--ink)]">{ip}</p>
                      <p className="text-[11.5px] text-[var(--ink-faint)]">{entry?.reason ?? "blocked from this page"}</p>
                    </div>
                    <button onClick={() => unblockIp(ip)} disabled={ipPending === ip}
                      className="text-[11.5px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)]">
                      Unblock
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Recent attempts (directory claims)</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase text-[var(--ink-faint)] border-b border-[var(--line)]">
                <th className="pb-2 pr-3">Business</th>
                <th className="pb-2 pr-3">Outcome</th>
                <th className="pb-2 pr-3">Verified</th>
                <th className="pb-2 pr-3">IP</th>
                <th className="pb-2 pr-3"></th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 pr-3">{r.attempted_business_name}</td>
                  <td className="py-1.5 pr-3">{r.outcome}</td>
                  <td className="py-1.5 pr-3">{r.verified_via_email ? "✓" : "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-[11.5px]">{r.ip_address ?? "—"}</td>
                  <td className="py-1.5 pr-3">
                    <BlockIpCell ip={r.ip_address} reason={`Claim attempt by ${r.attempted_business_name} - reviewed on /admin/claim-audit`} />
                  </td>
                  <td className="py-1.5 text-[var(--ink-faint)]">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Recent signups (account creation)</h2>
        <p className="text-[12px] text-[var(--ink-faint)] -mt-2">
          Captured at the account itself, not just the directory claim - catches anyone who signed up without ever touching the claim flow
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase text-[var(--ink-faint)] border-b border-[var(--line)]">
                <th className="pb-2 pr-3">Business</th>
                <th className="pb-2 pr-3">Method</th>
                <th className="pb-2 pr-3">IP</th>
                <th className="pb-2 pr-3"></th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((s) => (
                <tr key={s.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-1.5 pr-3">{s.business ?? "—"}</td>
                  <td className="py-1.5 pr-3">{s.method ?? "—"}</td>
                  <td className="py-1.5 pr-3 font-mono text-[11.5px]">{s.ip ?? "—"}</td>
                  <td className="py-1.5 pr-3">
                    <BlockIpCell ip={s.ip} reason={`Signup${s.business ? ` by ${s.business}` : ""} - reviewed on /admin/claim-audit`} />
                  </td>
                  <td className="py-1.5 text-[var(--ink-faint)]">{new Date(s.at).toLocaleString()}</td>
                </tr>
              ))}
              {recentSignups.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-[12.5px] text-[var(--ink-faint)]">None recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="card">
      <p className="text-[10px] font-bold uppercase text-[var(--ink-faint)]">{label}</p>
      <p className={`font-display text-[1.5rem] ${warn && value > 0 ? "text-red-600" : "text-[var(--ink)]"}`}>{value}</p>
    </div>
  );
}
