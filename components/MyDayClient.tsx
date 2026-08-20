"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Phone,
  Navigation,
  Play,
  Pause,
  CheckCircle2,
  MapPin,
  Briefcase,
  UsersRound,
  Square,
  CheckSquare,
  ListTodo,
  HandMetal,
} from "lucide-react";
import { suggestHoursFromStart } from "@/lib/jobTime";
import JobDoneSheet, { type DoneNextStep } from "@/components/JobDoneSheet";

export type MyDayJob = {
  id: string;
  job_number: number;
  client_name: string | null;
  client_phone: string | null;
  client_email?: string | null;
  site_address: string | null;
  title: string | null;
  status: string;
  scheduled_start: string | null;
  total_cost: number | null;
  amount_paid?: number | null;
  work_started_at?: string | null;
  has_start_date?: boolean;
};

export type MyDayTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  job_id: string | null;
  job_label: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "On site",
  on_hold: "On hold",
  awaiting_sign_off: "Sign-off",
};

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  if (iso.endsWith("T00:00:00.000Z") || iso.endsWith("T00:00:00Z")) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Australia/Melbourne",
    });
  } catch {
    return null;
  }
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function JobTile({
  job,
  busy,
  onStart,
  onPause,
  onDone,
}: {
  job: MyDayJob;
  busy: boolean;
  onStart: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onDone: (job: MyDayJob) => void;
}) {
  const time = formatTime(job.scheduled_start);
  const canStart = job.status === "scheduled" || job.status === "on_hold";
  const canPause = job.status === "in_progress";
  const canComplete = job.status === "in_progress" || job.status === "awaiting_sign_off" || job.status === "on_hold";
  const onSite = job.status === "in_progress";

  function stop(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <article
      className={[
        "relative flex flex-col rounded-2xl border bg-[var(--surface)] overflow-hidden min-h-[148px]",
        onSite ? "border-[var(--amber)]/50 shadow-[0_0_0_1px_rgba(255,180,0,0.12)]" : "border-[var(--line)]",
      ].join(" ")}
    >
      <Link href={`/jobs/${job.id}`} className="flex-1 flex flex-col p-3 pb-2 active:bg-[var(--app-bg)]">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold text-[var(--ink-faint)]">#{job.job_number}</span>
          {time ? (
            <span className="text-[10px] font-bold text-[var(--ink-soft)]">{time}</span>
          ) : (
            <span className="text-[10px] font-semibold text-[var(--amber-deep)] truncate">
              {STATUS_LABEL[job.status] ?? job.status}
            </span>
          )}
        </div>

        <p className="font-semibold text-[14px] text-[var(--ink)] leading-snug line-clamp-2 mb-0.5">
          {job.client_name || "No client name"}
        </p>
        {job.title && (
          <p className="text-[12px] text-[var(--ink-soft)] truncate mb-1">{job.title}</p>
        )}
        {job.site_address ? (
          <p className="mt-auto text-[11.5px] text-[var(--ink-faint)] line-clamp-2 flex gap-1">
            <MapPin size={11} className="mt-0.5 shrink-0" />
            <span>{job.site_address}</span>
          </p>
        ) : (
          <span className="mt-auto" />
        )}

        {time && (
          <p className="text-[10px] font-semibold text-[var(--amber-deep)] mt-1.5">
            {STATUS_LABEL[job.status] ?? job.status}
          </p>
        )}
      </Link>

      <div className="flex items-stretch border-t border-[var(--line-subtle)]">
        {job.client_phone ? (
          <a
            href={`tel:${job.client_phone.replace(/\s/g, "")}`}
            onClick={stop}
            className="flex-1 flex items-center justify-center py-2.5 text-[var(--ink-soft)] hover:bg-[var(--app-bg)]"
            aria-label="Call"
          >
            <Phone size={15} />
          </a>
        ) : null}
        {job.site_address ? (
          <a
            href={mapsUrl(job.site_address)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            className="flex-1 flex items-center justify-center py-2.5 text-[var(--ink-soft)] hover:bg-[var(--app-bg)] border-l border-[var(--line-subtle)]"
            aria-label="Navigate"
          >
            <Navigation size={15} />
          </a>
        ) : null}
        {canStart && (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              stop(e);
              onStart(job.id);
            }}
            className="flex-[1.4] flex items-center justify-center gap-1 py-2.5 bg-[var(--amber)] text-[var(--navy)] font-bold text-[12px] disabled:opacity-50 border-l border-[var(--line-subtle)]"
          >
            <Play size={13} strokeWidth={2.5} />
            {busy ? "…" : "Start"}
          </button>
        )}
        {canPause && (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              stop(e);
              onPause(job.id);
            }}
            className="flex-1 flex items-center justify-center py-2.5 text-[var(--ink-soft)] font-bold text-[12px] disabled:opacity-50 border-l border-[var(--line-subtle)]"
            aria-label="Pause"
          >
            <Pause size={13} />
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              stop(e);
              onDone(job);
            }}
            className="flex-[1.4] flex items-center justify-center gap-1 py-2.5 bg-[var(--amber)] text-[var(--navy)] font-bold text-[12px] disabled:opacity-50 border-l border-[var(--line-subtle)]"
          >
            <CheckCircle2 size={13} strokeWidth={2.5} />
            {busy ? "…" : "Done"}
          </button>
        )}
        {!canStart && !canComplete && !canPause && (
          <Link
            href={`/jobs/${job.id}`}
            className="flex-1 flex items-center justify-center py-2.5 text-[12px] font-semibold text-[var(--ink-soft)] border-l border-[var(--line-subtle)]"
          >
            Open
          </Link>
        )}
      </div>
    </article>
  );
}

function TileGrid({
  jobs,
  busyId,
  onStart,
  onPause,
  onDone,
}: {
  jobs: MyDayJob[];
  busyId: string | null;
  onStart: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onDone: (job: MyDayJob) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {jobs.map((job) => (
        <JobTile
          key={job.id}
          job={job}
          busy={busyId === job.id}
          onStart={onStart}
          onPause={onPause}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

export default function MyDayClient({
  todayJobs,
  undatedCount = 0,
  openJobs = [],
  canClaimOpenJobs = false,
  tasks: initialTasks = [],
  title,
  dateLabel,
  scopedToSelf,
  showCrewLink = false,
  canManageMoney = false,
}: {
  todayJobs: MyDayJob[];
  undatedCount?: number;
  openJobs?: MyDayJob[];
  canClaimOpenJobs?: boolean;
  tasks?: MyDayTask[];
  title: string;
  dateLabel: string;
  scopedToSelf: boolean;
  showCrewLink?: boolean;
  canManageMoney?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [openPool, setOpenPool] = useState(openJobs);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [doneJob, setDoneJob] = useState<MyDayJob | null>(null);

  async function toggleTask(task: MyDayTask) {
    const next = task.status === "done" ? "todo" : "done";
    setBusyId(`task-${task.id}`);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn’t update task");
      }
      setTasks((prev) =>
        next === "done"
          ? prev.filter((t) => t.id !== task.id)
          : prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update task");
    } finally {
      setBusyId(null);
    }
  }

  async function claimJob(jobId: string) {
    setBusyId(`claim-${jobId}`);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/claim`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn’t claim job");
      setOpenPool((prev) => prev.filter((j) => j.id !== jobId));
      setToast(data.alreadyYours ? "Already on your list" : "It’s yours — see Starting today");
      setTimeout(() => setToast(null), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t claim job");
    } finally {
      setBusyId(null);
    }
  }

  async function postStatus(jobId: string, body: Record<string, unknown>) {
    setBusyId(jobId);
    setError(null);
    try {
      const res = await fetch("/api/jobs/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn’t update job");
      return data as {
        timesheetLogged?: { hours: number };
        pausedOther?: { job_number: number } | null;
      };
    } finally {
      setBusyId(null);
    }
  }

  async function startJob(jobId: string) {
    try {
      const data = await postStatus(jobId, { status: "in_progress" });
      if (data.pausedOther?.job_number) {
        setToast(`Started — paused job #${data.pausedOther.job_number}`);
      } else {
        setToast("Started — time is running");
      }
      setTimeout(() => setToast(null), 3500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update job");
    }
  }

  async function pauseJob(jobId: string) {
    try {
      await postStatus(jobId, { status: "on_hold" });
      setToast("Paused — clock kept for when you resume");
      setTimeout(() => setToast(null), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update job");
    }
  }

  async function confirmDone(opts: {
    hours: number | null;
    next: DoneNextStep;
    cashAmount?: number;
  }) {
    if (!doneJob) return;
    const jobId = doneJob.id;
    setBusyId(jobId);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        completeJob: true,
        hours: opts.hours,
        skipTimesheet: opts.hours == null,
      };
      if (opts.next === "sign_off") {
        body.completeJob = false;
        body.status = "awaiting_sign_off";
        body.logHoursOnly = true;
      }
      if (opts.next === "cash" && opts.cashAmount && opts.cashAmount > 0) {
        body.paymentAmount = opts.cashAmount;
      }

      const res = await fetch("/api/jobs/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn’t finish");

      setDoneJob(null);
      if (opts.next === "invoice") {
        window.open(`/api/jobs/${jobId}/invoice-pdf`, "_blank");
      }
      if (data.timesheetLogged?.hours) {
        setToast(`Logged ${data.timesheetLogged.hours}h`);
      } else {
        setToast(opts.next === "sign_off" ? "Awaiting sign-off" : "Job complete");
      }
      setTimeout(() => setToast(null), 3500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t finish");
    } finally {
      setBusyId(null);
    }
  }

  const openTasks = tasks.filter((t) => t.status !== "done");
  const empty =
    todayJobs.length === 0 &&
    openTasks.length === 0 &&
    openPool.length === 0;

  return (
    <main className="page-wrap pb-24 sm:pb-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--amber-deep)] mb-1">
            {dateLabel}
          </p>
          <h1 className="font-display text-[26px] sm:text-[28px] text-[var(--ink)] leading-none">{title}</h1>
        </div>
        {showCrewLink ? (
          <Link
            href="/crew"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--navy)] border border-[var(--line)] rounded-xl px-3 py-2 hover:border-[var(--navy)]"
          >
            <UsersRound size={14} /> Crew
          </Link>
        ) : (
          <p className="text-[12px] text-[var(--ink-faint)] text-right shrink-0">
            {scopedToSelf ? "Your jobs" : "By start date"}
          </p>
        )}
      </div>

      {(error || toast) && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2.5 text-[13px] font-semibold ${
            error
              ? "border-red-200 bg-[var(--red-bg)] text-[var(--red)]"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
          }`}
        >
          {error ?? toast}
        </div>
      )}

      {showCrewLink && undatedCount > 0 && (
        <Link
          href="/jobs"
          className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px]"
        >
          <span className="text-[var(--ink-soft)]">
            <span className="font-bold text-[var(--ink)]">{undatedCount}</span> job
            {undatedCount === 1 ? "" : "s"} need a start date
          </span>
          <span className="font-semibold text-[var(--navy)] shrink-0">Set dates →</span>
        </Link>
      )}

      {empty ? (
        <div className="card text-center py-10">
          <Briefcase size={28} className="mx-auto text-[var(--ink-faint)] mb-3" />
          <p className="font-semibold text-[var(--ink)] mb-1">Nothing for today</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4 max-w-[36ch] mx-auto">
            {scopedToSelf
              ? "Nothing on you yet. Grab open work above, or wait for an assign with a date."
              : "Assign someone with a start date from Crew — or put yourself on a job."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {showCrewLink && (
              <Link href="/crew" className="btn-primary text-[13px] py-2 px-3">
                Crew
              </Link>
            )}
            <Link href="/schedule" className="btn-secondary text-[13px] py-2 px-3">
              Schedule
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          {canClaimOpenJobs && openPool.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--amber-deep)] flex items-center gap-1.5">
                  <HandMetal size={12} /> Open today — grab one
                </p>
                <span className="text-[11px] font-semibold text-[var(--ink-faint)]">{openPool.length}</span>
              </div>
              <ul className="space-y-2">
                {openPool.map((job) => (
                  <li
                    key={job.id}
                    className="rounded-2xl border border-dashed border-[var(--amber)]/45 bg-[var(--surface)] p-3 flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-semibold text-[14px] text-[var(--ink)] hover:underline"
                      >
                        #{job.job_number} · {job.client_name || job.title || "Job"}
                      </Link>
                      {job.site_address && (
                        <p className="text-[12px] text-[var(--ink-faint)] mt-0.5 flex gap-1">
                          <MapPin size={12} className="mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{job.site_address}</span>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busyId === `claim-${job.id}`}
                      onClick={() => void claimJob(job.id)}
                      className="shrink-0 btn-primary text-[12px] py-2 px-3"
                    >
                      {busyId === `claim-${job.id}` ? "…" : "I’ll take it"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {openTasks.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] flex items-center gap-1.5">
                  <ListTodo size={12} /> Tasks
                </p>
                <span className="text-[11px] font-semibold text-[var(--ink-faint)]">{openTasks.length}</span>
              </div>
              <ul className="space-y-1.5">
                {openTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
                  >
                    <button
                      type="button"
                      disabled={busyId === `task-${t.id}`}
                      onClick={() => void toggleTask(t)}
                      className="shrink-0"
                    >
                      {t.status === "done" ? (
                        <CheckSquare size={17} className="text-[var(--green)]" />
                      ) : (
                        <Square size={17} className="text-[var(--ink-faint)]" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{t.title}</p>
                      {t.job_id && t.job_label ? (
                        <Link
                          href={`/jobs/${t.job_id}`}
                          className="text-[11.5px] text-[var(--navy)] font-semibold truncate block"
                        >
                          {t.job_label}
                        </Link>
                      ) : (
                        <p className="text-[11.5px] text-[var(--ink-faint)]">Standalone task</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                On today
              </p>
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">{todayJobs.length}</span>
            </div>
            {todayJobs.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-faint)]">No dated or on-site jobs.</p>
            ) : (
              <TileGrid
                jobs={todayJobs}
                busyId={busyId}
                onStart={(id) => void startJob(id)}
                onPause={(id) => void pauseJob(id)}
                onDone={setDoneJob}
              />
            )}
          </section>
        </div>
      )}

      <JobDoneSheet
        open={Boolean(doneJob)}
        suggestedHours={suggestHoursFromStart(doneJob?.work_started_at)}
        owing={Math.max((doneJob?.total_cost ?? 0) - (doneJob?.amount_paid ?? 0), 0)}
        canManageMoney={canManageMoney}
        busy={busyId === doneJob?.id}
        onCancel={() => setDoneJob(null)}
        onConfirm={(opts) => void confirmDone(opts)}
      />
    </main>
  );
}
