"use client";

import { useState } from "react";
import { AlertTriangle, Ban, RefreshCw, Shield, Users } from "lucide-react";

interface Summary {
  totalAttempts: number;
  claimedExistingListing: number;
  claimedButUnverified: number;
  createdNew: number;
  disputed: number;
  missingIp: number;
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

interface BlockedIp {
  ip_address: string;
  reason: string;
  blocked_by: string | null;
  created_at: string;
}

export default function ClaimAuditPanel({
  summary, sharedIps, unverifiedClaims, disputed, recent, blocklist,
}: {
  summary: Summary;
  sharedIps: SharedIp[];
  unverifiedClaims: UnverifiedClaim[];
  disputed: { business: string; listingId: string; profileId: string; ip: string | null; at: string }[];
  recent: AttemptRow[];
  blocklist: BlockedIp[];
}) {
  const [blockedNow, setBlockedNow] = useState<Set<string>>(new Set(blocklist.map(b => b.ip_address)));
  const [pending, setPending] = useState<string | null>(null);

  async function blockIp(ip: string, reason: string) {
    setPending(ip);
    const res = await fetch("/api/admin/ip-blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, reason }),
    });
    if (res.ok) setBlockedNow((prev) => new Set(prev).add(ip));
    setPending(null);
  }

  async function unblockIp(ip: string) {
    setPending(ip);
    const res = await fetch(`/api/admin/ip-blocklist?ip=${encodeURIComponent(ip)}`, { method: "DELETE" });
    if (res.ok) setBlockedNow((prev) => { const next = new Set(prev); next.delete(ip); return next; });
    setPending(null);
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Stat label="Total attempts" value={summary.totalAttempts} />
        <Stat label="Claimed existing" value={summary.claimedExistingListing} />
        <Stat label="Unverified claims" value={summary.claimedButUnverified} warn={summary.claimedButUnverified > 0} />
        <Stat label="New listings" value={summary.createdNew} />
        <Stat label="Disputed" value={summary.disputed} warn={summary.disputed > 0} />
        <Stat label="No IP recorded" value={summary.missingIp} />
      </div>

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
                  {blockedNow.has(s.ip) ? (
                    <button onClick={() => unblockIp(s.ip)} disabled={pending === s.ip}
                      className="flex items-center gap-1.5 text-[11.5px] font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                      <Shield size={12} /> Blocked - unblock
                    </button>
                  ) : (
                    <button onClick={() => blockIp(s.ip, `${s.accountCount} accounts from this IP - reviewed on /admin/claim-audit`)} disabled={pending === s.ip}
                      className="flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg">
                      {pending === s.ip ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={12} />} Block IP
                    </button>
                  )}
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
          Took over an imported listing without proving control of the address it already carried - the real business never signed up and has no idea
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
                  {c.ip && !blockedNow.has(c.ip) && (
                    <button onClick={() => blockIp(c.ip!, `Unverified claim on ${c.business} - reviewed on /admin/claim-audit`)} disabled={pending === c.ip}
                      className="flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg shrink-0">
                      {pending === c.ip ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={12} />} Block IP
                    </button>
                  )}
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
                <div key={i} className="text-[12.5px] py-1.5 border-b border-[var(--line)] last:border-0">
                  <span className="font-semibold text-[var(--ink)]">{d.business}</span>
                  <span className="text-[var(--ink-faint)] font-mono ml-2">{d.ip ?? "no IP"} · {new Date(d.at).toLocaleString()}</span>
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
                    <button onClick={() => unblockIp(ip)} disabled={pending === ip}
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
        <h2 className="font-display text-[1.15rem] text-[var(--ink)]">Recent attempts</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase text-[var(--ink-faint)] border-b border-[var(--line)]">
                <th className="pb-2 pr-3">Business</th>
                <th className="pb-2 pr-3">Outcome</th>
                <th className="pb-2 pr-3">Verified</th>
                <th className="pb-2 pr-3">IP</th>
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
                  <td className="py-1.5 text-[var(--ink-faint)]">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
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
