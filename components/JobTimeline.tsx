import { CheckCircle2, FileEdit, Clock, Paperclip, ShieldCheck, Wallet, Hammer } from "lucide-react";

type Variation = { id: string; title: string; status: string; total_cost: number; created_at: string };
type Actual = { id: string; actual_hours: number; actual_materials_cost: number; notes: string | null; recorded_at: string };
type Attachment = { id: string; file_name: string; created_at: string };
type Cert = { id: string; cert_type: string; created_at: string };
type Payment = { id: string; amount: number; recorded_at: string };

type Event = { date: string; icon: typeof CheckCircle2; color: string; text: string };

export default function JobTimeline({
  acceptedAt,
  completedAt,
  paidAt,
  variations,
  actuals,
  attachments,
  certs,
  payments,
}: {
  acceptedAt: string | null;
  completedAt: string | null;
  paidAt: string | null;
  variations: Variation[];
  actuals: Actual[];
  attachments: Attachment[];
  certs: Cert[];
  payments: Payment[];
}) {
  const events: Event[] = [];

  if (acceptedAt) events.push({ date: acceptedAt, icon: CheckCircle2, color: "#16A34A", text: "Quote accepted — job won" });

  for (const v of variations) {
    events.push({
      date: v.created_at,
      icon: FileEdit,
      color: v.status === "approved" ? "#16A34A" : "#E89E00",
      text: `Variation ${v.status === "approved" ? "approved" : "added"}: ${v.title} ($${v.total_cost.toLocaleString()})`,
    });
  }

  for (const a of actuals) {
    events.push({
      date: a.recorded_at,
      icon: Hammer,
      color: "#3B82F6",
      text: `Logged ${a.actual_hours} hrs${a.actual_materials_cost ? `, $${a.actual_materials_cost.toLocaleString()} materials` : ""}${a.notes ? ` — ${a.notes}` : ""}`,
    });
  }

  for (const f of attachments) {
    events.push({ date: f.created_at, icon: Paperclip, color: "#8993A1", text: `File uploaded: ${f.file_name}` });
  }

  for (const c of certs) {
    events.push({ date: c.created_at, icon: ShieldCheck, color: "#16A34A", text: `Certificate issued: ${c.cert_type}` });
  }

  for (const p of payments) {
    events.push({ date: p.recorded_at, icon: Wallet, color: "#E89E00", text: `Payment received: $${p.amount.toLocaleString()}` });
  }

  if (completedAt) events.push({ date: completedAt, icon: CheckCircle2, color: "#16A34A", text: "Job marked complete" });
  if (paidAt) events.push({ date: paidAt, icon: Wallet, color: "#16A34A", text: "Paid in full" });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (events.length === 0) return null;

  return (
    <div className="card">
      <p className="section-tag mb-3">Timeline</p>
      <div className="space-y-0">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${e.color}1a` }}>
                  <Icon size={13} style={{ color: e.color }} />
                </div>
                {i < events.length - 1 && <div className="w-px flex-1 bg-[var(--line)] my-1" />}
              </div>
              <div className="pb-4">
                <p className="text-[13.5px] text-[var(--ink)]">{e.text}</p>
                <p className="text-[11.5px] text-[var(--ink-faint)] flex items-center gap-1 mt-0.5">
                  <Clock size={10} />
                  {new Date(e.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} at{" "}
                  {new Date(e.date).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
