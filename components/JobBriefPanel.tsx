"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, Check } from "lucide-react";
import { endFromStartAndDays } from "@/lib/scheduleNormalize";

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
}

/** Schedule brief writes to jobs (source of truth). Optionally mirrors
 *  onto the linked quote so older quote-centric reads stay in sync. */
export default function JobBriefPanel({
  jobId,
  quoteId,
  siteNotes: initialNotes,
  scheduledStart: initialStart,
  estimatedDays: initialDays,
  assignedTo: initialAssigned,
  assignedToMemberId: initialAssignedMemberId,
  teamMembers,
  crewMemberIds = [],
}: {
  jobId: string;
  quoteId?: string | null;
  siteNotes: string | null;
  scheduledStart: string | null;
  estimatedDays: number | null;
  assignedTo: string | null;
  assignedToMemberId?: string | null;
  teamMembers?: TeamMemberOption[];
  /** Other crew already on the job - used for clash hints after save. */
  crewMemberIds?: string[];
}) {
  const [siteNotes, setSiteNotes] = useState(initialNotes ?? "");
  const [scheduledStart, setScheduledStart] = useState(initialStart ? initialStart.slice(0, 10) : "");
  const [estimatedDays, setEstimatedDays] = useState(initialDays ? String(initialDays) : "");
  const [assignedToMemberId, setAssignedToMemberId] = useState(initialAssignedMemberId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clashWarning, setClashWarning] = useState<string | null>(null);

  const hasTeam = (teamMembers?.length ?? 0) > 0;

  async function save() {
    setSaving(true);
    setSaved(false);
    setClashWarning(null);
    const supabase = createClient();
    const days = estimatedDays ? Number(estimatedDays) : null;
    const start = scheduledStart ? new Date(scheduledStart).toISOString() : null;
    const end = start ? endFromStartAndDays(start, days) : null;
    const assignedMember = teamMembers?.find((m) => m.id === assignedToMemberId);

    await supabase
      .from("jobs")
      .update({
        site_notes: siteNotes || null,
        scheduled_date: scheduledStart || null,
        scheduled_start: start,
        scheduled_end: end,
        estimated_days: days,
      })
      .eq("id", jobId);

    if (quoteId) {
      await supabase
        .from("quotes")
        .update({
          site_notes: siteNotes || null,
          scheduled_date: scheduledStart || null,
          scheduled_start: start,
          scheduled_end: end,
          estimated_days: days,
        })
        .eq("id", quoteId);
    }

    // Primary assignee: notify via API (push → My day + email).
    if (assignedToMemberId !== (initialAssignedMemberId ?? "")) {
      await fetch(`/api/jobs/${jobId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: assignedToMemberId || null }),
      });
    } else if (!assignedToMemberId && initialAssignedMemberId) {
      await fetch(`/api/jobs/${jobId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId: null }),
      });
    }

    // Simple clash check: same assignee already on another job that day.
    if (start && assignedToMemberId) {
      const day = scheduledStart;
      const { data: clashes } = await supabase
        .from("jobs")
        .select("id, client_name, job_number, scheduled_start, scheduled_date")
        .eq("assigned_to_member_id", assignedToMemberId)
        .neq("id", jobId)
        .not("status", "in", '("cancelled","archived","complete")');
      const hits = (clashes ?? []).filter((j) => {
        const d = (j.scheduled_start ?? j.scheduled_date ?? "").slice(0, 10);
        return d === day;
      });
      if (hits.length) {
        const labels = hits
          .slice(0, 2)
          .map((j) => `Job #${j.job_number}${j.client_name ? ` (${j.client_name})` : ""}`)
          .join(", ");
        setClashWarning(`${assignedMember?.name || "Assignee"} is also on ${labels} that day.`);
      }
    }

    void crewMemberIds; // reserved for expanded crew clash checks
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="card">
      <p className="section-tag mb-1">Who &amp; when</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Schedule and site notes</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-4">Start date, who&apos;s lead, gate codes, parking, dogs - anything before you turn up.</p>

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
          <Link href="/team" className="underline font-semibold">Add a team member</Link> to assign this job to someone.
        </p>
      )}
      <p className="text-[11px] text-[var(--ink-faint)] mb-3">This appears on your Schedule calendar automatically.</p>
      {clashWarning && (
        <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {clashWarning}
        </p>
      )}

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
