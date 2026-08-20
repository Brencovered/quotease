"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Phone,
  Navigation,
  Play,
  CheckCircle2,
  MapPin,
  Briefcase,
  ChevronRight,
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
  assigned_to_me?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "On site",
  on_hold: "On hold",
  awaiting_sign_off: "Awaiting sign-off",
};

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
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

export default function MyDayClient({
  jobs,
  title,
  dateLabel,
  scopedToSelf,
}: {
  jobs: MyDayJob[];
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

  return (
    <main className="page-wrap pb-24 sm:pb-10">
      <div className="mb-5">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--amber-deep)] mb-1">
          {dateLabel}
        </p>
        <h1 className="font-display text-[28px] text-[var(--ink)] leading-none mb-1">{title}</h1>
        <p className="text-[13.5px] text-[var(--ink-faint)]">
          {scopedToSelf
            ? "Jobs you’re on today — call, navigate, start, done."
            : "Today’s jobs for the business. Board and schedule stay one tap away."}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-[var(--red-bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--red)]">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="card text-center py-10">
          <Briefcase size={28} className="mx-auto text-[var(--ink-faint)] mb-3" />
          <p className="font-semibold text-[var(--ink)] mb-1">Nothing on for today</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-4 max-w-[36ch] mx-auto">
            Schedule a job or open the board to see what’s coming up.
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
        <div className="space-y-3">
          {jobs.map((job) => {
            const time = formatTime(job.scheduled_start);
            const busy = busyId === job.id;
            const canStart = job.status === "scheduled" || job.status === "on_hold";
            const canComplete = job.status === "in_progress" || job.status === "awaiting_sign_off";

            return (
              <article key={job.id} className="card !p-0 overflow-hidden">
                <Link href={`/jobs/${job.id}`} className="block px-4 pt-4 pb-3 hover:bg-[var(--app-bg)]/60 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                          #{job.job_number}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--amber-deep)]">
                          {STATUS_LABEL[job.status] ?? job.status}
                        </span>
                        {time && (
                          <span className="text-[11px] font-semibold text-[var(--ink-soft)]">{time}</span>
                        )}
                      </div>
                      <p className="font-semibold text-[15px] text-[var(--ink)] truncate">
                        {job.client_name || "No client name"}
                      </p>
                      {job.title && (
                        <p className="text-[13px] text-[var(--ink-soft)] truncate">{job.title}</p>
                      )}
                      {job.site_address && (
                        <p className="text-[12.5px] text-[var(--ink-faint)] mt-1 flex items-start gap-1">
                          <MapPin size={12} className="mt-0.5 shrink-0" />
                          <span>{job.site_address}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-[var(--ink-faint)] shrink-0 mt-1" />
                  </div>
                </Link>

                <div className="px-3 pb-3 flex flex-wrap gap-2 border-t border-[var(--line-subtle)] pt-3">
                  {job.client_phone && (
                    <a
                      href={`tel:${job.client_phone.replace(/\s/g, "")}`}
                      className="btn-secondary text-[12.5px] py-2 px-3 inline-flex items-center gap-1.5"
                    >
                      <Phone size={13} /> Call
                    </a>
                  )}
                  {job.site_address && (
                    <a
                      href={mapsUrl(job.site_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-[12.5px] py-2 px-3 inline-flex items-center gap-1.5"
                    >
                      <Navigation size={13} /> Navigate
                    </a>
                  )}
                  {canStart && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(job.id, "in_progress")}
                      className="btn-primary text-[12.5px] py-2 px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Play size={13} /> {busy ? "…" : "Start"}
                    </button>
                  )}
                  {canComplete && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(job.id, "complete")}
                      className="btn-primary text-[12.5px] py-2 px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> {busy ? "…" : "Done"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/jobs" className="text-[13px] font-semibold text-[var(--navy)] underline underline-offset-2">
          Open jobs board
        </Link>
        <span className="text-[var(--ink-faint)]">·</span>
        <Link href="/schedule" className="text-[13px] font-semibold text-[var(--navy)] underline underline-offset-2">
          Full schedule
        </Link>
      </div>
    </main>
  );
}
