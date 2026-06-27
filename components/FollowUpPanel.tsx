"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Phone, Mail, MessageSquare, Users, Check } from "lucide-react";

type FollowUp = { id: string; method: string; notes: string | null; followed_up_at: string; };

const METHOD_ICON = { email: Mail, phone: Phone, sms: MessageSquare, in_person: Users };
const METHOD_LABEL = { email: "Email", phone: "Phone call", sms: "SMS", in_person: "In person" };

export default function FollowUpPanel({ quoteId, followUps: initial, followUpAt, expiresAt }: {
  quoteId: string;
  followUps: FollowUp[];
  followUpAt: string | null;
  expiresAt: string | null;
}) {
  const [followUps, setFollowUps] = useState(initial);
  const [showLog, setShowLog] = useState(false);
  const [method, setMethod] = useState<"email" | "phone" | "sms" | "in_person">("phone");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(followUpAt?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(expiresAt?.slice(0, 10) ?? "");
  const [dateSaving, setDateSaving] = useState(false);

  const daysUntilFollowUp = followUpAt ? Math.ceil((new Date(followUpAt).getTime() - Date.now()) / 86400000) : null;
  const daysUntilExpiry = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null;
  const overdue = daysUntilFollowUp !== null && daysUntilFollowUp < 0;
  const expired = daysUntilExpiry !== null && daysUntilExpiry < 0;

  async function logFollowUp() {
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSaving(false); return; }
    const { data, error } = await supabase
      .from("follow_up_log")
      .insert({ quote_id: quoteId, profile_id: userData.user.id, method, notes: notes || null })
      .select().single();
    if (!error && data) {
      setFollowUps((prev) => [data, ...prev]);
      // Update follow_up_sent_at on the quote
      await supabase.from("quotes").update({ follow_up_sent_at: new Date().toISOString() }).eq("id", quoteId);
    }
    setShowLog(false);
    setNotes("");
    setSaving(false);
  }

  async function saveDates() {
    setDateSaving(true);
    const supabase = createClient();
    await supabase.from("quotes").update({
      follow_up_at: scheduledDate || null,
      quote_expires_at: expiryDate || null,
    }).eq("id", quoteId);
    setDateSaving(false);
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Follow-up</p>
      <p className="font-semibold text-[var(--ink)] mb-3">Quote follow-up and expiry</p>

      {/* Status alerts */}
      {overdue && (
        <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-[13px] font-semibold mb-3 flex items-center gap-2">
          <Bell size={14} /> Follow-up overdue by {Math.abs(daysUntilFollowUp!)} day{Math.abs(daysUntilFollowUp!) !== 1 ? "s" : ""}
        </div>
      )}
      {expired && (
        <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-[13px] font-semibold mb-3 flex items-center gap-2">
          <Bell size={14} /> Quote expired {Math.abs(daysUntilExpiry!)} day{Math.abs(daysUntilExpiry!) !== 1 ? "s" : ""} ago - resend with updated pricing
        </div>
      )}
      {!overdue && daysUntilFollowUp !== null && daysUntilFollowUp <= 3 && daysUntilFollowUp >= 0 && (
        <div className="bg-amber-50 text-amber-800 rounded-lg px-3 py-2 text-[13px] font-semibold mb-3 flex items-center gap-2">
          <Bell size={14} /> Follow-up due {daysUntilFollowUp === 0 ? "today" : `in ${daysUntilFollowUp} day${daysUntilFollowUp !== 1 ? "s" : ""}`}
        </div>
      )}

      {/* Date settings */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Follow-up reminder</span>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="app-field" />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Quote expires</span>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="app-field" />
        </label>
      </div>
      <button onClick={saveDates} disabled={dateSaving} className="text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5 mb-4 flex items-center gap-1 disabled:opacity-50">
        <Check size={13} /> {dateSaving ? "Saving..." : "Save dates"}
      </button>

      {/* Log a follow-up */}
      {showLog ? (
        <div className="bg-[var(--app-bg)] rounded-xl p-3 space-y-2">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Log a follow-up</p>
          <div className="flex gap-2 flex-wrap">
            {(["phone","email","sms","in_person"] as const).map((m) => {
              const Icon = METHOD_ICON[m];
              return (
                <button key={m} onClick={() => setMethod(m)} className={`inline-flex items-center gap-1 text-[12.5px] font-semibold rounded-lg px-2.5 py-1.5 border-2 ${method === m ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>
                  <Icon size={12} />{METHOD_LABEL[m]}
                </button>
              );
            })}
          </div>
          <label className="block"><span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1">Notes (optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="app-field" placeholder="e.g. left voicemail, will try again Thursday" />
          </label>
          <div className="flex gap-2">
            <button onClick={logFollowUp} disabled={saving} className="bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">{saving ? "Saving..." : "Log it"}</button>
            <button onClick={() => setShowLog(false)} className="border-2 border-[var(--line)] rounded-lg px-3 py-1.5 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowLog(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5">
          <Bell size={13} /> Log a follow-up
        </button>
      )}

      {/* Follow-up history */}
      {followUps.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[12px] font-semibold text-[var(--ink-faint)] uppercase tracking-wide">History</p>
          {followUps.map((f) => {
            const Icon = METHOD_ICON[f.method as keyof typeof METHOD_ICON] ?? Bell;
            return (
              <div key={f.id} className="flex gap-2.5 items-start text-[12.5px]">
                <Icon size={13} className="text-[var(--ink-faint)] mt-0.5 shrink-0" />
                <div>
                  <span className="text-[var(--ink-soft)] font-semibold">{METHOD_LABEL[f.method as keyof typeof METHOD_LABEL] ?? f.method}</span>
                  <span className="text-[var(--ink-faint)] mx-1.5">·</span>
                  <span className="text-[var(--ink-faint)]">{new Date(f.followed_up_at).toLocaleDateString("en-AU")}</span>
                  {f.notes && <p className="text-[var(--ink-faint)] mt-0.5">{f.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
