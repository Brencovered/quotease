"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { CalendarDays, MapPin, ChevronLeft, ChevronRight, Plus, Bell, Send, Trash2, Pencil } from "lucide-react";

type ScheduledJob = {
  id: string; client_name: string | null; site_address: string | null;
  total_cost: number | null; job_type: string | null; status: string;
  scheduled_start: string | null; scheduled_end: string | null; estimated_days: number | null;
  follow_up_at?: string | null; quote_expires_at?: string | null; sent_at?: string | null;
  jobs?: { job_number: number | null } | { job_number: number | null }[] | null;
};

/** The embedded `jobs` relation comes back as an object or a single-item
 * array depending on how PostgREST resolves the to-one FK - normalize
 * either shape to just the number, or null if this quote has no job yet
 * (not accepted, so getOrCreateJobForQuote hasn't run for it). */
function jobNumberOf(j: ScheduledJob): number | null {
  const rel = j.jobs;
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.job_number ?? null;
}

type ManualEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
};

type CalEvent = {
  id: string; date: string; type: "job" | "followup" | "expiry" | "sent" | "general" | "meeting" | "site_visit" | "delivery" | "reminder" | "holiday";
  label: string; sub?: string; jobId: string; manualEvent?: ManualEvent;
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toDateStr(d: Date) { return d.toISOString().slice(0,10); }
function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

export default function CalendarPanel({ jobs: initialJobs }: { jobs: ScheduledJob[] }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [jobs,  setJobs]  = useState(initialJobs);
  const [view,  setView]  = useState<"month"|"list">("month");
  const [selectedEvents, setSelectedEvents] = useState<CalEvent[] | null>(null);
  const [scheduling, setScheduling] = useState<ScheduledJob | null>(null);
  const [schedForm, setSchedForm]   = useState({ start: "", end: "", days: "" });
  const [saving, setSaving] = useState(false);

  const [manualEvents, setManualEvents] = useState<ManualEvent[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingManualEvent, setEditingManualEvent] = useState<ManualEvent | null>(null);
  const [manualForm, setManualForm] = useState({ title: "", description: "", event_date: "", event_type: "general", start_time: "", end_time: "", is_all_day: false });

  const supabase = createClient();

  const fetchManualEvents = useCallback(async () => {
    const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(year, month)}`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const businessId = await getActiveBusinessId(supabase, user.id);
    const { data } = await supabase.from("calendar_events")
      .select("id, title, description, event_date, event_type, start_time, end_time, is_all_day")
      .eq("profile_id", businessId)
      .gte("event_date", startOfMonth)
      .lte("event_date", endOfMonth)
      .order("event_date");
    setManualEvents(data ?? []);
  }, [year, month, supabase]);

  useEffect(() => { fetchManualEvents(); }, [fetchManualEvents]);

  function prevMonth() { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); }

  const events: CalEvent[] = [];
  for (const j of jobs) {
    if (j.scheduled_start) {
      const start = new Date(j.scheduled_start);
      const end = j.scheduled_end ? new Date(j.scheduled_end) : start;
      const startMs = start.getTime(), endMs = end.getTime(), oneDayMs = 86400000;
      for (let ms = startMs; ms <= endMs; ms += oneDayMs) {
        const cur = new Date(ms);
        const jobNumber = jobNumberOf(j);
        const jobLabel = jobNumber
          ? (j.client_name ? `Job #${jobNumber} - ${j.client_name}` : `Job #${jobNumber}`)
          : (j.client_name ?? "Job");
        events.push({ id: `job-${j.id}-${toDateStr(cur)}`, date: toDateStr(cur), type: "job", label: jobLabel, sub: j.site_address ?? undefined, jobId: j.id });
      }
    }
    if (j.follow_up_at && j.status === "sent") events.push({ id: `fu-${j.id}`, date: j.follow_up_at.slice(0,10), type: "followup", label: `Follow up: ${j.client_name ?? ""}`, sub: "Quote follow-up due", jobId: j.id });
    if (j.quote_expires_at && j.status === "sent") events.push({ id: `exp-${j.id}`, date: j.quote_expires_at.slice(0,10), type: "expiry", label: `Expires: ${j.client_name ?? ""}`, sub: "Quote expires today", jobId: j.id });
    if (j.sent_at && j.status === "sent") events.push({ id: `sent-${j.id}`, date: j.sent_at.slice(0,10), type: "sent", label: `Sent: ${j.client_name ?? ""}`, sub: "Quote sent", jobId: j.id });
  }

  for (const me of manualEvents) {
    events.push({
      id: `manual-${me.id}`, date: me.event_date, type: me.event_type as CalEvent["type"],
      label: me.title, sub: me.description ?? undefined, jobId: "", manualEvent: me,
    });
  }

  const [dragJob, setDragJob] = useState<{ jobId: string; fromDate: string } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

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
    await supabase.from("quotes").update({
      scheduled_start: newStart.toISOString(),
      scheduled_end: newEnd ? newEnd.toISOString() : null,
    }).eq("id", jobId);
    setRescheduling(false);
  }

  async function saveManualEvent() {
    if (!manualForm.title.trim() || !manualForm.event_date) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const businessId = await getActiveBusinessId(supabase, user.id);
    const payload = {
      profile_id: businessId,
      title: manualForm.title.trim(),
      description: manualForm.description.trim() || null,
      event_date: manualForm.event_date,
      event_type: manualForm.event_type,
      start_time: manualForm.is_all_day ? null : manualForm.start_time || null,
      end_time: manualForm.is_all_day ? null : manualForm.end_time || null,
      is_all_day: manualForm.is_all_day,
    };
    if (editingManualEvent) {
      await supabase.from("calendar_events").update(payload).eq("id", editingManualEvent.id);
      setManualEvents((prev) => prev.map((e) => e.id === editingManualEvent.id ? { ...e, ...payload, start_time: payload.start_time as string | null, end_time: payload.end_time as string | null } : e));
    } else {
      const { data } = await supabase.from("calendar_events").insert(payload).select().single();
      if (data) setManualEvents((prev) => [...prev, data as ManualEvent]);
    }
    setShowManualModal(false);
    setEditingManualEvent(null);
    setManualForm({ title: "", description: "", event_date: "", event_type: "general", start_time: "", end_time: "", is_all_day: false });
  }

  async function deleteManualEvent(event: ManualEvent) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("calendar_events").delete().eq("id", event.id);
    setManualEvents((prev) => prev.filter((e) => e.id !== event.id));
    setSelectedEvents(null);
  }

  function openEditManual(event: ManualEvent) {
    setEditingManualEvent(event);
    setManualForm({
      title: event.title,
      description: event.description ?? "",
      event_date: event.event_date,
      event_type: event.event_type,
      start_time: event.start_time ?? "",
      end_time: event.end_time ?? "",
      is_all_day: event.is_all_day,
    });
    setShowManualModal(true);
  }

  function eventsForDay(day: number): CalEvent[] {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return events.filter((e) => e.date === dateStr);
  }

  const unscheduled = jobs.filter((j) => !j.scheduled_start && (j.status === "accepted" || j.status === "paid"));

  async function saveSchedule() {
    if (!scheduling || !schedForm.start) return;
    setSaving(true);
    const patch: Record<string, unknown> = { scheduled_start: new Date(schedForm.start).toISOString() };
    if (schedForm.end) patch.scheduled_end = new Date(schedForm.end).toISOString();
    if (schedForm.days) patch.estimated_days = Number(schedForm.days);
    const { error } = await supabase.from("quotes").update(patch).eq("id", scheduling.id);
    if (!error) setJobs((prev) => prev.map((j) => j.id === scheduling.id ? { ...j, scheduled_start: schedForm.start, scheduled_end: schedForm.end || null, estimated_days: schedForm.days ? Number(schedForm.days) : null } : j));
    setSaving(false);
    setScheduling(null);
  }

  const EVENT_STYLE: Record<string, string> = {
    job:      "bg-[var(--amber)]/25 text-[var(--navy)] border-l-2 border-[var(--amber)]",
    followup: "bg-[var(--blue-bg)] text-[var(--blue)] border-l-2 border-[var(--blue)]",
    expiry:   "bg-[var(--red-bg)] text-[var(--red)] border-l-2 border-[var(--red)]",
    sent:     "bg-[var(--green-bg)] text-[var(--green)] border-l-2 border-[var(--green)]",
    general:  "bg-gray-100 text-gray-600 border-l-2 border-gray-400",
    meeting:  "bg-purple-100 text-purple-700 border-l-2 border-purple-500",
    site_visit: "bg-[var(--amber-light)] text-[var(--amber-deep)] border-l-2 border-[var(--amber)]",
    delivery: "bg-[var(--blue-bg)] text-[var(--blue)] border-l-2 border-[var(--blue)]",
    reminder: "bg-[var(--green-bg)] text-[var(--green)] border-l-2 border-[var(--green)]",
    holiday:  "bg-[var(--red-bg)] text-[var(--red)] border-l-2 border-[var(--red)]",
  };
  const EVENT_ICON: Record<string, typeof CalendarDays> = {
    job: CalendarDays, followup: Bell, expiry: Bell, sent: Send,
    general: CalendarDays, meeting: CalendarDays, site_visit: CalendarDays, delivery: CalendarDays, reminder: Bell, holiday: CalendarDays,
  };

  const listJobs = [...jobs].sort((a,b) => {
    if (!a.scheduled_start) return 1; if (!b.scheduled_start) return -1;
    return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
  });

  const listManualEvents = [...manualEvents].sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div className="page-wrap">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[28px] text-[var(--ink)]">Schedule</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowManualModal(true)} className="inline-flex items-center gap-1.5 bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[12.5px] px-3 py-2 rounded-xl hover:bg-[var(--amber-deep)] transition-colors">
            <Plus size={14} strokeWidth={3} /> Add event
          </button>
          <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border-2 ${view==="month" ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>Month</button>
          <button onClick={() => setView("list")}  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border-2 ${view==="list"  ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>List</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-1 text-[11.5px] font-semibold">
        <span className="flex items-center gap-1.5 text-[var(--navy)]"><span className="w-3 h-3 rounded-sm bg-[var(--amber)]/40 border-l-2 border-[var(--amber)]" />Job</span>
        <span className="flex items-center gap-1.5 text-[var(--blue)]"><span className="w-3 h-3 rounded-sm bg-[var(--blue-bg)] border-l-2 border-[var(--blue)]" />Follow-up</span>
        <span className="flex items-center gap-1.5 text-[var(--red)]"><span className="w-3 h-3 rounded-sm bg-[var(--red-bg)] border-l-2 border-[var(--red)]" />Expires</span>
        <span className="flex items-center gap-1.5 text-[var(--green)]"><span className="w-3 h-3 rounded-sm bg-[var(--green-bg)] border-l-2 border-[var(--green)]" />Sent</span>
        <span className="flex items-center gap-1.5 text-gray-500"><span className="w-3 h-3 rounded-sm bg-gray-100 border-l-2 border-gray-400" />General</span>
        <span className="flex items-center gap-1.5 text-purple-600"><span className="w-3 h-3 rounded-sm bg-purple-100 border-l-2 border-purple-500" />Meeting</span>
      </div>
      <p className="text-[11.5px] text-[var(--ink-faint)] mb-4">
        Drag a scheduled job onto a different day to reschedule it.
        {rescheduling && <span className="text-[var(--amber-deep)] font-semibold ml-2">Saving...</span>}
      </p>

      {/* Manual event modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <p className="font-bold text-[var(--ink)] text-[17px] mb-4">{editingManualEvent ? "Edit event" : "Add event"}</p>
            <div className="space-y-3">
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Title *</span>
                <input type="text" value={manualForm.title} onChange={(e) => setManualForm(f=>({...f,title:e.target.value}))} className="app-field" placeholder="Event title" />
              </label>
              <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Description</span>
                <textarea value={manualForm.description} onChange={(e) => setManualForm(f=>({...f,description:e.target.value}))} className="app-field" rows={2} placeholder="Optional description" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Date *</span>
                  <input type="date" value={manualForm.event_date} onChange={(e) => setManualForm(f=>({...f,event_date:e.target.value}))} className="app-field" />
                </label>
                <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Type</span>
                  <select value={manualForm.event_type} onChange={(e) => setManualForm(f=>({...f,event_type:e.target.value}))} className="app-field">
                    <option value="general">General</option>
                    <option value="meeting">Meeting</option>
                    <option value="site_visit">Site visit</option>
                    <option value="delivery">Delivery</option>
                    <option value="reminder">Reminder</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={manualForm.is_all_day} onChange={(e) => setManualForm(f=>({...f,is_all_day:e.target.checked}))} className="rounded" />
                <span className="text-[12.5px] font-semibold text-[var(--ink-soft)]">All day</span>
              </label>
              {!manualForm.is_all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Start</span>
                    <input type="time" value={manualForm.start_time} onChange={(e) => setManualForm(f=>({...f,start_time:e.target.value}))} className="app-field" />
                  </label>
                  <label className="block"><span className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">End</span>
                    <input type="time" value={manualForm.end_time} onChange={(e) => setManualForm(f=>({...f,end_time:e.target.value}))} className="app-field" />
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveManualEvent} disabled={!manualForm.title.trim() || !manualForm.event_date} className="btn-primary flex-1">Save</button>
              <button onClick={() => { setShowManualModal(false); setEditingManualEvent(null); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Event detail modal */}
      {selectedEvents && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedEvents(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[var(--ink)] mb-3">{selectedEvents[0]?.date ? new Date(selectedEvents[0].date + "T00:00:00").toLocaleDateString("en-AU", { weekday:"long", day:"numeric", month:"long" }) : ""}</p>
            <div className="space-y-3">
              {selectedEvents.map((ev) => {
                const Icon = EVENT_ICON[ev.type] ?? CalendarDays;
                return (
                  <div key={ev.id}>
                    {ev.jobId ? (
                      <a href={`/quotes/${ev.jobId}`} className={`flex items-start gap-3 rounded-xl p-3 ${EVENT_STYLE[ev.type] ?? EVENT_STYLE.general}`}>
                        <Icon size={15} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-[13.5px]">{ev.label}</p>
                          {ev.sub && <p className="text-[12px] opacity-75 mt-0.5">{ev.sub}</p>}
                        </div>
                        <ChevronRight size={14} className="ml-auto mt-0.5 opacity-50 shrink-0" />
                      </a>
                    ) : (
                      <div className={`flex items-start gap-3 rounded-xl p-3 ${EVENT_STYLE[ev.type] ?? EVENT_STYLE.general}`}>
                        <Icon size={15} className="mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-[13.5px]">{ev.label}</p>
                          {ev.sub && <p className="text-[12px] opacity-75 mt-0.5">{ev.sub}</p>}
                          {ev.manualEvent && (
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => openEditManual(ev.manualEvent!)} className="text-[11px] font-bold text-[var(--navy)] flex items-center gap-0.5">
                                <Pencil size={10} /> Edit
                              </button>
                              <button onClick={() => deleteManualEvent(ev.manualEvent!)} className="text-[11px] font-bold text-[var(--red)] flex items-center gap-0.5">
                                <Trash2 size={10} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)]">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><ChevronLeft size={18} /></button>
              <p className="font-bold text-[var(--ink)] text-[15px]">{MONTH_NAMES[month]} {year}</p>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-[var(--line)]">
              {DAY_NAMES.map((d) => <div key={d} className="py-2 text-center text-[10.5px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">{d}</div>)}
            </div>
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
                        onDragStart={(e) => { e.stopPropagation(); setDragJob({ jobId: ev.jobId, fromDate: ev.date }); }}
                        onClick={(e) => ev.type === "job" && e.stopPropagation()}
                        className={`rounded px-1 py-0.5 text-[9.5px] font-bold truncate mb-0.5 ${EVENT_STYLE[ev.type] ?? EVENT_STYLE.general} ${ev.type === "job" ? "cursor-grab active:cursor-grabbing" : ""}`}>
                        {ev.label}
                      </div>
                    ))}
                    {dayEvs.length > 3 && <p className="text-[9px] text-[var(--ink-faint)] font-semibold">+{dayEvs.length-3}</p>}
                  </div>
                );
              })}
            </div>
          </div>

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
          {listJobs.length === 0 && listManualEvents.length === 0 && (
            <div className="card text-center py-12">
              <CalendarDays size={26} className="mx-auto mb-3 text-[var(--ink-faint)]" />
              <p className="text-[var(--ink-faint)] text-[14px]">No events yet.</p>
            </div>
          )}
          {listJobs.map((j) => (
            <a key={j.id} href={`/quotes/${j.id}`} className="card block hover:border-[var(--amber)] transition-colors">
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
                    className="text-[12px] font-bold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-2.5 py-1">Schedule</button>
                </div>
              )}
              {j.follow_up_at && j.status==="sent" && (
                <p className="text-[12px] text-[var(--blue)] font-semibold mt-1.5 flex items-center gap-1">
                  <Bell size={11}/> Follow-up: {new Date(j.follow_up_at).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}
                </p>
              )}
            </a>
          ))}
          {listManualEvents.length > 0 && (
            <div className="card">
              <p className="section-tag mb-3">Manual events</p>
              <div className="space-y-2">
                {listManualEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{ev.title}</p>
                      {ev.description && <p className="text-[12.5px] text-[var(--ink-faint)]">{ev.description}</p>}
                      <p className="text-[12px] text-[var(--ink-faint)] mt-0.5">
                        {new Date(ev.event_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                        {!ev.is_all_day && ev.start_time && ` at ${ev.start_time}`}
                        {ev.end_time && ` - ${ev.end_time}`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditManual(ev)} className="p-1.5 rounded-lg hover:bg-[var(--app-bg)]"><Pencil size={14} className="text-[var(--ink-faint)]" /></button>
                      <button onClick={() => deleteManualEvent(ev)} className="p-1.5 rounded-lg hover:bg-[var(--red-bg)]"><Trash2 size={14} className="text-[var(--ink-faint)]" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
