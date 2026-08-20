import { createClient } from "@/lib/supabase/server";
import { getTeamContext, canSeePricing, isFieldWorker } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import MyDayClient, { type MyDayJob, type MyDayTask } from "@/components/MyDayClient";
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
  let todayJobs: MyDayJob[] = [];
  let undatedJobs: MyDayJob[] = [];
  let openJobs: MyDayJob[] = [];
  let tasks: MyDayTask[] = [];
  let viewerLabel = "Your day";
  let scopedToSelf = false;
  let showCrewLink = false;
  let canClaimOpenJobs = false;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const ctx = await getTeamContext(supabase, userData.user.id);
      showCrewLink = canSeePricing(ctx) || ctx.isOwner;
      // Field workers + assigned-only managers can claim unassigned work.
      canClaimOpenJobs =
        isFieldWorker(ctx) ||
        (ctx.role === "manager" && ctx.accessScope === "assigned_only");

      const [{ data: jobRows }, { data: membership }, { data: crewRows }, { data: taskRows }] =
        await Promise.all([
          supabase
            .from("jobs")
            .select(
              "id, job_number, client_name, client_phone, client_email, site_address, title, trade, status, scheduled_date, scheduled_start, assigned_to_member_id, total_cost, amount_paid, work_started_at"
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
          supabase
            .from("job_tasks")
            .select(
              "id, title, status, due_date, assigned_to_member_id, job_id, jobs:job_id(job_number, client_name, title)"
            )
            .eq("profile_id", ctx.businessId)
            .neq("status", "done")
            .or(`due_date.eq.${today},due_date.is.null`)
            .order("created_at", { ascending: true }),
        ]);

      const myMemberId = membership?.id ?? null;
      const crewByJob = new Map<string, string[]>();
      for (const row of crewRows ?? []) {
        const list = crewByJob.get(row.job_id) ?? [];
        list.push(row.team_member_id);
        crewByJob.set(row.job_id, list);
      }

      const restrictToAssigned =
        Boolean(myMemberId) &&
        (ctx.role === "site_member" || (ctx.role === "manager" && ctx.accessScope === "assigned_only"));

      scopedToSelf = restrictToAssigned;
      viewerLabel = restrictToAssigned
        ? membership?.name
          ? `${membership.name.split(" ")[0]}'s day`
          : "My day"
        : "Today";

      const mapped = (jobRows ?? []).map((j) => {
        const start = resolveScheduledStart(j.scheduled_start, j.scheduled_date);
        const crew = crewByJob.get(j.id) ?? [];
        if (j.assigned_to_member_id && !crew.includes(j.assigned_to_member_id)) {
          crew.unshift(j.assigned_to_member_id);
        }
        const startDay = dayKey(start) ?? dayKey(j.scheduled_date);
        const hasStartDate = Boolean(startDay);
        const onDay = startDay === today;
        const assignedToMe = myMemberId
          ? j.assigned_to_member_id === myMemberId || crew.includes(myMemberId)
          : true;
        const isOpen =
          !j.assigned_to_member_id && crew.length === 0 && onDay;
        return {
          id: j.id,
          job_number: j.job_number as number,
          client_name: j.client_name as string | null,
          client_phone: j.client_phone as string | null,
          client_email: j.client_email as string | null,
          site_address: j.site_address as string | null,
          title: (j.title ?? j.trade) as string | null,
          status: j.status as string,
          scheduled_start: start,
          total_cost: j.total_cost as number | null,
          amount_paid: (j.amount_paid as number | null) ?? 0,
          work_started_at: (j.work_started_at as string | null) ?? null,
          has_start_date: hasStartDate,
          assigned_to_me: assignedToMe,
          on_day: onDay,
          is_open: isOpen,
        };
      });

      // Open pool for claimers — before filtering to "mine only"
      if (canClaimOpenJobs && myMemberId) {
        openJobs = mapped
          .filter((j) => j.is_open)
          .sort((a, b) => (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? ""))
          .map(({ assigned_to_me: _a, on_day: _o, is_open: _i, ...job }) => job);
      }

      const mine = mapped.filter((j) => !(restrictToAssigned && !j.assigned_to_me));

      // Today = dated for today, plus anything already on site (carry-over).
      todayJobs = mine
        .filter((j) => j.on_day || j.status === "in_progress")
        .sort((a, b) => {
          if (a.status === "in_progress" && b.status !== "in_progress") return -1;
          if (b.status === "in_progress" && a.status !== "in_progress") return 1;
          return (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? "");
        })
        .map(({ assigned_to_me: _a, on_day: _o, is_open: _i, ...job }) => job);

      // Undated stays a count for owners (set a date) — not a tile dump on My day.
      undatedJobs = mine
        .filter((j) => !j.has_start_date && j.status !== "in_progress")
        .sort((a, b) => a.job_number - b.job_number)
        .map(({ assigned_to_me: _a, on_day: _o, is_open: _i, ...job }) => job);

      tasks = (taskRows ?? [])
        .filter((t) => {
          if (!restrictToAssigned || !myMemberId) return true;
          return t.assigned_to_member_id === myMemberId;
        })
        .map((t) => {
          const job = t.jobs as unknown as {
            job_number: number;
            client_name: string | null;
            title: string | null;
          } | null;
          return {
            id: t.id,
            title: t.title,
            status: t.status,
            due_date: t.due_date,
            job_id: t.job_id,
            job_label: job
              ? `#${job.job_number} · ${job.client_name || job.title || "Job"}`
              : null,
          };
        });
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
        todayJobs={todayJobs}
        undatedCount={showCrewLink ? undatedJobs.length : 0}
        openJobs={openJobs}
        canClaimOpenJobs={canClaimOpenJobs}
        tasks={tasks}
        title={viewerLabel}
        dateLabel={dateLabel}
        scopedToSelf={scopedToSelf}
        showCrewLink={showCrewLink}
        canManageMoney={showCrewLink}
      />
    </>
  );
}
