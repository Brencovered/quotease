"use client";

import { useState } from "react";
import { Mail, Loader2, Check, AlertCircle, ChevronDown } from "lucide-react";

export default function ScheduleWeeklyEmail() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  async function sendEmails() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/schedule/send-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOffset }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          sent: data.sent ?? 0,
          skipped: data.skipped ?? 0,
          errors: data.errors ?? [],
        });
      } else {
        setResult({ sent: 0, skipped: 0, errors: [data.error || "Failed to send"] });
      }
    } catch {
      setResult({ sent: 0, skipped: 0, errors: ["Network error"] });
    }
    setSending(false);
  }

  const weekLabel =
    weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `Week offset ${weekOffset}`;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-tag">Team emails</p>
          <p className="font-semibold text-[var(--ink)]">Send weekly schedule</p>
          <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
            Email each team member their assigned jobs for {weekLabel.toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] bg-[var(--app-bg)] px-3 py-1.5 rounded-lg"
          >
            {weekLabel} <ChevronDown size={13} />
          </button>
          {showPicker && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-[var(--line)] rounded-lg shadow-lg py-1 z-10 w-36">
              <button
                onClick={() => { setWeekOffset(0); setShowPicker(false); }}
                className={`block w-full text-left px-3 py-1.5 text-[12px] font-semibold ${weekOffset === 0 ? "text-[var(--navy)]" : "text-[var(--ink-soft)]"}`}
              >
                This week
              </button>
              <button
                onClick={() => { setWeekOffset(1); setShowPicker(false); }}
                className={`block w-full text-left px-3 py-1.5 text-[12px] font-semibold ${weekOffset === 1 ? "text-[var(--navy)]" : "text-[var(--ink-soft)]"}`}
              >
                Next week
              </button>
            </div>
          )}
        </div>

        <button
          onClick={sendEmails}
          disabled={sending}
          className="btn-primary text-[12.5px] py-1.5 px-3 inline-flex items-center gap-1.5"
          style={{ width: "auto" }}
        >
          {sending ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Mail size={13} /> Send now
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-1.5">
          {result.sent > 0 && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--green)]">
              <Check size={13} /> Sent to {result.sent} team member{result.sent > 1 ? "s" : ""}
            </div>
          )}
          {result.skipped > 0 && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--ink-faint)]">
              <AlertCircle size={13} /> Skipped {result.skipped} member{result.skipped > 1 ? "s" : ""} with no jobs
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="text-[11.5px] text-[var(--red)] space-y-0.5">
              {result.errors.map((err, i) => (
                <p key={i} className="flex items-center gap-1">
                  <AlertCircle size={10} /> {err}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
