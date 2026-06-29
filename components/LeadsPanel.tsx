"use client";

import { useState } from "react";
import { MapPin, Clock, ThumbsUp, X, ChevronDown, ChevronUp, Phone, Mail } from "lucide-react";

const TEMP_LABELS: Record<string,{label:string;color:string;bg:string}> = {
  early: { label:"Early stage", color:"text-yellow-700", bg:"bg-yellow-50" },
  warm:  { label:"Warm",        color:"text-orange-700", bg:"bg-orange-50" },
  hot:   { label:"Hot",         color:"text-red-700",    bg:"bg-red-50" },
};

type Claim = { request_id: string; status: string };
type Request = {
  id: string; trade: string; suburb: string; postcode: string | null;
  description: string; budget: string | null; timeline: string | null;
  lead_temperature: string; status: string; num_quotes_wanted: number;
  created_at: string; job_claims: Claim[];
};
type Homeowner = { name: string; email: string; phone: string | null };

export default function LeadsPanel({
  requests,
  myClaimedIds,
}: {
  requests: Request[];
  myClaimedIds: string[];
}) {
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [claiming,  setClaiming]  = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [revealed,  setRevealed]  = useState<Record<string, Homeowner>>({});
  const [localRequests, setLocalRequests] = useState(requests);
  const [localClaimed,  setLocalClaimed]  = useState<Set<string>>(new Set(myClaimedIds));
  const [msg, setMsg] = useState<Record<string,string>>({});

  function activeClaims(r: Request) {
    return r.job_claims?.filter(c => c.status === "claimed").length ?? 0;
  }

  async function claim(requestId: string) {
    setClaiming(requestId);
    const res = await fetch("/api/job-requests/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = await res.json();
    setClaiming(null);
    if (!res.ok) { setMsg(m => ({ ...m, [requestId]: data.error ?? "Failed" })); return; }
    setLocalClaimed(s => new Set([...s, requestId]));
    if (data.homeowner) setRevealed(r => ({ ...r, [requestId]: data.homeowner }));
    setMsg(m => ({ ...m, [requestId]: "Claimed! Contact details below." }));
  }

  async function reject(requestId: string) {
    setRejecting(requestId);
    await fetch("/api/job-requests/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    setRejecting(null);
    setLocalClaimed(s => { const n = new Set(s); n.delete(requestId); return n; });
    setRevealed(r => { const n = {...r}; delete n[requestId]; return n; });
    setMsg(m => ({ ...m, [requestId]: "Claim released." }));
  }

  const open    = localRequests.filter(r => !["expired","fully_claimed"].includes(r.status) && !localClaimed.has(r.id));
  const claimed = localRequests.filter(r => localClaimed.has(r.id));
  const full    = localRequests.filter(r => r.status === "fully_claimed" && !localClaimed.has(r.id));

  if (!localRequests.length) {
    return (
      <div className="card text-center py-12">
        <p className="text-[32px] mb-3">📭</p>
        <p className="font-semibold text-[var(--ink)] mb-1">No leads in your area yet</p>
        <p className="text-[13.5px] text-[var(--ink-faint)] max-w-xs mx-auto">
          When homeowners in your service suburbs request a quote, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  function RequestCard({ r, isClaimed }: { r: Request; isClaimed: boolean }) {
    const isOpen     = expanded === r.id;
    const temp       = TEMP_LABELS[r.lead_temperature] ?? TEMP_LABELS.early;
    const slots      = r.num_quotes_wanted - activeClaims(r);
    const homeowner  = revealed[r.id];
    const cardMsg    = msg[r.id];
    const isFull     = r.status === "fully_claimed" && !isClaimed;
    const age        = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3600000);

    return (
      <div className={`card border-l-4 ${isClaimed ? "border-l-[var(--green)]" : isFull ? "border-l-[var(--line)]" : "border-l-[var(--amber)]"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${temp.bg} ${temp.color}`}>
                {temp.label}
              </span>
              {isClaimed && (
                <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)]">
                  Claimed by you
                </span>
              )}
              {isFull && (
                <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--app-bg)] text-[var(--ink-faint)]">
                  Fully claimed
                </span>
              )}
            </div>
            <p className="font-semibold text-[14px] text-[var(--ink)] capitalize">{r.trade} · {r.suburb}{r.postcode ? ` ${r.postcode}` : ""}</p>
            <p className="text-[12.5px] text-[var(--ink-soft)] mt-0.5 line-clamp-2">{r.description}</p>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {r.budget && <span className="text-[11.5px] text-[var(--ink-faint)]">💰 {r.budget}</span>}
              {r.timeline && <span className="text-[11.5px] text-[var(--ink-faint)]">📅 {r.timeline}</span>}
              <span className="text-[11.5px] text-[var(--ink-faint)] flex items-center gap-0.5">
                <Clock size={10} /> {age < 1 ? "Just now" : `${age}h ago`}
              </span>
              {!isClaimed && !isFull && (
                <span className="text-[11.5px] text-[var(--ink-faint)]">
                  {slots} slot{slots !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(isOpen ? null : r.id)} className="shrink-0 text-[var(--ink-faint)]">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isOpen && (
          <div className="mt-4 pt-4 border-t border-[var(--line-subtle)] space-y-3">
            <p className="text-[13px] text-[var(--ink)]">{r.description}</p>

            {cardMsg && (
              <p className="text-[12.5px] font-semibold text-[var(--green)]">{cardMsg}</p>
            )}

            {/* Homeowner contact -- only shown after claiming */}
            {homeowner && (
              <div className="bg-[var(--green-bg)] rounded-xl p-4 space-y-1.5">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--green)] mb-2">Contact details</p>
                <p className="font-semibold text-[14px] text-[var(--ink)]">{homeowner.name}</p>
                <a href={`mailto:${homeowner.email}`} className="flex items-center gap-1.5 text-[13px] text-[var(--navy)] font-semibold">
                  <Mail size={13} /> {homeowner.email}
                </a>
                {homeowner.phone && (
                  <a href={`tel:${homeowner.phone}`} className="flex items-center gap-1.5 text-[13px] text-[var(--navy)] font-semibold">
                    <Phone size={13} /> {homeowner.phone}
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {!isClaimed && !isFull && (
                <button onClick={() => claim(r.id)} disabled={claiming === r.id}
                  className="btn-primary flex-1 justify-center text-[13px] py-2.5">
                  <ThumbsUp size={13} /> {claiming === r.id ? "Claiming..." : "Claim this lead"}
                </button>
              )}
              {isClaimed && !homeowner && (
                <button onClick={() => setRevealed(rv => ({ ...rv, [r.id]: { name:"Loading...", email:"", phone:null } }))}
                  className="btn-primary flex-1 justify-center text-[13px] py-2.5">
                  View contact details
                </button>
              )}
              {isClaimed && (
                <button onClick={() => reject(r.id)} disabled={rejecting === r.id}
                  className="btn-secondary text-[var(--red)] text-[13px] py-2.5">
                  <X size={13} /> {rejecting === r.id ? "Releasing..." : "Not a fit"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <div>
          <p className="section-tag mb-3">Open leads — {open.length} available</p>
          <div className="space-y-3">
            {open.map(r => <RequestCard key={r.id} r={r} isClaimed={false} />)}
          </div>
        </div>
      )}
      {claimed.length > 0 && (
        <div>
          <p className="section-tag mb-3">Your claimed leads — {claimed.length}</p>
          <div className="space-y-3">
            {claimed.map(r => <RequestCard key={r.id} r={r} isClaimed={true} />)}
          </div>
        </div>
      )}
      {full.length > 0 && (
        <div>
          <p className="section-tag mb-3">Fully claimed — {full.length}</p>
          <div className="space-y-3 opacity-60">
            {full.map(r => <RequestCard key={r.id} r={r} isClaimed={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}
