"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, Check } from "lucide-react";

export default function JobBriefPanel({
  quoteId,
  siteNotes: initialNotes,
  scheduledDate: initialDate,
  assignedTo: initialAssigned,
}: {
  quoteId: string;
  siteNotes: string | null;
  scheduledDate: string | null;
  assignedTo: string | null;
}) {
  const [siteNotes, setSiteNotes] = useState(initialNotes ?? "");
  const [scheduledDate, setScheduledDate] = useState(initialDate ?? "");
  const [assignedTo, setAssignedTo] = useState(initialAssigned ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("quotes")
      .update({
        site_notes: siteNotes || null,
        scheduled_date: scheduledDate || null,
        assigned_to: assignedTo || null,
      })
      .eq("id", quoteId);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Job brief</p>
      <p className="font-semibold text-[var(--ink)] mb-1">What to know before you turn up</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-4">Gate codes, dogs, parking, access notes, anything site-specific.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">
            <CalendarDays size={13} /> Scheduled date
          </span>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="app-field" />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Assigned to</span>
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="e.g. you, or an offsider's name"
            className="app-field"
          />
        </label>
      </div>

      <label className="block mb-3">
        <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Site access notes</span>
        <textarea
          value={siteNotes}
          onChange={(e) => setSiteNotes(e.target.value)}
          rows={3}
          placeholder="e.g. side gate code 4521, dog in backyard - friendly, park on the street not the driveway"
          className="app-field text-[13px]"
        />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-secondary text-[13px] py-2 px-4">
          {saving ? "Saving..." : "Save brief"}
        </button>
        {saved && (
          <span className="text-[13px] text-[var(--green)] font-semibold flex items-center gap-1">
            <Check size={13} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
