"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, Check } from "lucide-react";

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
}

// Writes to scheduled_start/estimated_days - the same columns the Schedule
// calendar reads from. An earlier version of this panel wrote to a
// separate scheduled_date column that the calendar never looked at, so
// setting a date here silently never appeared anywhere else.
export default function JobBriefPanel({
  quoteId,
  siteNotes: initialNotes,
  scheduledStart: initialStart,
  estimatedDays: initialDays,
  assignedTo: initialAssigned,
  assignedToMemberId: initialAssignedMemberId,
  teamMembers,
}: {
  quoteId: string;
  siteNotes: string | null;
  scheduledStart: string | null;
  estimatedDays: number | null;
  assignedTo: string | null;
  assignedToMemberId?: string | null;
  teamMembers?: TeamMemberOption[];
}) {
  const [siteNotes, setSiteNotes] = useState(initialNotes ?? "");
  const [scheduledStart, setScheduledStart] = useState(initialStart ? initialStart.slice(0, 10) : "");
  const [estimatedDays, setEstimatedDays] = useState(initialDays ? String(initialDays) : "");
  const [assignedToMemberId, setAssignedToMemberId] = useState(initialAssignedMemberId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasTeam = (teamMembers?.length ?? 0) > 0;

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const days = estimatedDays ? Number(estimatedDays) : null;
    const start = scheduledStart ? new Date(scheduledStart).toISOString() : null;
    const end = start && days && days > 1 ? new Date(new Date(start).getTime() + (days - 1) * 86400000).toISOString() : start;
    const assignedMember = teamMembers?.find((m) => m.id === assignedToMemberId);
    await supabase
      .from("quotes")
      .update({
        site_notes: siteNotes || null,
        scheduled_start: start,
        scheduled_end: end,
        estimated_days: days,
        assigned_to_member_id: assignedToMemberId || null,
        assigned_to: assignedMember ? (assignedMember.name || assignedMember.email) : null,
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

      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <label className="block">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">
            <CalendarDays size={13} /> Start date
          </span>
          <input type="date" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="app-field" />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Days on site</span>
          <input
            type="number"
            min={1}
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(e.target.value)}
            placeholder="1"
            className="app-field"
          />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-[var(--ink-soft)] mb-1.5">Assigned to</span>
          {hasTeam ? (
            <select value={assignedToMemberId} onChange={(e) => setAssignedToMemberId(e.target.value)} className="app-field">
              <option value="">Unassigned</option>
              {teamMembers!.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          ) : (
            <input value={initialAssigned ?? ""} disabled placeholder="Add team members to assign jobs" className="app-field text-[var(--ink-faint)]" />
          )}
        </label>
      </div>
      {!hasTeam && (
        <p className="text-[11px] text-[var(--ink-faint)] mb-3">
          <a href="/settings/team" className="underline font-semibold">Add a team member</a> to assign this job to someone.
        </p>
      )}
      <p className="text-[11px] text-[var(--ink-faint)] mb-3">This appears on your Schedule calendar automatically.</p>

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
