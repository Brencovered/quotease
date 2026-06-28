"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Trash2, Ruler, Square, MapPin, Check, AlertCircle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export type ShapeType = "pin" | "line" | "area";

export interface ShapePoint { x: number; y: number; }  // 0-100 percent of natural image size

export interface PlanShape {
  id: string;
  type: ShapeType;
  points: ShapePoint[];          // pin: 1 pt, line: 2+ pts, area: 3+ pts
  label: string;
  material_key: string | null;   // item_key from material_items
  material_label: string;
  unit_cost: number;             // supplier cost
  margin_pct: number;
  qty: number;                   // auto-calculated from measurement, editable
  unit: string;                  // "ea" | "m" | "sqm"
  note: string;
}

export interface CalibrationLine {
  p1: ShapePoint;
  p2: ShapePoint;
  real_metres: number;          // what this pixel distance equals in the real world
}

export type PlanAnnotation = PlanShape;  // legacy alias for DB compat

// ── Material type passed in from parent ──────────────────────────────────────
export interface MaterialItem {
  item_key: string;
  label: string;
  unit_cost: number;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function dist(a: ShapePoint, b: ShapePoint) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function polylineLength(pts: ShapePoint[]) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

function polygonArea(pts: ShapePoint[]) {
  // Shoelace formula, result in percent-squared units
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function pxToMetres(pxUnits: number, cal: CalibrationLine | null): number | null {
  if (!cal) return null;
  const calPx = dist(cal.p1, cal.p2);
  if (calPx === 0) return null;
  return (pxUnits / calPx) * cal.real_metres;
}

function pxSqToSqm(pxSq: number, cal: CalibrationLine | null): number | null {
  if (!cal) return null;
  const calPx = dist(cal.p1, cal.p2);
  if (calPx === 0) return null;
  const scale = cal.real_metres / calPx;  // m per pct-unit
  return pxSq * scale * scale;
}

function measuredQty(shape: PlanShape, cal: CalibrationLine | null): { qty: number; unit: string } | null {
  if (shape.type === "pin") return { qty: 1, unit: "ea" };
  if (shape.type === "line" && shape.points.length >= 2) {
    const px = polylineLength(shape.points);
    const m = pxToMetres(px, cal);
    if (m === null) return null;
    return { qty: Math.round(m * 100) / 100, unit: "m" };
  }
  if (shape.type === "area" && shape.points.length >= 3) {
    const pxSq = polygonArea(shape.points);
    const sqm = pxSqToSqm(pxSq, cal);
    if (sqm === null) return null;
    return { qty: Math.round(sqm * 100) / 100, unit: "sqm" };
  }
  return null;
}

function shapeCost(shape: PlanShape): number {
  return Math.round(shape.qty * shape.unit_cost * (1 + shape.margin_pct / 100));
}

// ── Component ─────────────────────────────────────────────────────────────────

const SHAPE_TOOLS: { type: ShapeType; label: string; icon: React.ReactNode; hint: string }[] = [
  { type: "pin",  label: "Pin",  icon: <MapPin  size={14} />, hint: "Click to place. Counts items (GPOs, lights, etc)." },
  { type: "line", label: "Line", icon: <Ruler   size={14} />, hint: "Click points to trace runs. Double-click to finish." },
  { type: "area", label: "Area", icon: <Square  size={14} />, hint: "Click corners. Double-click last point to close." },
];

const SHAPE_COLOURS: Record<ShapeType, string> = {
  pin:  "#ffb400",
  line: "#3b82f6",
  area: "#22c55e",
};

export default function PlanMarkup({
  imageUrl,
  shapes,
  calibration,
  onShapesChange,
  onCalibrationChange,
  materials,
  marginPct,
  onCostChange,
}: {
  imageUrl: string;
  shapes: PlanShape[];
  calibration: CalibrationLine | null;
  onShapesChange: (next: PlanShape[]) => void;
  onCalibrationChange: (cal: CalibrationLine | null) => void;
  materials: MaterialItem[];
  marginPct: number;
  onCostChange?: (totalCost: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [activeTool, setActiveTool]       = useState<ShapeType | "calibrate" | null>(null);
  const [draftPoints, setDraftPoints]     = useState<ShapePoint[]>([]);
  const [calDraftP1,  setCalDraftP1]      = useState<ShapePoint | null>(null);
  const [openShapeId, setOpenShapeId]     = useState<string | null>(null);
  const [imgNatural,  setImgNatural]      = useState<{ w: number; h: number } | null>(null);

  // Get point in natural-image-% coords, invariant to display zoom
  const getPoint = useCallback((e: React.MouseEvent): ShapePoint | null => {
    const img = imgRef.current;
    if (!img || !imgNatural) return null;
    const rect = img.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    // Scale to natural image coords (0-100%)
    const x = (displayX / rect.width)  * 100;
    const y = (displayY / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, [imgNatural]);

  // Notify parent of total cost whenever shapes change
  useEffect(() => {
    const total = shapes.reduce((s, sh) => s + shapeCost(sh), 0);
    onCostChange?.(total);
  }, [shapes, onCostChange]);

  function handleCanvasClick(e: React.MouseEvent) {
    if (!activeTool) return;
    e.stopPropagation();
    const pt = getPoint(e);
    if (!pt) return;

    if (activeTool === "calibrate") {
      if (!calDraftP1) {
        setCalDraftP1(pt);
      } else {
        // Have both points -- ask for real-world length
        const raw = prompt("What is the real-world length of this line in metres?\n(e.g. 0.9 for a standard door width)");
        const m = parseFloat(raw ?? "");
        if (!isNaN(m) && m > 0) {
          onCalibrationChange({ p1: calDraftP1, p2: pt, real_metres: m });
        }
        setCalDraftP1(null);
        setActiveTool(null);
      }
      return;
    }

    if (activeTool === "pin") {
      // Immediately create shape
      const id = `shape_${Date.now()}`;
      const newShape: PlanShape = {
        id, type: "pin", points: [pt],
        label: `Item ${shapes.filter(s => s.type === "pin").length + 1}`,
        material_key: null, material_label: "", unit_cost: 0,
        margin_pct: marginPct, qty: 1, unit: "ea", note: "",
      };
      onShapesChange([...shapes, newShape]);
      setOpenShapeId(id);
      return;
    }

    // Line or area -- accumulate points
    setDraftPoints((p) => [...p, pt]);
  }

  function handleCanvasDblClick(e: React.MouseEvent) {
    e.preventDefault();
    if (activeTool !== "line" && activeTool !== "area") return;
    if (draftPoints.length < (activeTool === "line" ? 2 : 3)) return;
    finishShape();
  }

  function finishShape() {
    if (!activeTool || activeTool === "calibrate" || activeTool === "pin") return;
    const id = `shape_${Date.now()}`;
    const newShape: PlanShape = {
      id,
      type: activeTool,
      points: draftPoints,
      label: activeTool === "line" ? `Run ${shapes.filter(s => s.type === "line").length + 1}` : `Area ${shapes.filter(s => s.type === "area").length + 1}`,
      material_key: null, material_label: "", unit_cost: 0,
      margin_pct: marginPct, qty: 0, unit: activeTool === "line" ? "m" : "sqm", note: "",
    };
    // Auto-fill measured qty if calibrated
    const m = measuredQty(newShape, calibration);
    if (m) { newShape.qty = m.qty; newShape.unit = m.unit; }
    onShapesChange([...shapes, newShape]);
    setOpenShapeId(id);
    setDraftPoints([]);
  }

  function updateShape(id: string, patch: Partial<PlanShape>) {
    onShapesChange(shapes.map((s) => s.id === id ? { ...s, ...patch } : s));
  }

  function removeShape(id: string) {
    onShapesChange(shapes.filter((s) => s.id !== id));
    if (openShapeId === id) setOpenShapeId(null);
  }

  function pickMaterial(shapeId: string, mat: MaterialItem) {
    updateShape(shapeId, {
      material_key:   mat.item_key,
      material_label: mat.label,
      unit_cost:      mat.unit_cost,
    });
  }

  const totalCost = shapes.reduce((s, sh) => s + shapeCost(sh), 0);

  // Convert % coords back to display px for SVG overlay
  function toDisplay(pt: ShapePoint) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    return { x: (pt.x / 100) * img.offsetWidth, y: (pt.y / 100) * img.offsetHeight };
  }

  return (
    <div className="space-y-3" onClick={() => setOpenShapeId(null)}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Calibrate */}
        <button
          onClick={(e) => { e.stopPropagation(); setActiveTool(activeTool === "calibrate" ? null : "calibrate"); setDraftPoints([]); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold border-2 transition-colors ${
            activeTool === "calibrate" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-[var(--line)] text-[var(--ink-soft)]"
          }`}>
          <Ruler size={13} /> Calibrate {calibration ? <Check size={11} className="text-[var(--green)]" /> : <AlertCircle size={11} className="text-amber-500" />}
        </button>

        {/* Shape tools */}
        {SHAPE_TOOLS.map((t) => (
          <button key={t.type}
            onClick={(e) => { e.stopPropagation(); setActiveTool(activeTool === t.type ? null : t.type); setDraftPoints([]); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold border-2 transition-colors ${
              activeTool === t.type
                ? `border-current text-white`
                : "border-[var(--line)] text-[var(--ink-soft)]"
            }`}
            style={activeTool === t.type ? { background: SHAPE_COLOURS[t.type], borderColor: SHAPE_COLOURS[t.type] } : {}}>
            {t.icon} {t.label}
          </button>
        ))}

        {draftPoints.length >= 2 && (activeTool === "line" || activeTool === "area") && (
          <button onClick={(e) => { e.stopPropagation(); finishShape(); }}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold bg-[var(--navy)] text-white border-2 border-[var(--navy)]">
            Done ({draftPoints.length} pts)
          </button>
        )}
      </div>

      {/* Hint */}
      {activeTool && (
        <p className="text-[12px] text-[var(--ink-faint)]">
          {activeTool === "calibrate"
            ? calDraftP1 ? "Now click the end of the reference line, then enter its real length." : "Click one end of a known reference line (e.g. a door width = 0.9m)."
            : SHAPE_TOOLS.find(t => t.type === activeTool)?.hint}
        </p>
      )}

      {!calibration && activeTool && activeTool !== "calibrate" && activeTool !== "pin" && (
        <p className="text-[12px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Calibrate first for accurate measurements. Pins work without calibration.
        </p>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--app-bg)] ${activeTool ? "cursor-crosshair" : "cursor-default"}`}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDblClick}
        style={{ touchAction: "manipulation" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Plan"
          className="w-full h-auto block pointer-events-none select-none"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />

        {/* SVG overlay for lines/areas + draft */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
          {/* Calibration line */}
          {calibration && (() => {
            const p1 = toDisplay(calibration.p1);
            const p2 = toDisplay(calibration.p2);
            return (
              <g>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="purple" strokeWidth="2" strokeDasharray="4 3" opacity=".7" />
                <circle cx={p1.x} cy={p1.y} r="4" fill="purple" opacity=".7" />
                <circle cx={p2.x} cy={p2.y} r="4" fill="purple" opacity=".7" />
              </g>
            );
          })()}

          {/* Drawn shapes */}
          {shapes.map((s) => {
            const col = SHAPE_COLOURS[s.type];
            if (s.type === "line" && s.points.length >= 2) {
              const pts = s.points.map(toDisplay);
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              return (
                <g key={s.id}>
                  <path d={d} stroke={col} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={col} />)}
                </g>
              );
            }
            if (s.type === "area" && s.points.length >= 3) {
              const pts = s.points.map(toDisplay);
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
              return (
                <g key={s.id}>
                  <path d={d} stroke={col} strokeWidth="2" fill={col} fillOpacity=".15" strokeLinejoin="round" />
                </g>
              );
            }
            return null;
          })}

          {/* Draft in progress */}
          {draftPoints.length > 0 && (() => {
            const col = activeTool === "line" ? SHAPE_COLOURS.line : SHAPE_COLOURS.area;
            const pts = draftPoints.map(toDisplay);
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
            return (
              <g>
                <path d={d} stroke={col} strokeWidth="2" fill="none" strokeDasharray="5 4" strokeLinecap="round" />
                {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={col} />)}
              </g>
            );
          })()}

          {/* Cal draft point */}
          {calDraftP1 && (() => {
            const p = toDisplay(calDraftP1);
            return <circle cx={p.x} cy={p.y} r="5" fill="purple" opacity=".8" />;
          })()}
        </svg>

        {/* Pin markers */}
        {shapes.filter(s => s.type === "pin").map((s) => {
          const img = imgRef.current;
          if (!img) return null;
          const pt = s.points[0];
          return (
            <div
              key={s.id}
              className="absolute"
              style={{ left: `${pt.x}%`, top: `${pt.y}%`, transform: "translate(-50%, -50%)" }}
              onClick={(e) => { e.stopPropagation(); setOpenShapeId(openShapeId === s.id ? null : s.id); }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white cursor-pointer text-[11px] font-bold"
                style={{ background: SHAPE_COLOURS.pin, color: "#0a1722" }}>
                {shapes.filter(x => x.type === "pin").indexOf(s) + 1}
              </div>
            </div>
          );
        })}

        {/* Area/line click targets (centroid labels) */}
        {shapes.filter(s => s.type !== "pin").map((s) => {
          if (s.points.length === 0) return null;
          // Centroid
          const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
          const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
          const col = SHAPE_COLOURS[s.type];
          const m = measuredQty(s, calibration);
          return (
            <div key={s.id} className="absolute" style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%,-50%)" }}
              onClick={(e) => { e.stopPropagation(); setOpenShapeId(openShapeId === s.id ? null : s.id); }}>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border whitespace-nowrap shadow-sm"
                style={{ background: col, color: "white", borderColor: col }}>
                {m ? `${m.qty}${m.unit}` : s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shape inspector panel */}
      {openShapeId && (() => {
        const s = shapes.find(x => x.id === openShapeId);
        if (!s) return null;
        const m = measuredQty(s, calibration);
        const cost = shapeCost(s);
        return (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: SHAPE_COLOURS[s.type] }} />
                <span className="text-[13px] font-bold text-[var(--ink)] capitalize">{s.type}</span>
                {m && <span className="text-[12px] text-[var(--ink-faint)] font-semibold">{m.qty} {m.unit}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => removeShape(s.id)} className="text-[var(--red)] p-1"><Trash2 size={14} /></button>
                <button onClick={() => setOpenShapeId(null)} className="text-[var(--ink-faint)] p-1"><X size={14} /></button>
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Label</label>
              <input value={s.label} onChange={(e) => updateShape(s.id, { label: e.target.value })}
                className="app-field text-[13px]" placeholder="e.g. Kitchen cable run" />
            </div>

            {/* Material picker */}
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Material</label>
              {materials.length > 0 ? (
                <select
                  value={s.material_key ?? ""}
                  onChange={(e) => {
                    if (e.target.value === "") { updateShape(s.id, { material_key: null, material_label: "", unit_cost: 0 }); return; }
                    const mat = materials.find(m => m.item_key === e.target.value);
                    if (mat) pickMaterial(s.id, mat);
                  }}
                  className="app-field text-[13px]">
                  <option value="">-- Select from your materials --</option>
                  {materials.map(m => (
                    <option key={m.item_key} value={m.item_key}>{m.label} (${m.unit_cost}/{s.unit})</option>
                  ))}
                  <option value="__custom__">+ Custom item</option>
                </select>
              ) : (
                <input value={s.material_label}
                  onChange={(e) => updateShape(s.id, { material_label: e.target.value })}
                  className="app-field text-[13px]" placeholder="Material name (e.g. 20mm conduit)" />
              )}
              {s.material_key === "__custom__" && (
                <input className="app-field text-[13px] mt-1.5" placeholder="Custom material name"
                  value={s.material_label} onChange={(e) => updateShape(s.id, { material_label: e.target.value })} />
              )}
            </div>

            {/* Qty + unit cost */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Qty ({s.unit})</label>
                <input type="number" min={0} step={0.1} value={s.qty}
                  onChange={(e) => updateShape(s.id, { qty: parseFloat(e.target.value) || 0 })}
                  className="app-field text-[13px] text-right" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Unit cost ($)</label>
                <input type="number" min={0} step={0.01} value={s.unit_cost}
                  onChange={(e) => updateShape(s.id, { unit_cost: parseFloat(e.target.value) || 0 })}
                  className="app-field text-[13px] text-right" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Line total</label>
                <div className="app-field text-[13px] font-bold text-right bg-[var(--app-bg)]">
                  ${cost.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Note (optional)</label>
              <input value={s.note} onChange={(e) => updateShape(s.id, { note: e.target.value })}
                className="app-field text-[13px]" placeholder="Any additional notes" />
            </div>
          </div>
        );
      })()}

      {/* Shape list summary */}
      {shapes.length > 0 && (
        <div className="border border-[var(--line)] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 bg-[var(--app-bg)] border-b border-[var(--line)] px-3 py-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)] col-span-2">Shape</span>
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)] text-right">Qty</span>
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)] text-right pl-4">Cost</span>
          </div>
          {shapes.map((s) => {
            const m = measuredQty(s, calibration);
            return (
              <div key={s.id}
                className={`grid grid-cols-[auto_1fr_auto_auto] gap-0 px-3 py-2.5 border-b border-[var(--line-subtle)] cursor-pointer hover:bg-[var(--app-bg)] ${openShapeId === s.id ? "bg-[var(--amber-light)]" : ""}`}
                onClick={(e) => { e.stopPropagation(); setOpenShapeId(openShapeId === s.id ? null : s.id); }}>
                <div className="w-2.5 h-2.5 rounded-full mr-2 mt-1 shrink-0" style={{ background: SHAPE_COLOURS[s.type] }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{s.label || s.material_label || "Unnamed"}</p>
                  {s.material_label && <p className="text-[11px] text-[var(--ink-faint)] truncate">{s.material_label}</p>}
                </div>
                <span className="text-[12px] text-[var(--ink-soft)] tabular text-right self-center pl-3">
                  {m ? `${m.qty}${m.unit}` : `${s.qty}${s.unit}`}
                </span>
                <span className="text-[13px] font-bold text-[var(--ink)] tabular text-right self-center pl-4">
                  ${shapeCost(s).toLocaleString()}
                </span>
              </div>
            );
          })}
          <div className="px-3 py-2.5 flex justify-between items-center bg-[var(--navy)]">
            <span className="text-[12px] font-bold text-[var(--steel-2)]">Total from drawings</span>
            <span className="font-display text-[18px] text-[var(--amber)] tabular">${totalCost.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
