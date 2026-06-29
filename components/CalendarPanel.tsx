"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { CalendarDays, MapPin, ChevronLeft, ChevronRight, Plus, Bell, Send, X, Trash2 } from "lucide-react";

type ScheduledJob = {
  id: string; client_name: string | null; site_address: string | null;
  total_cost: number | null; job_type: string | null; status: string;
  scheduled_start: string | null; scheduled_end: string | null; estimated_days: number | null;
  follow_up_at?: string | null; quote_expires_at?: string | null; sent_at?: string | null;
};

type ManualEvent = {
  id: string; title: string; notes: string | null;
  start_at: string; end_at: string | null; all_day: boolean;
};

type CalEvent = {
  id: string; date: string; type: "job" | "followup" | "expiry" | "sent" | "manual";
  label: string; sub?: string; jobId?: string; manualId?: string;
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toDateStr(d: Date) { return d.toISOString().slice(0,10); }
function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

export default function CalendarPanel({ jobs: initialJobs, manualEvents: initialManualEvents }: { jobs: ScheduledJob[]; manualEvents?: ManualEvent[] }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [jobs,  setJobs]  = useState(initialJobs);
  const [manualEvents, setManualEvents] = useState(initialManualEvents ?? []);
  const [view,  setView]  = useState<"month"|"list">("month");
  const [selectedEvents, setSelectedEvents] = useState<CalEvent[] | null>(null);
  const [scheduling, setScheduling] = useState<ScheduledJob | null>(null);
  const [schedForm, setSchedForm]   = useState({ start: "", end: "", days: "" });
  const [saving, setSaving] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", start: "", end: "", notes: "" });
  const [savingEvent, setSavingEvent] = useState(false);

  function prevMonth() { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); }

  // Build calendar events from all quote data
  const events: CalEvent[] = [];
  for (const j of jobs) {
    // Scheduled job blocks
    if (j.scheduled_start) {
      const start       = new Date(j.scheduled_start);
      const end         = j.scheduled_end ? new Date(j.scheduled_end) : start;
      const startMs     = start.getTime();
      const endMs       = end.getTime();
      const oneDayMs    = 86400000;
      for (let ms = startMs; ms <= endMs; ms += oneDayMs) {
        const cur = new Date(ms);
        events.push({ id: `job-${j.id}-${toDateStr(cur)}`, date: toDateStr(cur), type: "job", label: j.client_name ?? "Job", sub: j.site_address ?? undefined, jobId: j.id });
      }
    }
    // Follow-up reminders
    if (j.follow_up_at && j.status === "sent") {
      events.push({ id: `fu-${j.id}`, date: j.follow_up_at.slice(0,10), type: "followup", label: `Follow up: ${j.client_name ?? ""}`, sub: "Quote follow-up due", jobId: j.id });
    }
    // Quote expiry
    if (j.quote_expires_at && j.status === "sent") {
      events.push({ id: `exp-${j.id}`, date: j.quote_expires_at.slice(0,10), type: "expiry", label: `Expires: ${j.client_name ?? ""}`, sub: "Quote expires today", jobId: j.id });
    }
    // Sent date
    if (j.sent_at && j.status === "sent") {
      events.push({ id: `sent-${j.id}`, date: j.sent_at.slice(0,10), type: "sent", label: `Sent: ${j.client_name ?? ""}`, sub: "Quote sent", jobId: j.id });
    }
  }

  // Manual entries -- anything that isn't auto-derived from a quote
  // (a site visit, supplier pickup, day off, ad-hoc team coordination).
  for (const m of manualEvents) {
    const start = new Date(m.start_at);
    const end = m.end_at ? new Date(m.end_at) : start;
    for (let ms = start.getTime(); ms <= end.getTime(); ms += 86400000) {
      events.push({ id: `manual-${m.id}-${toDateStr(new Date(ms))}`, date: toDateStr(new Date(ms)), type: "manual", label: m.title, sub: m.notes ?? undefined, manualId: m.id });
    }
  }

  const [dragJob, setDragJob] = useState<{ jobId: string; fromDate: string } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Dragging any day within a multi-day job's block and dropping it on a
  // new day shifts the whole span by that many days - not just the start,
  // so a 3-day job stays a 3-day job, just moved.
  async function rescheduleJob(jobId: string, fromDateStr: string, toDateStr: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !job.scheduled_start) return;
    const deltaMs = new Date(toDateStr).getTime() - new Date(fromDateStr).getTime();
    if (deltaMs === 0) return;
    const newStart = new Date(new Date(job.scheduled_start).getTime() + deltaMs);
    const newEnd = job.scheduled_end ? new Date(new Date(job.scheduled_end).getTime() + deltaMs) : null;

    setRescheduling(true);
    setJobs((prev) => prev.map((j) => j.id === jobId
      ? { ...j, scheduled_start: newStart.toISOString(), scheduled_end: newEnd ? newEnd.toISOString() : null }
      : j));
    const supabase = createClient();
    await supabase.from("quotes").update({
      scheduled_start: newStart.toISOString(),
      scheduled_end: newEnd ? newEnd.toISOString() : null,
    }).eq("id", jobId);
    setRescheduling(false);
  }

  function eventsForDay(day: number): CalEvent[] {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return events.filter((e) => e.date === dateStr);
  }

  const unscheduled = jobs.filter((j) => !j.scheduled_start && (j.status === "accepted" || j.status === "paid"));

  async function saveSchedule() {
    if (!scheduling || !schedForm.start) return;
    setSaving(true);
    const supabase = createClient();
    const patch: Record<string, unknown> = { scheduled_start: new Date(schedForm.start).toISOString() };
    if (schedForm.end)  patch.scheduled_end   = new Date(schedForm.end).toISOString();
    if (schedForm.days) patch.estimated_days  = Number(schedForm.days);
    const { error } = await supabase.from("quotes").update(patch).eq("id", scheduling.id);
    if (!error) {
      setJobs((prev) => prev.map((j) => j.id === scheduling.id ? { ...j, scheduled_start: schedForm.start, scheduled_end: schedForm.end || null, estimated_days: schedForm.days ? Number(schedForm.days) : null } : j));
    }
    setSaving(false);
    setScheduling(null);
  }

  async function createManualEvent() {
    if (!eventForm.title.trim() || !eventForm.start) return;
    setSavingEvent(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingEvent(false); return; }
    const businessId = await getActiveBusinessId(supabase, user.id);

    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        profile_id: businessId,
        title: eventForm.title.trim(),
        notes: eventForm.notes.trim() || null,
        start_at: new Date(eventForm.start).toISOString(),
        end_at: eventForm.end ? new Date(eventForm.end).toISOString() : null,
        all_day: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      setManualEvents((prev) => [...prev, data]);
      setEventForm({ title: "", start: "", end: "", notes: "" });
      setAddingEvent(false);
    }
    setSavingEvent(false);
  }

  async function deleteManualEvent(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("schedule_events").delete().eq("id", id);
    if (!error) {
      setManualEvents((prev) => prev.filter((m) => m.id !== id));
      setSelectedEvents(null);
    }
  }

  const EVENT_STYLE: Record<string, string> = {
    job:      "bg-[var(--amber)]/25 text-[var(--navy)] border-l-2 border-[var(--amber)]",
    followup: "bg-[var(--blue-bg)] text-[var(--blue)] border-l-2 border-[var(--blue)]",
    expiry:   "bg-[var(--red-bg)] text-[var(--red)] border-l-2 border-[var(--red)]",
    sent:     "bg-[var(--green-bg)] text-[var(--green)] border-l-2 border-[var(--green)]",
    manual:   "bg-[var(--steel-1)]/20 text-[var(--ink-soft)] border-l-2 border-[var(--steel-3)]",
  };
  const EVENT_ICON: Record<string, typeof CalendarDays> = {
    job: CalendarDays, followup: Bell, expiry: Bell, sent: Send, manual: CalendarDays,
  };

  const listJobs = [...jobs].sort((a,b) => {
    if (!a.scheduled_start) return 1; if (!b.scheduled_start) return -1;
    return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
  });

  return (
    <div className="page-wrap">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Schedule</h1>
        <div className="flex gap-2">
          <button onClick={() => setAddingEvent(true)} className="inline-flex items-center gap-1.5 bg-[var(--navy)] text-white font-bold text-[12.5px] px-3 py-1.5 rounded-lg">
            <Plus size={14} /> New event
          </button>
          <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border-2 ${view==="month" ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>Month</button>
          <button onClick={() => setView("list")}  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border-2 ${view==="list"  ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>List</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-1 text-[11.5px] font-semibold">
        <span className="flex items-center gap-1.5 text-[var(--navy)]"><span className="w-3 h-3 rounded-sm bg-[var(--amber)]/40 border-l-2 border-[var(--amber)]" />Scheduled job</span>
        <span className="flex items-center gap-1.5 text-[var(--blue)]"><span className="w-3 h-3 rounded-sm bg-[var(--blue-bg)] border-l-2 border-[var(--blue)]" />Follow-up due</span>
        <span className="flex items-center gap-1.5 text-[var(--red)]"><span className="w-3 h-3 rounded-sm bg-[var(--red-bg)] border-l-2 border-[var(--red)]" />Quote expires</span>
        <span className="flex items-center gap-1.5 text-[var(--green)]"><span className="w-3 h-3 rounded-sm bg-[var(--green-bg)] border-l-2 border-[var(--green)]" />Quote sent</span>
        <span className="flex items-center gap-1.5 text-[var(--ink-soft)]"><span className="w-3 h-3 rounded-sm bg-[var(--steel-1)]/20 border-l-2 border-[var(--steel-3)]" />Manual entry</span>
      </div>
      <p className="text-[11.5px] text-[var(--ink-faint)] mb-4">
        Drag a scheduled job onto a different day to reschedule it.
        {rescheduling && <span className="text-[var(--amber-deep)] font-semibold ml-2">Saving...</span>}
      </p>

      {/* Schedule modal */}
      {scheduling && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <p className="font-bold text-[var(--ink)] text-[17px] mb-0.5">Schedule job</p>
            <p className="text-[13px] text-[var(--ink-faint)] mb-4">{scheduling.client_name} - {scheduling.site_address}</p>
            <div className="space-y-3">
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Start date *</span>
                <input type="date" value={schedForm.start} onChange={(e) => setSchedForm(f=>({...f,start:e.target.value}))} className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">End date</span>
                <input type="date" value={schedForm.end} onChange={(e) => setSchedForm(f=>({...f,end:e.target.value}))} className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Estimated days on site</span>
                <input type="number" min={0.5} step={0.5} value={schedForm.days} onChange={(e) => setSchedForm(f=>({...f,days:e.target.value}))} className="app-field" placeholder="e.g. 2" />
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveSchedule} disabled={saving||!schedForm.start} className="btn-primary flex-1">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => setScheduling(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New manual event modal */}
      {addingEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-[var(--ink)] text-[17px]">New event</p>
              <button onClick={() => setAddingEvent(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)]"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Title *</span>
                <input value={eventForm.title} onChange={(e) => setEventForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Supplier pickup, site visit, day off" className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Date *</span>
                <input type="date" value={eventForm.start} onChange={(e) => setEventForm(f => ({...f, start: e.target.value}))} className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">End date (optional, for multi-day)</span>
                <input type="date" value={eventForm.end} onChange={(e) => setEventForm(f => ({...f, end: e.target.value}))} className="app-field" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Notes</span>
                <textarea value={eventForm.notes} onChange={(e) => setEventForm(f => ({...f, notes: e.target.value}))} rows={2} className="app-field text-[13px]" />
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={createManualEvent} disabled={savingEvent || !eventForm.title.trim() || !eventForm.start} className="btn-primary flex-1">{savingEvent ? "Saving..." : "Add to schedule"}</button>
              <button onClick={() => setAddingEvent(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Event detail modal */}
      {selectedEvents && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedEvents(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(--ink)] mb-3">{selectedEvents[0]?.date ? new Date(selectedEvents[0].date + "T00:00:00").toLocaleDateString("en-AU", { weekday:"long", day:"numeric", month:"long" }) : ""}</p>
            <div className="space-y-3">
              {selectedEvents.map((ev) => {
                const Icon = EVENT_ICON[ev.type];
                const content = (
                  <>
                    <Icon size={15} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-[13.5px]">{ev.label}</p>
                      {ev.sub && <p className="text-[12px] opacity-75 mt-0.5">{ev.sub}</p>}
                    </div>
                  </>
                );
                if (ev.type === "manual") {
                  return (
                    <div key={ev.id} className={`flex items-start gap-3 rounded-xl p-3 ${EVENT_STYLE[ev.type]}`}>
                      {content}
                      <button onClick={() => ev.manualId && deleteManualEvent(ev.manualId)} className="ml-auto mt-0.5 shrink-0 opacity-60 hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                }
                return (
                  <a key={ev.id} href={`/electrician/quotes/${ev.jobId}`} className={`flex items-start gap-3 rounded-xl p-3 ${EVENT_STYLE[ev.type]}`}>
                    {content}
                    <ChevronRight size={14} className="ml-auto mt-0.5 opacity-50 shrink-0" />
                  </a>
                );
              })}
            </div>
            <button onClick={() => setSelectedEvents(null)} className="btn-secondary w-full justify-center mt-4">Close</button>
          </div>
        </div>
      )}

      {view === "month" ? (
        <>
          <div className="card mb-4 overflow-hidden p-0">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)]">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><ChevronLeft size={18} /></button>
              <p className="font-bold text-[var(--ink)] text-[15px]">{MONTH_NAMES[month]} {year}</p>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><ChevronRight size={18} /></button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--line)]">
              {DAY_NAMES.map((d) => <div key={d} className="py-2 text-center text-[10.5px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">{d}</div>)}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({length: getFirstDay(year,month)}).map((_,i) => (
                <div key={`e${i}`} className="h-20 sm:h-24 border-r border-b border-[var(--line-subtle)] bg-[var(--app-bg)]" />
              ))}
              {Array.from({length: getDaysInMonth(year,month)}).map((_,i) => {
                const day = i+1;
                const dayEvs = eventsForDay(day);
                const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===day;
                const cellDateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                return (
                  <div key={day} onClick={() => dayEvs.length > 0 && setSelectedEvents(dayEvs)}
                    onDragOver={(e) => { if (dragJob) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); if (dragJob) { rescheduleJob(dragJob.jobId, dragJob.fromDate, cellDateStr); setDragJob(null); } }}
                    className={`h-20 sm:h-24 border-r border-b border-[var(--line-subtle)] p-1 overflow-hidden transition-colors ${dayEvs.length > 0 ? "cursor-pointer hover:bg-[var(--app-bg)]" : ""} ${dragJob ? "hover:bg-[var(--amber-light)]" : ""}`}>
                    <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${isToday ? "bg-[var(--navy)] text-white" : "text-[var(--ink-soft)]"}`}>{day}</span>
                    {dayEvs.slice(0,3).map((ev) => (
                      <div key={ev.id}
                        draggable={ev.type === "job"}
                        onDragStart={(e) => { e.stopPropagation(); if (ev.jobId) setDragJob({ jobId: ev.jobId, fromDate: ev.date }); }}
                        onClick={(e) => ev.type === "job" && e.stopPropagation()}
                        className={`rounded px-1 py-0.5 text-[9.5px] font-bold truncate mb-0.5 ${EVENT_STYLE[ev.type]} ${ev.type === "job" ? "cursor-grab active:cursor-grabbing" : ""}`}>
                        {ev.label}
                      </div>
                    ))}
                    {dayEvs.length > 3 && <p className="text-[9px] text-[var(--ink-faint)] font-semibold">+{dayEvs.length-3}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unscheduled jobs */}
          {unscheduled.length > 0 && (
            <div className="card">
              <p className="section-tag mb-1">Not yet scheduled</p>
              <p className="font-semibold text-[var(--ink)] mb-3">Accepted jobs needing a start date</p>
              <div className="space-y-2">
                {unscheduled.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{j.client_name}</p>
                      <p className="text-[12.5px] text-[var(--ink-faint)]">{j.site_address}</p>
                    </div>
                    <button onClick={() => { setScheduling(j); setSchedForm({start:"",end:"",days:""}); }}
                      className="inline-flex items-center gap-1 text-[12.5px] font-bold bg-[var(--navy)] text-white rounded-xl px-3 py-2 whitespace-nowrap">
                      <Plus size={13} /> Schedule
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {listJobs.length === 0 && (
            <div className="card text-center py-12">
              <CalendarDays size={26} className="mx-auto mb-3 text-[var(--ink-faint)]" />
              <p className="text-[var(--ink-faint)] text-[14px]">No jobs scheduled yet.</p>
            </div>
          )}
          {listJobs.map((j) => (
            <a key={j.id} href={`/electrician/quotes/${j.id}`} className="card block hover:border-[var(--amber)] transition-colors">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-bold text-[15px] text-[var(--ink)]">{j.client_name}</p>
                  {j.site_address && <p className="text-[12.5px] text-[var(--ink-faint)] flex gap-1 items-center mt-0.5"><MapPin size={11}/>{j.site_address}</p>}
                </div>
                <p className="font-display text-[20px] text-[var(--ink)] tabular shrink-0">${(j.total_cost??0).toLocaleString()}</p>
              </div>
              {j.scheduled_start ? (
                <p className="text-[13px] text-[var(--ink-soft)] mt-2 flex gap-1.5 items-center">
                  <CalendarDays size={13} className="text-[var(--amber-deep)]" />
                  {new Date(j.scheduled_start).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"})}
                  {j.scheduled_end && j.scheduled_end!==j.scheduled_start && ` - ${new Date(j.scheduled_end).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"})}`}
                  {j.estimated_days && <span className="text-[var(--ink-faint)] ml-1">({j.estimated_days}d)</span>}
                </p>
              ) : (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[12.5px] text-amber-600 font-semibold">Not scheduled</p>
                  <button onClick={(e) => { e.preventDefault(); setScheduling(j); setSchedForm({start:"",end:"",days:""}); }}
                    className="text-[12px] font-bold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2.5 py-1">
                    Schedule
                  </button>
                </div>
              )}
              {j.follow_up_at && j.status==="sent" && (
                <p className="text-[12px] text-[var(--blue)] font-semibold mt-1.5 flex items-center gap-1">
                  <Bell size={11}/> Follow-up: {new Date(j.follow_up_at).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
