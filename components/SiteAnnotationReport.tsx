"use client";

import { aggregateLiveMarkupPins } from "@/lib/aggregateLiveMarkup";

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

type AggregatedRow = {
  key: string;
  label: string;
  itemKey: string;
  type: string;
  qty: number;
  unit: string;
  colour: string;
  pinCount: number;
  notes: string[];
  frames: string[];
  /** Freeform note text when type === note */
  noteBody?: string;
};

function aggregateRoomAnns(anns: AnnotationMeta[]): AggregatedRow[] {
  const notes: AggregatedRow[] = [];
  const priced = anns.filter((a) => a.type !== "note" && a.itemKey !== "__note__");
  const noteAnns = anns.filter((a) => a.type === "note" || a.itemKey === "__note__");

  for (const n of noteAnns) {
    notes.push({
      key: n.id,
      label: "Note",
      itemKey: "__note__",
      type: "note",
      qty: 0,
      unit: "",
      colour: n.colour,
      pinCount: 1,
      notes: [],
      frames: n.frameData ? [n.frameData] : [],
      noteBody: n.label || n.note,
    });
  }

  const lines = aggregateLiveMarkupPins(priced);
  const byKey = new Map(lines.map((l) => [`${l.itemKey}::${l.unit}`, l]));

  const rows: AggregatedRow[] = [];
  for (const [mapKey, line] of byKey) {
    const matches = priced.filter((a) => a.itemKey === line.itemKey && (a.unit || "each") === line.unit);
    const colour = matches[0]?.colour ?? "#ffb400";
    const type = matches[0]?.type ?? "point";
    rows.push({
      key: mapKey,
      label: line.label,
      itemKey: line.itemKey,
      type,
      qty: line.quantity,
      unit: line.unit,
      colour,
      pinCount: line.pinCount,
      notes: matches.map((m) => m.note).filter(Boolean),
      frames: matches.map((m) => m.frameData).filter(Boolean),
    });
  }

  return [...rows, ...notes];
}

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
  const totalPins = annotations.filter((a) => a.type !== "note" && a.itemKey !== "__note__").length;
  const totalLines = roomList.reduce((sum, [, anns]) => sum + aggregateRoomAnns(anns).filter((r) => r.type !== "note").length, 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="section-tag mb-1">Site survey</p>
        <h3 className="font-display text-[1.3rem] text-[var(--ink)]">{title}</h3>
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          {totalPins} pin{totalPins !== 1 ? "s" : ""} → {totalLines} item{totalLines !== 1 ? "s" : ""} across {roomList.length} space{roomList.length !== 1 ? "s" : ""}
        </p>
      </div>

      {roomList.map(([roomName, anns]) => {
        const rows = aggregateRoomAnns(anns);
        return (
          <div key={roomName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[13px] text-[var(--ink)] bg-[var(--app-bg)] border border-[var(--line)] px-3 py-1 rounded-full">
                {roomName}
              </span>
              <span className="text-[12px] text-[var(--ink-faint)]">
                {rows.filter((r) => r.type !== "note").length} item{rows.filter((r) => r.type !== "note").length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--line)] overflow-hidden">
              {rows.map((row, i) => (
                <div
                  key={row.key}
                  className={`flex items-center gap-2 px-3 py-2.5 text-[12.5px] ${i < rows.length - 1 ? "border-b border-[var(--line-subtle)]" : ""}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.colour }} />
                  <span className="font-semibold text-[var(--ink)] flex-1">
                    {row.type === "note" ? "Note" : row.label}
                  </span>
                  {row.type === "note" ? (
                    <span className="text-[var(--ink-faint)] text-[10px] uppercase font-bold tracking-wide">Note</span>
                  ) : (
                    <span className="text-[var(--ink-soft)] font-semibold">
                      {row.qty} {row.unit}
                      {row.pinCount > 1 && (
                        <span className="text-[var(--ink-faint)] font-normal"> · {row.pinCount} pins</span>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* One card per item type (not per pin) */}
            <div className="grid gap-3">
              {rows.map((row) => (
                <div key={`card-${row.key}`} className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
                  {row.frames.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto p-2 bg-[var(--app-bg)]">
                      {row.frames.slice(0, 6).map((src, fi) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={fi}
                          src={src}
                          alt=""
                          className="h-16 w-20 object-cover rounded-lg shrink-0"
                        />
                      ))}
                      {row.frames.length > 6 && (
                        <div className="h-16 w-20 rounded-lg bg-[var(--line)] flex items-center justify-center text-[11px] font-bold text-[var(--ink-faint)] shrink-0">
                          +{row.frames.length - 6}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[13.5px] text-[var(--ink)]">
                        {row.type === "note" ? "Note" : row.label}
                      </p>
                      {row.type === "note" ? (
                        <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">{row.noteBody}</p>
                      ) : (
                        <p className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                          {row.qty} {row.unit}
                          {row.pinCount > 1 ? ` · ${row.pinCount} pins` : ""}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                      row.type === "point" ? "bg-amber-50 text-amber-700" :
                      row.type === "line"  ? "bg-blue-50 text-blue-700" :
                      row.type === "note"  ? "bg-purple-50 text-purple-700" :
                      "bg-green-50 text-green-700"
                    }`}>
                      {row.type === "note" ? "note" : row.pinCount > 1 ? `${row.pinCount}×` : row.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
