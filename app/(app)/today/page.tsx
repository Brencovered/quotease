import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import MyDayClient, { type MyDayJob } from "@/components/MyDayClient";
import { resolveScheduledStart } from "@/lib/scheduleNormalize";

export const dynamic = "force-dynamic";

function melbourneToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // Date-only strings are already YYYY-MM-DD
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

export default async function TodayPage() {
  const today = melbourneToday();
  let jobs: MyDayJob[] = [];
  let viewerLabel = "Your day";
  let scopedToSelf = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const ctx = await getTeamContext(supabase, userData.user.id);

      const [{ data: jobRows }, { data: membership }, { data: crewRows }] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            "id, job_number, client_name, client_phone, site_address, title, trade, status, scheduled_date, scheduled_start, assigned_to_member_id, total_cost"
          )
          .eq("profile_id", ctx.businessId)
          .not("status", "in", '("cancelled","archived","complete","invoiced","partially_paid")')
          .order("scheduled_start", { ascending: true, nullsFirst: false }),
        supabase
          .from("team_members")
          .select("id, name")
          .eq("member_user_id", userData.user.id)
          .eq("status", "active")
          .maybeSingle(),
        supabase.from("job_crew").select("job_id, team_member_id").eq("profile_id", ctx.businessId),
      ]);

      const myMemberId = membership?.id ?? null;
      const crewByJob = new Map<string, string[]>();
      for (const row of crewRows ?? []) {
        const list = crewByJob.get(row.job_id) ?? [];
        list.push(row.team_member_id);
        crewByJob.set(row.job_id, list);
      }

      // Site members (and assigned-only managers) only see jobs they're on.
      // Owners/admins/full managers see the whole business day — right for solo + tiny teams.
      const restrictToAssigned =
        Boolean(myMemberId) &&
        (ctx.role === "site_member" || (ctx.role === "manager" && ctx.accessScope === "assigned_only"));

      scopedToSelf = restrictToAssigned;
      viewerLabel = restrictToAssigned
        ? membership?.name
          ? `${membership.name.split(" ")[0]}'s day`
          : "My day"
        : "Today";

      jobs = (jobRows ?? [])
        .map((j) => {
          const start = resolveScheduledStart(j.scheduled_start, j.scheduled_date);
          const crew = crewByJob.get(j.id) ?? [];
          if (j.assigned_to_member_id && !crew.includes(j.assigned_to_member_id)) {
            crew.unshift(j.assigned_to_member_id);
          }
          const onDay = dayKey(start) === today || dayKey(j.scheduled_date) === today;
          const inFlight = j.status === "in_progress" || j.status === "on_hold" || j.status === "awaiting_sign_off";
          const assignedToMe = myMemberId
            ? j.assigned_to_member_id === myMemberId || crew.includes(myMemberId)
            : true;
          return {
            id: j.id,
            job_number: j.job_number as number,
            client_name: j.client_name as string | null,
            client_phone: j.client_phone as string | null,
            site_address: j.site_address as string | null,
            title: (j.title ?? j.trade) as string | null,
            status: j.status as string,
            scheduled_start: start,
            total_cost: j.total_cost as number | null,
            assigned_to_me: assignedToMe,
            on_day: onDay,
            in_flight: inFlight,
          };
        })
        .filter((j) => {
          if (restrictToAssigned && !j.assigned_to_me) return false;
          return j.on_day || j.in_flight;
        })
        .sort((a, b) => {
          if (a.status === "in_progress" && b.status !== "in_progress") return -1;
          if (b.status === "in_progress" && a.status !== "in_progress") return 1;
          return (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? "");
        })
        .map(({ on_day: _o, in_flight: _i, assigned_to_me: _a, ...job }) => job);
    }
  } catch (err) {
    console.error("My day page error:", err);
  }

  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <AppHeader />
      <MyDayClient
        jobs={jobs}
        title={viewerLabel}
        dateLabel={dateLabel}
        scopedToSelf={scopedToSelf}
      />
    </>
  );
}
