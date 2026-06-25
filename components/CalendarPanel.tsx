"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, Clock, MapPin, ChevronLeft, ChevronRight, Plus } from "lucide-react";

type ScheduledJob = {
  id: string;
  client_name: string | null;
  site_address: string | null;
  total_cost: number | null;
  job_type: string | null;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_days: number | null;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarPanel({ jobs: initialJobs }: { jobs: ScheduledJob[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [scheduling, setScheduling] = useState<ScheduledJob | null>(null);
  const [schedForm, setSchedForm] = useState({ start: "", end: "", days: "" });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"month" | "list">("month");

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Map jobs to calendar days
  function jobsForDay(day: number): ScheduledJob[] {
    const date = new Date(year, month, day);
    return jobs.filter((j) => {
      if (!j.scheduled_start) return false;
      const start = new Date(j.scheduled_start);
      const end = j.scheduled_end ? new Date(j.scheduled_end) : start;
      return date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             date <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });
  }

  const unscheduled = jobs.filter((j) => !j.scheduled_start);

  async function saveSchedule() {
    if (!scheduling || !schedForm.start) return;
    setSaving(true);
    const supabase = createClient();
    const patch: Record<string, unknown> = { scheduled_start: new Date(schedForm.start).toISOString() };
    if (schedForm.end) patch.scheduled_end = new Date(schedForm.end).toISOString();
    if (schedForm.days) patch.estimated_days = Number(schedForm.days);
    const { error } = await supabase.from("quotes").update(patch).eq("id", scheduling.id);
    if (!error) {
      setJobs((prev) => prev.map((j) => j.id === scheduling.id ? { ...j, ...patch, scheduled_start: schedForm.start, scheduled_end: schedForm.end || null } : j));
    }
    setSaving(false);
    setScheduling(null);
  }

  const listJobs = [...jobs].sort((a, b) => {
    if (!a.scheduled_start) return 1;
    if (!b.scheduled_start) return -1;
    return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
  });

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-[var(--ink)]">Schedule</h1>
        <div className="flex gap-2">
          <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 ${view === "month" ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>Month</button>
          <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 ${view === "list" ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>List</button>
        </div>
      </div>

      {/* Schedule modal */}
      {scheduling && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <p className="font-semibold text-[var(--ink)] mb-1">Schedule job</p>
            <p className="text-[13px] text-[var(--ink-faint)] mb-4">{scheduling.client_name} — {scheduling.site_address}</p>
            <div className="space-y-3">
              <label className="block"><span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Start date *</span>
                <input type="date" value={schedForm.start} onChange={(e) => setSchedForm(f => ({ ...f, start: e.target.value }))} className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">End date</span>
                <input type="date" value={schedForm.end} onChange={(e) => setSchedForm(f => ({ ...f, end: e.target.value }))} className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-medium text-[var(--ink-soft)] mb-1.5">Estimated days on site</span>
                <input type="number" min={0.5} step={0.5} value={schedForm.days} onChange={(e) => setSchedForm(f => ({ ...f, days: e.target.value }))} className="app-field" placeholder="e.g. 2" />
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveSchedule} disabled={saving || !schedForm.start} className="flex-1 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
                {saving ? "Saving..." : "Save schedule"}
              </button>
              <button onClick={() => setScheduling(null)} className="flex-1 border-2 border-[var(--line)] rounded-lg py-2.5 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Job detail modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[var(--ink)] text-[16px] mb-1">{selectedJob.client_name}</p>
            {selectedJob.site_address && <p className="text-[13px] text-[var(--ink-faint)] flex gap-1 items-center mb-2"><MapPin size={12} />{selectedJob.site_address}</p>}
            <p className="text-[13px] text-[var(--ink-soft)]">Job value: <strong>${(selectedJob.total_cost ?? 0).toLocaleString()}</strong></p>
            {selectedJob.scheduled_start && (
              <p className="text-[13px] text-[var(--ink-soft)] mt-1 flex gap-1 items-center">
                <CalendarDays size={12} />
                {new Date(selectedJob.scheduled_start).toLocaleDateString("en-AU")}
                {selectedJob.scheduled_end && selectedJob.scheduled_end !== selectedJob.scheduled_start && ` — ${new Date(selectedJob.scheduled_end).toLocaleDateString("en-AU")}`}
              </p>
            )}
            {selectedJob.estimated_days && <p className="text-[13px] text-[var(--ink-soft)] mt-1 flex gap-1 items-center"><Clock size={12} />{selectedJob.estimated_days} day{selectedJob.estimated_days !== 1 ? "s" : ""} on site</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setSchedForm({ start: selectedJob.scheduled_start?.slice(0,10) ?? "", end: selectedJob.scheduled_end?.slice(0,10) ?? "", days: selectedJob.estimated_days?.toString() ?? "" }); setScheduling(selectedJob); setSelectedJob(null); }} className="flex-1 border-2 border-[var(--line)] rounded-lg py-2 text-sm font-semibold">Reschedule</button>
              <button onClick={() => setSelectedJob(null)} className="flex-1 bg-[var(--navy)] text-white rounded-lg py-2 text-sm font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      {view === "month" ? (
        <>
          {/* Calendar header */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--app-bg)]"><ChevronLeft size={18} /></button>
              <p className="font-semibold text-[var(--ink)]">{MONTH_NAMES[month]} {year}</p>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-[var(--app-bg)]"><ChevronRight size={18} /></button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--line)]">
              {DAY_NAMES.map((d) => <div key={d} className="py-2 text-center text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">{d}</div>)}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="h-16 sm:h-20 border-r border-b border-[var(--line)] bg-[var(--app-bg)]" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayJobs = jobsForDay(day);
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                return (
                  <div key={day} className="h-16 sm:h-20 border-r border-b border-[var(--line)] p-1 overflow-hidden">
                    <p className={`text-[12px] font-semibold mb-0.5 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-[var(--navy)] text-white" : "text-[var(--ink-soft)]"}`}>{day}</p>
                    {dayJobs.slice(0, 2).map((j) => (
                      <button key={j.id} onClick={() => setSelectedJob(j)} className="w-full text-left bg-[var(--amber)]/20 text-[var(--navy)] rounded px-1 py-0.5 text-[10px] font-semibold truncate block mb-0.5 hover:bg-[var(--amber)]/40">
                        {j.client_name}
                      </button>
                    ))}
                    {dayJobs.length > 2 && <p className="text-[10px] text-[var(--ink-faint)]">+{dayJobs.length - 2} more</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unscheduled jobs */}
          {unscheduled.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
              <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Not yet scheduled</p>
              <p className="font-semibold text-[var(--ink)] mb-3">Accepted jobs needing a start date</p>
              <div className="space-y-2">
                {unscheduled.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{j.client_name}</p>
                      <p className="text-[12.5px] text-[var(--ink-faint)]">{j.site_address}</p>
                    </div>
                    <button
                      onClick={() => { setScheduling(j); setSchedForm({ start: "", end: "", days: "" }); }}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold bg-[var(--navy)] text-white rounded-lg px-3 py-1.5 whitespace-nowrap"
                    >
                      <Plus size={13} /> Schedule
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {listJobs.length === 0 && (
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-10 text-center">
              <CalendarDays size={26} className="mx-auto mb-3 text-[var(--ink-faint)]" />
              <p className="text-[var(--ink-faint)] text-sm">No jobs scheduled yet.</p>
            </div>
          )}
          {listJobs.map((j) => (
            <div key={j.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-semibold text-[var(--ink)] text-[15px]">{j.client_name}</p>
                  {j.site_address && <p className="text-[12.5px] text-[var(--ink-faint)] flex gap-1 items-center mt-0.5"><MapPin size={11} />{j.site_address}</p>}
                </div>
                <p className="font-display text-lg text-[var(--ink)] shrink-0">${(j.total_cost ?? 0).toLocaleString()}</p>
              </div>
              {j.scheduled_start ? (
                <p className="text-[13px] text-[var(--ink-soft)] mt-2 flex gap-1.5 items-center">
                  <CalendarDays size={13} className="text-[var(--amber-deep)]" />
                  {new Date(j.scheduled_start).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                  {j.scheduled_end && j.scheduled_end !== j.scheduled_start && ` — ${new Date(j.scheduled_end).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}`}
                  {j.estimated_days && <span className="ml-2 text-[var(--ink-faint)]">({j.estimated_days}d)</span>}
                </p>
              ) : (
                <p className="text-[12.5px] text-amber-600 mt-2 font-semibold">Not yet scheduled</p>
              )}
              <button
                onClick={() => { setScheduling(j); setSchedForm({ start: j.scheduled_start?.slice(0,10) ?? "", end: j.scheduled_end?.slice(0,10) ?? "", days: j.estimated_days?.toString() ?? "" }); }}
                className="mt-3 text-[13px] font-semibold border-2 border-[var(--line)] rounded-lg px-3 py-1.5"
              >
                {j.scheduled_start ? "Reschedule" : "Schedule"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
