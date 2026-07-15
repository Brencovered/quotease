"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Users, X } from "lucide-react";

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface CrewEntry {
  id: string;
  team_member_id: string;
}

// Sits alongside JobBriefPanel's "Assigned to" field, not in place of it.
// "Assigned to" (assigned_to_member_id on quotes) stays the single
// scheduling contact the Schedule calendar reads - untouched here. This
// panel is for "who's actually on site", which can be more than one
// person and simply didn't have anywhere to live before job_crew existed.
export default function JobCrewPanel({
  jobId,
  profileId,
  initialCrew,
  teamMembers,
}: {
  jobId: string;
  profileId: string;
  initialCrew: CrewEntry[];
  teamMembers: TeamMemberOption[];
}) {
  const [crew, setCrew] = useState(initialCrew);
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onJob = new Set(crew.map((c) => c.team_member_id));
  const available = teamMembers.filter((m) => !onJob.has(m.id));

  async function addMember() {
    if (!adding) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertErr } = await supabase
      .from("job_crew")
      .insert({ job_id: jobId, team_member_id: adding, profile_id: profileId })
      .select("id, team_member_id")
      .single();
    if (insertErr) {
      setError("Couldn't add them - try again");
    } else if (data) {
      setCrew((prev) => [...prev, data]);
      setAdding("");
    }
    setSaving(false);
  }

  async function removeMember(crewId: string) {
    setCrew((prev) => prev.filter((c) => c.id !== crewId)); // optimistic
    const supabase = createClient();
    const { error: deleteErr } = await supabase.from("job_crew").delete().eq("id", crewId);
    if (deleteErr) {
      setError("Couldn't remove them - refresh and try again");
      setCrew(initialCrew); // roll back to last known-good state on failure
    }
  }

  if (teamMembers.length === 0) {
    return (
      <div className="card">
        <p className="section-tag mb-1">Crew</p>
        <p className="font-semibold text-[var(--ink)] mb-1">Who&apos;s on site</p>
        <p className="text-[11px] text-[var(--ink-faint)]">
          <Link href="/settings/team" className="underline font-semibold">Add a team member</Link> to build a crew for this job.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="section-tag mb-1 flex items-center gap-1.5"><Users size={13} /> Crew</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Who&apos;s on site</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Everyone here can log their own hours and materials against this job.
      </p>

      {error && <p className="text-[13px] text-red-600 mb-2">{error}</p>}

      {crew.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {crew.map((c) => {
            const member = teamMembers.find((m) => m.id === c.team_member_id);
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-bg)] border border-[var(--line)] pl-3 pr-1.5 py-1 text-[12.5px] font-medium text-[var(--ink)]"
              >
                {member?.name || member?.email || "Unknown"}
                <button
                  onClick={() => removeMember(c.id)}
                  className="rounded-full p-0.5 hover:bg-[var(--line)] transition-colors"
                  aria-label={`Remove ${member?.name || member?.email} from this job`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {available.length > 0 ? (
        <div className="flex gap-2">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} className="app-field flex-1">
            <option value="">Add someone to this job...</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
          <button
            onClick={addMember}
            disabled={!adding || saving}
            className="px-4 rounded-xl bg-[var(--navy)] text-white text-[13px] font-semibold disabled:opacity-40"
          >
            Add
          </button>
        </div>
      ) : (
        <p className="text-[11.5px] text-[var(--ink-faint)]">Everyone on your team is already on this job.</p>
      )}
    </div>
  );
}
