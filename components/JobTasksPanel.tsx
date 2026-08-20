"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, Square, CheckSquare, Trash2 } from "lucide-react";

interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to_member_id: string | null;
  due_date: string | null;
  job_id?: string | null;
}

export default function JobTasksPanel({
  quoteId,
  jobId,
  profileId: _profileId,
  initialTasks,
  teamMembers,
}: {
  quoteId: string | null;
  jobId?: string | null;
  profileId: string;
  initialTasks: Task[];
  teamMembers: TeamMemberOption[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function memberLabel(id: string | null) {
    if (!id) return null;
    const m = teamMembers.find((tm) => tm.id === id);
    return m ? m.name || m.email : null;
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          jobId: jobId ?? null,
          quoteId: quoteId || null,
          assignedToMemberId: assignedTo || null,
          dueDate: dueDate || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't add task");
      setTasks((prev) => [...prev, body.task]);
      setTitle("");
      setAssignedTo("");
      setDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add task");
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(task: Task) {
    setBusyId(task.id);
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't update");
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTask(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't delete");
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
    } finally {
      setBusyId(null);
    }
  }

  const todo = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="card">
      <p className="section-tag mb-1">Tasks</p>
      <p className="font-semibold text-[var(--ink)] mb-1">Break the job down into steps</p>
      <p className="text-[12.5px] text-[var(--ink-faint)] mb-3">
        Assign to crew — they also see these on My day. For tasks with no job, use{" "}
        <Link href="/crew" className="underline font-semibold text-[var(--navy)]">
          Crew → Add a task
        </Link>
        .
      </p>

      <form onSubmit={addTask} className="flex gap-2 mb-3 flex-wrap">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Rough-in wiring, order downlights…"
          className="app-field flex-1 min-w-[160px]"
        />
        {teamMembers.length > 0 && (
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="app-field w-auto"
          >
            <option value="">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="app-field w-auto"
          title="Due date"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="btn-secondary px-3 inline-flex items-center gap-1"
        >
          <Plus size={14} /> Add
        </button>
      </form>

      {error && <p className="text-[12.5px] text-[var(--red)] mb-2">{error}</p>}

      {tasks.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] py-1">No tasks yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...todo, ...done].map((t) => {
            const label = memberLabel(t.assigned_to_member_id);
            return (
              <li key={t.id} className="flex items-center gap-2.5 py-1.5 group">
                <button
                  onClick={() => toggleTask(t)}
                  disabled={busyId === t.id}
                  className="shrink-0"
                  type="button"
                >
                  {t.status === "done" ? (
                    <CheckSquare size={17} className="text-[var(--green)]" />
                  ) : (
                    <Square size={17} className="text-[var(--ink-faint)]" />
                  )}
                </button>
                <span
                  className={`text-[13.5px] flex-1 ${
                    t.status === "done"
                      ? "line-through text-[var(--ink-faint)]"
                      : "text-[var(--ink)]"
                  }`}
                >
                  {t.title}
                  {t.due_date && (
                    <span className="ml-2 text-[11px] font-semibold text-[var(--ink-faint)]">
                      {t.due_date}
                    </span>
                  )}
                </span>
                {label && (
                  <span className="text-[11px] font-semibold text-[var(--ink-faint)] bg-[var(--app-bg)] px-2 py-0.5 rounded-full shrink-0">
                    {label}
                  </span>
                )}
                <button
                  onClick={() => deleteTask(t.id)}
                  disabled={busyId === t.id}
                  type="button"
                  className="text-[var(--ink-faint)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <p className="flex items-center gap-1 text-[11.5px] text-[var(--ink-faint)] mt-2">
          <Check size={12} /> {done.length} of {tasks.length} done
        </p>
      )}
    </div>
  );
}
