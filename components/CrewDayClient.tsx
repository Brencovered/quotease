"use client";

import Link from "next/link";
import { UsersRound, MapPin } from "lucide-react";

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

function labelDay(iso: string, index: number) {
  const d = new Date(`${iso}T12:00:00`);
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export default function CrewDayClient({
  members,
  days,
  jobsByDay,
}: {
  members: CrewDayMember[];
  days: string[];
  jobsByDay: Record<string, CrewDayJob[]>;
}) {
  const today = days[0];
  const todayJobs = jobsByDay[today] ?? [];

  return (
    <main className="page-wrap pb-24 sm:pb-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--amber-deep)] mb-1">
            Next 7 days
          </p>
          <h1 className="font-display text-[28px] text-[var(--ink)] leading-none">Crew</h1>
          <p className="text-[13px] text-[var(--ink-faint)] mt-1">
            Who’s on what — assign from the job brief, they get My day + a ping.
          </p>
        </div>
        <Link href="/schedule" className="text-[13px] font-semibold text-[var(--navy)] underline underline-offset-2 shrink-0">
          Crew week calendar
        </Link>
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
          <section className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2.5">
              Today · {todayJobs.length} job{todayJobs.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-2">
              {members.map((m) => {
                const theirs = todayJobs.filter((j) => j.member_ids.includes(m.id));
                return (
                  <div key={m.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-[14px] text-[var(--ink)]">{m.name}</p>
                      <span className="text-[11px] font-bold text-[var(--ink-faint)]">
                        {theirs.length === 0 ? "Free" : `${theirs.length}`}
                      </span>
                    </div>
                    {theirs.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--ink-faint)]">Nothing scheduled</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {theirs.map((j) => (
                          <li key={j.id}>
                            <Link
                              href={`/jobs/${j.id}`}
                              className="block rounded-xl bg-[var(--app-bg)] px-2.5 py-2 hover:bg-[var(--line-subtle)]"
                            >
                              <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                                #{j.job_number} · {j.client_name || j.title || "Job"}
                              </p>
                              {j.site_address && (
                                <p className="text-[11.5px] text-[var(--ink-faint)] truncate flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} /> {j.site_address}
                                </p>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-faint)] mb-2.5">
              Rest of the week
            </p>
            <div className="space-y-3">
              {days.slice(1).map((d, i) => {
                const dayJobs = jobsByDay[d] ?? [];
                return (
                  <div key={d} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
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
                            <Link
                              key={j.id}
                              href={`/jobs/${j.id}`}
                              className="flex items-start justify-between gap-2 rounded-xl bg-[var(--app-bg)] px-2.5 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[var(--ink)] truncate">
                                  #{j.job_number} · {j.client_name || "Job"}
                                </p>
                                <p className="text-[11.5px] text-[var(--ink-faint)] truncate">
                                  {names || "Unassigned"}
                                </p>
                              </div>
                            </Link>
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
      </div>
    </main>
  );
}
