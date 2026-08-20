"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Phone,
  Navigation,
  Play,
  CheckCircle2,
  MapPin,
  Briefcase,
} from "lucide-react";

export type MyDayJob = {
  id: string;
  job_number: number;
  client_name: string | null;
  client_phone: string | null;
  site_address: string | null;
  title: string | null;
  status: string;
  scheduled_start: string | null;
  total_cost: number | null;
  has_start_date?: boolean;
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
  onStatus,
  forceNoStartLabel,
}: {
  job: MyDayJob;
  busy: boolean;
  onStatus: (jobId: string, status: string) => void;
  forceNoStartLabel?: boolean;
}) {
  const time = formatTime(job.scheduled_start);
  const noStart = forceNoStartLabel || job.has_start_date === false || !job.scheduled_start;
  const canStart = job.status === "scheduled" || job.status === "on_hold";
  const canComplete = job.status === "in_progress" || job.status === "awaiting_sign_off";
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
          {noStart ? (
            <span className="text-[10px] font-semibold text-[var(--ink-faint)] truncate">No start date</span>
          ) : time ? (
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

        {(noStart || time) && (
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
              onStatus(job.id, "in_progress");
            }}
            className="flex-[1.4] flex items-center justify-center gap-1 py-2.5 bg-[var(--amber)] text-[var(--navy)] font-bold text-[12px] disabled:opacity-50 border-l border-[var(--line-subtle)]"
          >
            <Play size={13} strokeWidth={2.5} />
            {busy ? "…" : "Start"}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              stop(e);
              onStatus(job.id, "complete");
            }}
            className="flex-[1.4] flex items-center justify-center gap-1 py-2.5 bg-[var(--amber)] text-[var(--navy)] font-bold text-[12px] disabled:opacity-50 border-l border-[var(--line-subtle)]"
          >
            <CheckCircle2 size={13} strokeWidth={2.5} />
            {busy ? "…" : "Done"}
          </button>
        )}
        {!canStart && !canComplete && (
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
  onStatus,
  forceNoStartLabel,
}: {
  jobs: MyDayJob[];
  busyId: string | null;
  onStatus: (jobId: string, status: string) => void;
  forceNoStartLabel?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {jobs.map((job) => (
        <JobTile
          key={job.id}
          job={job}
          busy={busyId === job.id}
          onStatus={onStatus}
          forceNoStartLabel={forceNoStartLabel}
        />
      ))}
    </div>
  );
}

export default function MyDayClient({
  todayJobs,
  undatedJobs,
  title,
  dateLabel,
  scopedToSelf,
}: {
  todayJobs: MyDayJob[];
  undatedJobs: MyDayJob[];
  title: string;
  dateLabel: string;
  scopedToSelf: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(jobId: string, status: string) {
    setBusyId(jobId);
    setError(null);
    try {
      const res = await fetch("/api/jobs/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          status === "complete"
            ? { jobId, completeJob: true }
            : { jobId, status }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn’t update job");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update job");
    } finally {
      setBusyId(null);
    }
  }

  const empty = todayJobs.length === 0 && undatedJobs.length === 0;

  return (
    <main className="page-wrap pb-24 sm:pb-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--amber-deep)] mb-1">
            {dateLabel}
          </p>
          <h1 className="font-display text-[26px] sm:text-[28px] text-[var(--ink)] leading-none">{title}</h1>
        </div>
        <p className="text-[12px] text-[var(--ink-faint)] text-right shrink-0 max-w-[14ch] sm:max-w-none">
          {scopedToSelf ? "Your jobs" : "By start date"}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-[var(--red-bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--red)]">
          {error}
        </div>
      )}

      {empty ? (
        <div className="card text-center py-10">
          <Briefcase size={28} className="mx-auto text-[var(--ink-faint)] mb-3" />
          <p className="font-semibold text-[var(--ink)] mb-1">Nothing scheduled for today</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4 max-w-[36ch] mx-auto">
            Set a start date on the job or schedule to see it here.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/schedule" className="btn-secondary text-[13px] py-2 px-3">
              Schedule
            </Link>
            <Link href="/jobs" className="btn-primary text-[13px] py-2 px-3">
              Jobs board
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                Starting today
              </p>
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">{todayJobs.length}</span>
            </div>
            {todayJobs.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-faint)]">No jobs with a start date of today.</p>
            ) : (
              <TileGrid jobs={todayJobs} busyId={busyId} onStatus={setStatus} />
            )}
          </section>

          {undatedJobs.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                  No start date
                </p>
                <span className="text-[11px] font-semibold text-[var(--ink-faint)]">{undatedJobs.length}</span>
              </div>
              <TileGrid
                jobs={undatedJobs}
                busyId={busyId}
                onStatus={setStatus}
                forceNoStartLabel
              />
            </section>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-[13px]">
        <Link href="/jobs" className="font-semibold text-[var(--navy)] underline underline-offset-2">
          Jobs board
        </Link>
        <span className="text-[var(--ink-faint)]">·</span>
        <Link href="/schedule" className="font-semibold text-[var(--navy)] underline underline-offset-2">
          Schedule
        </Link>
      </div>
    </main>
  );
}
