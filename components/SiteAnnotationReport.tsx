"use client";

/**
 * SiteAnnotationReport
 * --------------------
 * Displays the annotated site frames and their labels as a visual
 * site report -- shown in the tradie review (Send step) and on the
 * client-facing quote page /q/[token].
 */

type AnnotationMeta = {
  id:        string;
  label:     string;
  itemKey:   string;
  type:      string;
  qty:       number;
  unit:      string;
  note:      string;
  length?:   number;
  colour:    string;
  frameData: string; // base64 jpeg
};

export default function SiteAnnotationReport({
  annotations,
  title = "Site survey report",
}: {
  annotations: AnnotationMeta[];
  title?:      string;
}) {
  if (!annotations || annotations.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="section-tag mb-1">Site survey</p>
        <h3 className="font-display text-[1.3rem] text-[var(--ink)]">{title}</h3>
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          {annotations.length} annotated location{annotations.length !== 1 ? "s" : ""} captured on site
        </p>
      </div>

      <div className="grid gap-4">
        {annotations.map((ann, i) => (
          <div key={ann.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
            {/* Frame */}
            {ann.frameData && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ann.frameData}
                  alt={`Site annotation: ${ann.label}`}
                  className="w-full object-cover"
                  style={{ maxHeight: 220 }}
                />
                {/* Colour badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ann.colour }} />
                  <span className="text-white text-[11px] font-bold">#{i + 1}</span>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[14.5px] text-[var(--ink)]">{ann.label}</p>
                  <p className="text-[12.5px] text-[var(--ink-soft)] mt-0.5">
                    {ann.qty} {ann.unit}
                    {ann.length != null && ` · ~${ann.length}m estimated`}
                    {ann.note && ` · ${ann.note}`}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  ann.type === "point" ? "bg-amber-50 text-amber-700" :
                  ann.type === "line"  ? "bg-blue-50 text-blue-700" :
                  "bg-green-50 text-green-700"
                }`}>
                  {ann.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
