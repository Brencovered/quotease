"use client";

import { useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Phone, Navigation, Camera, Play, Pause, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { suggestHoursFromStart } from "@/lib/jobTime";
import JobDoneSheet, { type DoneNextStep } from "@/components/JobDoneSheet";

function mapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Thumb-first strip for running a job. Sticky above mobile nav.
 * Owner money actions only appear after Done (via JobDoneSheet) — not here.
 */
export default function JobFieldStrip({
  jobId,
  businessId,
  status,
  workStartedAt,
  clientPhone,
  siteAddress,
  totalCost,
  amountPaid,
  canManageMoney,
}: {
  jobId: string;
  businessId: string;
  status: string;
  workStartedAt: string | null;
  clientPhone: string | null;
  siteAddress: string | null;
  totalCost: number;
  amountPaid: number;
  canManageMoney: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);

  const owing = Math.max(totalCost - amountPaid, 0);
  const canStart = status === "scheduled" || status === "on_hold";
  const canPause = status === "in_progress";
  const canDone = status === "in_progress" || status === "awaiting_sign_off" || status === "on_hold";
  const done = status === "complete" || status === "invoiced" || status === "partially_paid";

  function stop(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function postStatus(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/jobs/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn’t update");
      return data as {
        timesheetLogged?: { hours: number };
        pausedOther?: { job_number: number } | null;
      };
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const data = await postStatus({ status: "in_progress" });
    if (data.pausedOther?.job_number) {
      setToast(`Started — paused job #${data.pausedOther.job_number}`);
    } else {
      setToast("Started — time is running");
    }
    setTimeout(() => setToast(null), 3500);
    router.refresh();
  }

  async function pause() {
    await postStatus({ status: "on_hold" });
    setToast("Paused — clock kept for when you resume");
    setTimeout(() => setToast(null), 3000);
    router.refresh();
  }

  async function confirmDone(opts: {
    hours: number | null;
    next: DoneNextStep;
    cashAmount?: number;
  }) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        completeJob: true,
        hours: opts.hours,
        skipTimesheet: opts.hours == null,
      };
      if (opts.next === "sign_off") {
        body.completeJob = false;
        body.status = "awaiting_sign_off";
        body.hours = opts.hours;
        body.skipTimesheet = opts.hours == null;
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

      setDoneOpen(false);
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
      setToast(err instanceof Error ? err.message : "Couldn’t finish");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File) {
    setBusy(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_") || `photo-${Date.now()}.jpg`;
      const path = `${businessId}/${jobId}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("job-files").upload(path, file);
      if (uploadErr) throw new Error(uploadErr.message);
      const { error } = await supabase.from("job_attachments").insert({
        job_id: jobId,
        profile_id: businessId,
        file_name: file.name || safeName,
        storage_path: path,
        file_type: file.type || "image/jpeg",
        file_size: file.size,
      });
      if (error) throw new Error(error.message);
      setToast("Photo saved");
      setTimeout(() => setToast(null), 2500);
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Upload failed");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-[4.25rem] sm:bottom-4 z-30 px-3 pointer-events-none">
        <div className="page-wrap-narrow !py-0 pointer-events-auto mx-auto">
        {toast && (
          <p className="mb-2 text-center text-[12.5px] font-semibold rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] shadow-sm">
            {toast}
          </p>
        )}
        <div className="flex items-stretch rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_24px_rgba(15,23,42,0.12)] overflow-hidden">
          {clientPhone ? (
            <a
              href={`tel:${clientPhone.replace(/\s/g, "")}`}
              onClick={stop}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[var(--ink-soft)] active:bg-[var(--app-bg)]"
            >
              <Phone size={16} />
              <span className="text-[10px] font-bold">Call</span>
            </a>
          ) : null}
          {siteAddress ? (
            <a
              href={mapsUrl(siteAddress)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[var(--ink-soft)] border-l border-[var(--line-subtle)] active:bg-[var(--app-bg)]"
            >
              <Navigation size={16} />
              <span className="text-[10px] font-bold">Nav</span>
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[var(--ink-soft)] border-l border-[var(--line-subtle)] disabled:opacity-50"
          >
            <Camera size={16} />
            <span className="text-[10px] font-bold">Photo</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onPhoto(f);
            }}
          />
          {canStart && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void start()}
              className="flex-[1.3] flex flex-col items-center justify-center gap-0.5 py-2.5 bg-[var(--amber)] text-[var(--navy)] border-l border-[var(--line-subtle)] disabled:opacity-50"
            >
              <Play size={16} strokeWidth={2.5} />
              <span className="text-[10px] font-bold">Start</span>
            </button>
          )}
          {canPause && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void pause()}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[var(--ink-soft)] border-l border-[var(--line-subtle)] disabled:opacity-50"
            >
              <Pause size={16} />
              <span className="text-[10px] font-bold">Pause</span>
            </button>
          )}
          {canDone && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDoneOpen(true)}
              className="flex-[1.3] flex flex-col items-center justify-center gap-0.5 py-2.5 bg-[var(--amber)] text-[var(--navy)] border-l border-[var(--line-subtle)] disabled:opacity-50"
            >
              <CheckCircle2 size={16} strokeWidth={2.5} />
              <span className="text-[10px] font-bold">Done</span>
            </button>
          )}
        </div>
        </div>
      </div>

      <JobDoneSheet
        open={doneOpen}
        suggestedHours={suggestHoursFromStart(workStartedAt)}
        owing={owing}
        canManageMoney={canManageMoney}
        busy={busy}
        onCancel={() => setDoneOpen(false)}
        onConfirm={(opts) => void confirmDone(opts)}
      />
    </>
  );
}
