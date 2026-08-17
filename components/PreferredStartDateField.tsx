"use client";

/** Shared preferred-start control used by every quote builder so accepted
 *  quotes can carry a date onto the job board via quotes.scheduled_date. */
export default function PreferredStartDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="card">
      <p className="section-tag mb-1">Preferred start date</p>
      <p className="text-[13px] text-[var(--ink-faint)] mb-3">
        Optional. Carries onto the job board when the client accepts so you can schedule from there.
      </p>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="app-field"
      />
    </div>
  );
}
