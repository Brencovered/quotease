"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UsersRound,
  MapPin,
  Plus,
  CheckSquare,
  Square,
  Loader2,
  ListTodo,
} from "lucide-react";

export type CrewDayMember = { id: string; name: string };
export type CrewDayJob = {
  id: string;
  job_number: number;
  client_name: string | null;
  site_address: string | null;
  title: string | null;
  status: string;
  scheduled_start: string | null;
  member_ids: string[];
};
export type CrewTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to_member_id: string | null;
  job_id: string | null;
  job_label: string | null;
};

function labelDay(iso: string, index: number) {
  const d = new Date(`${iso}T12:00:00`);
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function jobLabel(j: Pick<CrewDayJob, "job_number" | "client_name" | "title">) {
  return `#${j.job_number} · ${j.client_name || j.title || "Job"}`;
}

export default function CrewDayClient({
  members,
  days,
  jobsByDay: initialJobsByDay,
  tasks: initialTasks,
  todayIso,
}: {
  members: CrewDayMember[];
  days: string[];
  jobsByDay: Record<string, CrewDayJob[]>;
  tasks: CrewTask[];
  todayIso: string;
}) {
  const router = useRouter();
  const [jobsByDay, setJobsByDay] = useState(initialJobsByDay);
  const [tasks, setTasks] = useState(initialTasks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-member assign / task composers
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignJobId, setAssignJobId] = useState("");
  const [taskFor, setTaskFor] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskJobId, setTaskJobId] = useState("");
  const [standaloneOpen, setStandaloneOpen] = useState(false);
  const [standaloneTitle, setStandaloneTitle] = useState("");
  const [standaloneMember, setStandaloneMember] = useState("");
  const [standaloneJobId, setStandaloneJobId] = useState("");

  const today = days[0];
  const todayJobs = jobsByDay[today] ?? [];

  const allJobsFlat = useMemo(
    () => Object.values(jobsByDay).flat(),
    [jobsByDay]
  );

  const unassignedToday = todayJobs.filter((j) => j.member_ids.length === 0);

  function setJobMembers(jobId: string, memberIds: string[]) {
    setJobsByDay((prev) => {
      const next: Record<string, CrewDayJob[]> = {};
      for (const [day, list] of Object.entries(prev)) {
        next[day] = list.map((j) =>
          j.id === jobId ? { ...j, member_ids: memberIds } : j
        );
      }
      return next;
    });
  }

  async function assignJob(jobId: string, teamMemberId: string | null) {
    setBusy(`assign-${jobId}`);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMemberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn’t assign");
      setJobMembers(jobId, teamMemberId ? [teamMemberId] : []);
      setAssignFor(null);
      setAssignJobId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t assign");
    } finally {
      setBusy(null);
    }
  }

  async function createTask(opts: {
    title: string;
    assignedToMemberId?: string | null;
    jobId?: string | null;
  }) {
    const title = opts.title.trim();
    if (!title) return;
    setBusy("task");
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          assignedToMemberId: opts.assignedToMemberId || null,
          jobId: opts.jobId || null,
          dueDate: todayIso,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn’t add task");
      const job = opts.jobId
        ? allJobsFlat.find((j) => j.id === opts.jobId)
        : null;
      setTasks((prev) => [
        ...prev,
        {
          id: data.task.id,
          title: data.task.title,
          status: data.task.status,
          due_date: data.task.due_date,
          assigned_to_member_id: data.task.assigned_to_member_id,
          job_id: data.task.job_id,
          job_label: job ? jobLabel(job) : null,
        },
      ]);
      setTaskFor(null);
      setTaskTitle("");
      setTaskJobId("");
      setStandaloneOpen(false);
      setStandaloneTitle("");
      setStandaloneMember("");
      setStandaloneJobId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t add task");
    } finally {
      setBusy(null);
    }
  }

  async function toggleTask(task: CrewTask) {
    setBusy(`task-${task.id}`);
    try {
      const next = task.status === "done" ? "todo" : "done";
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn’t update");
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update task");
    } finally {
      setBusy(null);
    }
  }

  const openTasks = tasks.filter((t) => t.status !== "done");

  return (
    <main className="page-wrap pb-24 sm:pb-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--amber-deep)] mb-1">
            Next 7 days
          </p>
          <h1 className="font-display text-[28px] text-[var(--ink)] leading-none">Crew</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-1">
            Assign jobs and tasks here — they land on My day with a ping.
          </p>
        </div>
        <Link
          href="/schedule"
          className="text-[13px] font-semibold text-[var(--navy)] underline underline-offset-2 shrink-0"
        >
          Week calendar
        </Link>
      </div>

      {error && (
        <p className="text-[13px] text-[var(--red)] mb-3 font-semibold">{error}</p>
      )}

      {/* Quick add: standalone or job-linked task */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 mb-5">
        <button
          type="button"
          onClick={() => setStandaloneOpen((v) => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          <ListTodo size={16} className="text-[var(--amber-deep)]" />
          <span className="font-semibold text-[14px] text-[var(--ink)] flex-1">
            Add a task
          </span>
          <Plus size={16} className="text-[var(--ink-faint)]" />
        </button>
        {standaloneOpen && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void createTask({
                title: standaloneTitle,
                assignedToMemberId: standaloneMember || null,
                jobId: standaloneJobId || null,
              });
            }}
          >
            <input
              value={standaloneTitle}
              onChange={(e) => setStandaloneTitle(e.target.value)}
              placeholder="e.g. Pick up fittings, chase council permit…"
              className="app-field w-full"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={standaloneMember}
                onChange={(e) => setStandaloneMember(e.target.value)}
                className="app-field text-[13px] w-auto flex-1 min-w-[140px]"
              >
                <option value="">Anyone / unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={standaloneJobId}
                onChange={(e) => setStandaloneJobId(e.target.value)}
                className="app-field text-[13px] w-auto flex-1 min-w-[160px]"
              >
                <option value="">Independent (no job)</option>
                {allJobsFlat.map((j) => (
                  <option key={j.id} value={j.id}>
                    {jobLabel(j)}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy === "task" || !standaloneTitle.trim()}
                className="btn-primary text-[13px] py-2 px-3"
              >
                {busy === "task" ? "Adding…" : "Add task"}
              </button>
            </div>
            <p className="text-[11.5px] text-[var(--ink-faint)]">
              Due today. Leave job blank for a standalone task (not tied to a job).
            </p>
          </form>
        )}
      </div>

      {members.length === 0 ? (
        <div className="card text-center py-8">
          <UsersRound size={26} className="mx-auto text-[var(--ink-faint)] mb-2" />
          <p className="font-semibold text-[var(--ink)] mb-1">No team members yet</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">Invite your crew to assign jobs.</p>
          <Link href="/team" className="btn-primary inline-flex text-[13px] py-2 px-3">
            Manage team
          </Link>
        </div>
      ) : (
        <>
          {unassignedToday.length > 0 && (
            <section className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--amber-deep)] mb-2.5">
                Unassigned today · {unassignedToday.length}
              </p>
              <div className="space-y-2">
                {unassignedToday.map((j) => (
                  <div
                    key={j.id}
                    className="rounded-2xl border border-dashed border-[var(--amber)]/40 bg-[var(--surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <Link
                          href={`/jobs/${j.id}`}
                          className="text-[13px] font-semibold text-[var(--ink)] hover:underline"
                        >
                          {jobLabel(j)}
                        </Link>
                        {j.site_address && (
                          <p className="text-[11.5px] text-[var(--ink-faint)] truncate flex items-center gap-1 mt-0.5">
                            <MapPin size={11} /> {j.site_address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) void assignJob(j.id, id);
                        }}
                        disabled={busy === `assign-${j.id}`}
                        className="app-field text-[13px] w-auto py-1.5"
                      >
                        <option value="">Assign to…</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {busy === `assign-${j.id}` && (
                        <Loader2 size={14} className="animate-spin text-[var(--ink-faint)]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2.5">
              Today · {todayJobs.length} job{todayJobs.length === 1 ? "" : "s"}
              {openTasks.length > 0 ? ` · ${openTasks.length} task${openTasks.length === 1 ? "" : "s"}` : ""}
            </p>
            <div className="space-y-2">
              {members.map((m) => {
                const theirs = todayJobs.filter((j) => j.member_ids.includes(m.id));
                const theirTasks = openTasks.filter((t) => t.assigned_to_member_id === m.id);
                const assignable = todayJobs.filter(
                  (j) => !j.member_ids.includes(m.id)
                );

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-[14px] text-[var(--ink)]">{m.name}</p>
                      <span className="text-[11px] font-bold text-[var(--ink-faint)]">
                        {theirs.length === 0 && theirTasks.length === 0
                          ? "Free"
                          : `${theirs.length} job${theirs.length === 1 ? "" : "s"}${
                              theirTasks.length
                                ? ` · ${theirTasks.length} task${theirTasks.length === 1 ? "" : "s"}`
                                : ""
                            }`}
                      </span>
                    </div>

                    {theirs.length === 0 && theirTasks.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--ink-faint)] mb-2">Nothing scheduled</p>
                    ) : (
                      <ul className="space-y-1.5 mb-2">
                        {theirs.map((j) => (
                          <li key={j.id} className="flex items-stretch gap-1.5">
                            <Link
                              href={`/jobs/${j.id}`}
                              className="flex-1 min-w-0 block rounded-xl bg-[var(--app-bg)] px-2.5 py-2 hover:bg-[var(--line-subtle)]"
                            >
                              <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                                {jobLabel(j)}
                              </p>
                              {j.site_address && (
                                <p className="text-[11.5px] text-[var(--ink-faint)] truncate flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} /> {j.site_address}
                                </p>
                              )}
                            </Link>
                            <button
                              type="button"
                              title="Unassign"
                              disabled={busy === `assign-${j.id}`}
                              onClick={() => void assignJob(j.id, null)}
                              className="shrink-0 text-[11px] font-bold text-[var(--ink-faint)] hover:text-[var(--red)] px-2 rounded-lg"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                        {theirTasks.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center gap-2 rounded-xl bg-[var(--app-bg)] px-2.5 py-2"
                          >
                            <button
                              type="button"
                              onClick={() => void toggleTask(t)}
                              disabled={busy === `task-${t.id}`}
                              className="shrink-0"
                            >
                              {t.status === "done" ? (
                                <CheckSquare size={16} className="text-[var(--green)]" />
                              ) : (
                                <Square size={16} className="text-[var(--ink-faint)]" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-[var(--ink)] truncate">{t.title}</p>
                              <p className="text-[11px] text-[var(--ink-faint)] truncate">
                                {t.job_label || "Standalone task"}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignFor(assignFor === m.id ? null : m.id);
                          setTaskFor(null);
                          setAssignJobId("");
                        }}
                        className="text-[12px] font-bold text-[var(--navy)] hover:bg-[var(--app-bg)] rounded-lg px-2 py-1"
                      >
                        + Job
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTaskFor(taskFor === m.id ? null : m.id);
                          setAssignFor(null);
                          setTaskTitle("");
                          setTaskJobId("");
                        }}
                        className="text-[12px] font-bold text-[var(--navy)] hover:bg-[var(--app-bg)] rounded-lg px-2 py-1"
                      >
                        + Task
                      </button>
                    </div>

                    {assignFor === m.id && (
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        {assignable.length === 0 ? (
                          <p className="text-[12px] text-[var(--ink-faint)]">
                            No other jobs today to assign. Set a start date on a job first.
                          </p>
                        ) : (
                          <>
                            <select
                              value={assignJobId}
                              onChange={(e) => setAssignJobId(e.target.value)}
                              className="app-field text-[13px] w-auto flex-1 min-w-[160px]"
                            >
                              <option value="">Pick a job…</option>
                              {assignable.map((j) => (
                                <option key={j.id} value={j.id}>
                                  {jobLabel(j)}
                                  {j.member_ids.length ? " (has crew)" : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!assignJobId || busy?.startsWith("assign-")}
                              onClick={() => void assignJob(assignJobId, m.id)}
                              className="btn-primary text-[12px] py-1.5 px-3"
                            >
                              Assign
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {taskFor === m.id && (
                      <form
                        className="mt-2 space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void createTask({
                            title: taskTitle,
                            assignedToMemberId: m.id,
                            jobId: taskJobId || null,
                          });
                        }}
                      >
                        <input
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="Task for them…"
                          className="app-field w-full text-[13px]"
                          autoFocus
                        />
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={taskJobId}
                            onChange={(e) => setTaskJobId(e.target.value)}
                            className="app-field text-[13px] w-auto flex-1 min-w-[140px]"
                          >
                            <option value="">Independent</option>
                            {theirs.concat(assignable).map((j) => (
                              <option key={j.id} value={j.id}>
                                On {jobLabel(j)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            disabled={busy === "task" || !taskTitle.trim()}
                            className="btn-primary text-[12px] py-1.5 px-3"
                          >
                            Add
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Unassigned open tasks */}
          {openTasks.some((t) => !t.assigned_to_member_id) && (
            <section className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2.5">
                Unassigned tasks
              </p>
              <ul className="space-y-1.5">
                {openTasks
                  .filter((t) => !t.assigned_to_member_id)
                  .map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                    >
                      <button type="button" onClick={() => void toggleTask(t)}>
                        <Square size={16} className="text-[var(--ink-faint)]" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[var(--ink)] truncate">{t.title}</p>
                        <p className="text-[11px] text-[var(--ink-faint)]">
                          {t.job_label || "Standalone"}
                        </p>
                      </div>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const mid = e.target.value;
                          if (!mid) return;
                          void fetch(`/api/tasks/${t.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ assignedToMemberId: mid }),
                          }).then((res) => {
                            if (res.ok) {
                              setTasks((prev) =>
                                prev.map((x) =>
                                  x.id === t.id
                                    ? { ...x, assigned_to_member_id: mid }
                                    : x
                                )
                              );
                            }
                          });
                        }}
                        className="app-field text-[12px] w-auto py-1"
                      >
                        <option value="">Assign…</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2.5">
              Rest of the week
            </p>
            <div className="space-y-3">
              {days.slice(1).map((d, i) => {
                const dayJobs = jobsByDay[d] ?? [];
                return (
                  <div
                    key={d}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-[13px] font-semibold text-[var(--ink)] mb-2">
                      {labelDay(d, i + 1)}
                      <span className="text-[var(--ink-faint)] font-normal ml-2">
                        {dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}
                      </span>
                    </p>
                    {dayJobs.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--ink-faint)]">Clear</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayJobs.map((j) => {
                          const names = members
                            .filter((m) => j.member_ids.includes(m.id))
                            .map((m) => m.name.split(" ")[0])
                            .join(", ");
                          return (
                            <div
                              key={j.id}
                              className="flex items-center gap-2 rounded-xl bg-[var(--app-bg)] px-2.5 py-2"
                            >
                              <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                                  {jobLabel(j)}
                                </p>
                                <p className="text-[11.5px] text-[var(--ink-faint)] truncate">
                                  {names || "Unassigned"}
                                </p>
                              </Link>
                              <select
                                value={j.member_ids[0] ?? ""}
                                onChange={(e) =>
                                  void assignJob(j.id, e.target.value || null)
                                }
                                disabled={busy === `assign-${j.id}`}
                                className="app-field text-[11px] w-auto py-1 max-w-[120px]"
                              >
                                <option value="">Assign…</option>
                                {members.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name.split(" ")[0]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-[13px]">
        <Link href="/today" className="font-semibold text-[var(--navy)] underline underline-offset-2">
          My day
        </Link>
        <span className="text-[var(--ink-faint)]">·</span>
        <Link href="/team" className="font-semibold text-[var(--navy)] underline underline-offset-2">
          Team
        </Link>
        <span className="text-[var(--ink-faint)]">·</span>
        <Link href="/jobs" className="font-semibold text-[var(--navy)] underline underline-offset-2">
          All jobs
        </Link>
      </div>
    </main>
  );
}
