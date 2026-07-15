"use client";

type AnnotationMeta = {
  id:               string;
  label:            string;
  itemKey:          string;
  type:             string;
  qty:              number;
  unit:             string;
  note:             string;
  length?:          number;
  colour:           string;
  frameData:        string;
  calculatedLength?: number;
  roomName?:        string;
};

export default function SiteAnnotationReport({
  annotations,
  title = "Site survey report",
}: {
  annotations: AnnotationMeta[];
  title?:      string;
}) {
  if (!annotations || annotations.length === 0) return null;

  // Group by room
  const rooms = new Map<string, AnnotationMeta[]>();
  for (const ann of annotations) {
    const room = ann.roomName ?? "General";
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room)!.push(ann);
  }
  const roomList = Array.from(rooms.entries());

  return (
    <div className="space-y-5">
      <div>
        <p className="section-tag mb-1">Site survey</p>
        <h3 className="font-display text-[1.3rem] text-[var(--ink)]">{title}</h3>
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          {annotations.length} location{annotations.length !== 1 ? "s" : ""} captured across {roomList.length} space{roomList.length !== 1 ? "s" : ""}
        </p>
      </div>

      {roomList.map(([roomName, anns]) => (
        <div key={roomName} className="space-y-3">
          {/* Room header */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-[13px] text-[var(--ink)] bg-[var(--app-bg)] border border-[var(--line)] px-3 py-1 rounded-full">
              {roomName}
            </span>
            <span className="text-[12px] text-[var(--ink-faint)]">{anns.length} item{anns.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Room summary table */}
          <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--line)] overflow-hidden mb-2">
            {anns.map((ann, i) => (
              <div key={ann.id} className={`flex items-center gap-2 px-3 py-2 text-[12.5px] ${i < anns.length - 1 ? "border-b border-[var(--line-subtle)]" : ""}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ann.colour }} />
                <span className="font-semibold text-[var(--ink)] flex-1">{ann.label}</span>
                {ann.type === "note" ? (
                  <span className="text-[var(--ink-faint)] text-[10px] uppercase font-bold tracking-wide">Note</span>
                ) : (
                  <span className="text-[var(--ink-soft)]">
                    {ann.qty} {ann.unit}
                    {ann.length != null && ` (~${ann.length}m)`}
                  </span>
                )}
                {ann.note && ann.type !== "note" && <span className="text-[var(--ink-faint)] truncate max-w-[80px]">{ann.note}</span>}
              </div>
            ))}
          </div>

          {/* Photo cards */}
          <div className="grid gap-3">
            {anns.map((ann) => {
              return (
                <div key={ann.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
                  {ann.frameData && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ann.frameData}
                        alt={`${roomName}: ${ann.label}`}
                        className="w-full object-cover"
                        style={{ maxHeight: 200 }}
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5 max-w-[70%]">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ann.colour }} />
                        <span className="text-white text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{ann.label}</span>
                      </div>
                      {/* Room badge on photo */}
                      <div className="absolute top-3 right-3 bg-black/60 rounded-full px-2.5 py-1">
                        <span className="text-white text-[10px] font-bold">{roomName}</span>
                      </div>
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[13.5px] text-[var(--ink)]">{ann.type === "note" ? "Note" : ann.label}</p>
                        {ann.type === "note" ? (
                          <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">{ann.label}</p>
                        ) : (
                          <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                            {ann.qty} {ann.unit}
                            {ann.length != null && ` · ~${ann.length}m`}
                            {ann.calculatedLength != null && ann.qty !== ann.calculatedLength && (
                              <span className="text-[var(--ink-faint)]"> (calc: {ann.calculatedLength}m)</span>
                            )}
                            {ann.note && ` · ${ann.note}`}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        ann.type === "point" ? "bg-amber-50 text-amber-700" :
                        ann.type === "line"  ? "bg-blue-50 text-blue-700" :
                        ann.type === "note"  ? "bg-purple-50 text-purple-700" :
                        "bg-green-50 text-green-700"
                      }`}>
                        {ann.type === "note" ? "note" : ann.type}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
