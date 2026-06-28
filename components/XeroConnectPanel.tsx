"use client";

import { useState } from "react";
import { Check, AlertCircle, RefreshCw, Unlink } from "lucide-react";

export default function XeroConnectPanel({
  connected,
  connectedAt,
  tenantId,
}: {
  connected: boolean;
  connectedAt: string | null;
  tenantId: string | null;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [msg,           setMsg]           = useState<{type:"ok"|"err";text:string}|null>(null);

  async function disconnect() {
    setDisconnecting(true);
    const res = await fetch("/api/xero/disconnect", { method: "POST" });
    if (res.ok) window.location.reload();
    else { setMsg({type:"err", text:"Disconnect failed"}); setDisconnecting(false); }
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Xero integration</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Live sync with Xero</p>
      <p className="text-[13px] text-[var(--ink-faint)] mb-4">
        Connect Xero to push accepted quotes directly as invoices - no CSV, no double-entry.
        Contacts, invoices and payments sync automatically.
      </p>

      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 bg-[var(--green-bg)] border border-green-200 rounded-xl px-4 py-3">
            <Check size={16} className="text-[var(--green)] shrink-0" />
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--green)]">Connected to Xero</p>
              {connectedAt && (
                <p className="text-[11.5px] text-[var(--green)]/70">
                  Connected {new Date(connectedAt).toLocaleDateString("en-AU")}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={disconnect} disabled={disconnecting}
              className="btn-secondary flex-1 justify-center text-[var(--red)] border-red-200 hover:bg-red-50">
              <Unlink size={14} /> {disconnecting ? "Disconnecting..." : "Disconnect Xero"}
            </button>
          </div>

          <p className="text-[12px] text-[var(--ink-faint)]">
            Accepted quotes are automatically pushed to Xero when you click &ldquo;Sync to Xero&rdquo;
            on the Export page or from any job page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <a href="/api/xero/connect"
            className="btn-primary w-full justify-center no-underline">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M12.081.02C5.453-.188.023 5.242.02 11.865c-.003 6.627 5.37 12.014 11.997 12.017C18.641 23.885 24.027 18.51 24 11.882 23.975 5.27 18.682-.19 12.081.02zm0 0"/>
            </svg>
            Connect Xero
          </a>
          <p className="text-[12px] text-[var(--ink-faint)]">
            You&apos;ll be taken to Xero to authorise access. We only request permission to
            create invoices and read contacts — nothing else.
          </p>
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 mt-3 px-4 py-3 rounded-xl text-[13px] font-semibold ${msg.type === "ok" ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--red-bg)] text-[var(--red)]"}`}>
          {msg.type === "ok" ? <Check size={13} /> : <AlertCircle size={13} />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
