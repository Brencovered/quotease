import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext, canSeePricing } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import { resolveScheduledStart } from "@/lib/scheduleNormalize";
import CrewDayClient, { type CrewDayMember, type CrewDayJob } from "@/components/CrewDayClient";

export const dynamic = "force-dynamic";

function melbourneDayOffset(offset: number): string {
  const base = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" })
  );
  base.setDate(base.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default async function CrewDayPage() {
  const days = Array.from({ length: 7 }, (_, i) => melbourneDayOffset(i));
  let members: CrewDayMember[] = [];
  let jobsByDay: Record<string, CrewDayJob[]> = Object.fromEntries(days.map((d) => [d, []]));
  let canManage = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const ctx = await getTeamContext(supabase, userData.user.id);
      canManage = canSeePricing(ctx) || ctx.isOwner;

      const [{ data: memberRows }, { data: jobRows }, { data: crewRows }] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, name, email")
          .eq("owner_profile_id", ctx.businessId)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("jobs")
          .select(
            "id, job_number, client_name, site_address, title, trade, status, scheduled_date, scheduled_start, assigned_to_member_id"
          )
          .eq("profile_id", ctx.businessId)
          .not("status", "in", '("cancelled","archived","complete","invoiced","partially_paid")'),
        supabase.from("job_crew").select("job_id, team_member_id").eq("profile_id", ctx.businessId),
      ]);

      members = (memberRows ?? []).map((m) => ({
        id: m.id,
        name: m.name || m.email || "Team member",
      }));

      const crewByJob = new Map<string, string[]>();
      for (const row of crewRows ?? []) {
        const list = crewByJob.get(row.job_id) ?? [];
        list.push(row.team_member_id);
        crewByJob.set(row.job_id, list);
      }

      const daySet = new Set(days);
      for (const j of jobRows ?? []) {
        const start = resolveScheduledStart(j.scheduled_start, j.scheduled_date);
        const d = dayKey(start) ?? dayKey(j.scheduled_date);
        if (!d || !daySet.has(d)) continue;
        const crew = crewByJob.get(j.id) ?? [];
        if (j.assigned_to_member_id && !crew.includes(j.assigned_to_member_id)) {
          crew.unshift(j.assigned_to_member_id);
        }
        const job: CrewDayJob = {
          id: j.id,
          job_number: j.job_number,
          client_name: j.client_name,
          site_address: j.site_address,
          title: j.title ?? j.trade,
          status: j.status,
          scheduled_start: start,
          member_ids: crew,
        };
        jobsByDay[d] = [...(jobsByDay[d] ?? []), job];
      }
    }
  } catch (err) {
    console.error("Crew day error:", err);
  }

  if (!canManage) {
    return (
      <>
        <AppHeader />
        <main className="page-wrap">
          <h1 className="font-display text-[28px] text-[var(--ink)] mb-2">Crew</h1>
          <p className="text-[14px] text-[var(--ink-faint)] mb-4">
            Crew roster is for owners and managers. Your jobs are on My day.
          </p>
          <Link href="/today" className="btn-primary inline-flex text-[13px] py-2 px-3">
            Open My day
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <CrewDayClient members={members} days={days} jobsByDay={jobsByDay} />
    </>
  );
}
