"use client";

import { useState } from "react";
import ClientPicker from "./ClientPicker";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default function StepCustomer({ clientName, setClientName, clientEmail, setClientEmail, siteAddress, setSiteAddress, onCeilingHint }: {
  clientName: string; setClientName: (v: string) => void;
  clientEmail: string; setClientEmail: (v: string) => void;
  siteAddress: string; setSiteAddress: (v: string) => void;
  onCeilingHint?: (hint: string) => void;
}) {
  const [propChecking, setPropChecking] = useState(false);
  const [propResult,   setPropResult]   = useState<{
    found: boolean; reason?: string; heritageOverlay?: boolean; bushfireOverlay?: boolean;
    zoneLabel?: string | null; ceilingHint?: string | null;
    flags?: Array<{ type: string; severity: string; label: string; detail: string | null; verifyUrl?: string; verifyLabel?: string }>;
  } | null>(null);

  // Running this here, before the manual entry steps, means a heritage/
  // bushfire overlay hit can actually inform the ceiling type and labour
  // estimate later in the flow - running it at the end (where it used to
  // live) meant the hint arrived after those fields were already filled in.
  const isVic = siteAddress.trim().length > 8 && (
    /\bVIC\b/i.test(siteAddress) || /\b3\d{3}\b/.test(siteAddress)
  );

  async function checkProperty() {
    setPropChecking(true); setPropResult(null);
    try {
      const res  = await fetch(`/api/property-check?address=${encodeURIComponent(siteAddress)}`);
      const data = await res.json();
      setPropResult(data);
      if (data.found && data.ceilingHint && onCeilingHint) onCeilingHint(data.ceilingHint);
    } catch {
      setPropResult({ found: false, reason: "Could not reach the property lookup service." });
    } finally { setPropChecking(false); }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="section-tag mb-1">Customer & site</p>
        <p className="font-semibold text-[var(--ink)] mb-3">Who&apos;s this for, and where?</p>
        <div className="space-y-3">
          <Field label="Client name">
            <ClientPicker
              value={clientName}
              onChange={setClientName}
              onSelectClient={(c) => {
                setClientName(c.name);
                if (c.email) setClientEmail(c.email);
                if (c.billing_address && !siteAddress) setSiteAddress(c.billing_address);
              }}
            />
          </Field>
          <Field label="Client email">
            <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="app-field" placeholder="jane@email.com" />
          </Field>
          <div>
            <Field label="Site address">
              <input value={siteAddress} onChange={(e) => { setSiteAddress(e.target.value); setPropResult(null); }}
                className="app-field" placeholder="123 Main St, Suburb VIC 3000" />
            </Field>
            {isVic && (
              <button onClick={checkProperty} disabled={propChecking}
                className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--navy)] border-2 border-[var(--navy)]/20 bg-[var(--navy)]/5 rounded-lg px-3 py-1.5 hover:bg-[var(--navy)]/10 transition-colors disabled:opacity-50">
                🏛️ {propChecking ? "Checking planning overlays..." : "Check property overlays (VIC)"}
              </button>
            )}
            {propResult && (
              <div className="mt-2 space-y-2">
                {!propResult.found ? (
                  <p className="text-[12.5px] text-[var(--ink-faint)] bg-[var(--app-bg)] rounded-lg px-3 py-2">{propResult.reason}</p>
                ) : propResult.flags?.length === 0 ? (
                  <div className="bg-[var(--green-bg)] border border-green-200 rounded-xl px-3 py-2.5 text-[13px] text-[var(--green)] font-semibold flex items-center gap-2">
                    ✓ No Heritage or Bushfire overlays{propResult.zoneLabel ? ` · ${propResult.zoneLabel}` : ""}
                  </div>
                ) : (
                  propResult.flags?.map((flag) => (
                    <div key={flag.type} className={`rounded-xl px-3 py-3 flex items-start gap-2.5 ${flag.severity === "warning" ? "bg-amber-50 border border-amber-200" : "bg-[var(--blue-bg)] border border-blue-100"}`}>
                      <span className="text-lg shrink-0">{flag.type === "heritage" ? "🏛️" : flag.type === "bushfire" ? "🔥" : "📍"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-[13px] ${flag.severity === "warning" ? "text-amber-800" : "text-[var(--blue)]"}`}>{flag.label}</p>
                        {flag.detail && <p className={`text-[12px] mt-0.5 leading-snug ${flag.severity === "warning" ? "text-amber-700" : "text-[var(--blue)]"}`}>{flag.detail}</p>}
                        {flag.type === "heritage" && <p className="text-[11.5px] font-bold text-amber-700 mt-1">⚠️ Ceiling type set to Heritage Timber - labour estimate updated</p>}
                        {flag.verifyUrl && (
                          <a href={flag.verifyUrl} target="_blank" rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 text-[12px] font-bold mt-2 underline underline-offset-2 ${flag.severity === "warning" ? "text-amber-700 hover:text-amber-900" : "text-[var(--blue)] hover:text-blue-800"}`}>
                            {flag.verifyLabel ?? "Verify on VicPlan →"}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
