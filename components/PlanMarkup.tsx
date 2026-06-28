"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Trash2, Ruler, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShapeType = "pin" | "line" | "area" | "freehand";

export interface ShapePoint { x: number; y: number; }

export interface PlanShape {
  id: string;
  type: ShapeType;
  lineStyle: string;       // e.g. "cable", "conduit", "pipe", "drain", "wall", "generic"
  points: ShapePoint[];
  label: string;
  material_key: string | null;
  material_label: string;
  unit_cost: number;
  margin_pct: number;
  qty: number;
  unit: string;
  note: string;
}

export interface CalibrationLine {
  p1: ShapePoint;
  p2: ShapePoint;
  real_metres: number;
}

export type PlanAnnotation = PlanShape;

export interface MaterialItem {
  item_key: string;
  label: string;
  unit_cost: number;
}

// ── Trade-specific tool definitions ───────────────────────────────────────────

interface ToolDef {
  id: string;
  label: string;
  type: ShapeType;
  lineStyle: string;
  color: string;
  dash: string;        // SVG stroke-dasharray
  unit: string;
  hint: string;
}

const TRADE_TOOLS: Record<string, ToolDef[]> = {
  electrician: [
    { id: "cable",    label: "Cable run",     type: "freehand", lineStyle: "cable",    color: "#ef4444", dash: "",        unit: "m",   hint: "Draw cable runs freehand" },
    { id: "conduit",  label: "Conduit",       type: "freehand", lineStyle: "conduit",  color: "#f97316", dash: "6 3",     unit: "m",   hint: "Draw conduit runs freehand" },
    { id: "circuit",  label: "Circuit line",  type: "line",     lineStyle: "circuit",  color: "#8b5cf6", dash: "8 4",     unit: "m",   hint: "Click points for a circuit" },
    { id: "gpo",      label: "GPO / outlet",  type: "pin",      lineStyle: "gpo",      color: "#ffb400", dash: "",        unit: "ea",  hint: "Click to place a GPO" },
    { id: "light",    label: "Light point",   type: "pin",      lineStyle: "light",    color: "#fbbf24", dash: "",        unit: "ea",  hint: "Click to place a light" },
    { id: "board",    label: "Board / panel", type: "pin",      lineStyle: "board",    color: "#0a1722", dash: "",        unit: "ea",  hint: "Click to mark a switchboard" },
    { id: "area_el",  label: "Zone / area",   type: "area",     lineStyle: "area",     color: "#3b82f6", dash: "",        unit: "sqm", hint: "Click corners to mark a zone" },
  ],
  plumber: [
    { id: "hotpipe",  label: "Hot water pipe", type: "freehand", lineStyle: "hotpipe",  color: "#ef4444", dash: "",        unit: "m",   hint: "Draw hot water pipe runs" },
    { id: "coldpipe", label: "Cold water pipe", type: "freehand", lineStyle: "coldpipe", color: "#3b82f6", dash: "",        unit: "m",   hint: "Draw cold water pipe runs" },
    { id: "drain",    label: "Drain / sewer",  type: "freehand", lineStyle: "drain",    color: "#78716c", dash: "8 4",     unit: "m",   hint: "Draw drain lines" },
    { id: "gas",      label: "Gas line",       type: "freehand", lineStyle: "gas",      color: "#f59e0b", dash: "10 5",    unit: "m",   hint: "Draw gas pipe runs" },
    { id: "fixture",  label: "Fixture",        type: "pin",      lineStyle: "fixture",  color: "#22c55e", dash: "",        unit: "ea",  hint: "Click to place a fixture" },
    { id: "area_pl",  label: "Wet area",       type: "area",     lineStyle: "area",     color: "#06b6d4", dash: "",        unit: "sqm", hint: "Mark a wet area" },
  ],
  carpenter: [
    { id: "wall",     label: "New wall",       type: "line",     lineStyle: "wall",     color: "#0a1722", dash: "",        unit: "m",   hint: "Click points for a wall run" },
    { id: "timber",   label: "Timber run",     type: "freehand", lineStyle: "timber",   color: "#92400e", dash: "",        unit: "m",   hint: "Draw timber/framing runs" },
    { id: "deck",     label: "Decking area",   type: "area",     lineStyle: "area",     color: "#78350f", dash: "",        unit: "sqm", hint: "Mark a decking area" },
    { id: "door",     label: "Door / opening", type: "pin",      lineStyle: "door",     color: "#d97706", dash: "",        unit: "ea",  hint: "Mark a door or opening" },
    { id: "skirting", label: "Skirting run",   type: "freehand", lineStyle: "skirting", color: "#b45309", dash: "4 2",     unit: "m",   hint: "Draw skirting board runs" },
  ],
  roofer: [
    { id: "ridge",    label: "Ridge / hip",    type: "line",     lineStyle: "ridge",    color: "#7c3aed", dash: "",        unit: "m",   hint: "Click points for ridge line" },
    { id: "gutter",   label: "Gutter run",     type: "freehand", lineStyle: "gutter",   color: "#0891b2", dash: "",        unit: "m",   hint: "Draw gutter runs" },
    { id: "valley",   label: "Valley",         type: "freehand", lineStyle: "valley",   color: "#0e7490", dash: "6 3",     unit: "m",   hint: "Draw valley lines" },
    { id: "roofarea", label: "Roof area",      type: "area",     lineStyle: "area",     color: "#6d28d9", dash: "",        unit: "sqm", hint: "Mark a roof section" },
    { id: "skylight", label: "Skylight",       type: "pin",      lineStyle: "skylight", color: "#fbbf24", dash: "",        unit: "ea",  hint: "Mark skylight positions" },
  ],
  default: [
    { id: "run",      label: "Run / line",     type: "freehand", lineStyle: "generic",  color: "#3b82f6", dash: "",        unit: "m",   hint: "Draw a line run freehand" },
    { id: "measure",  label: "Measure",        type: "line",     lineStyle: "generic",  color: "#8b5cf6", dash: "6 3",     unit: "m",   hint: "Click points to measure" },
    { id: "item",     label: "Item / pin",     type: "pin",      lineStyle: "generic",  color: "#ffb400", dash: "",        unit: "ea",  hint: "Click to place an item" },
    { id: "zone",     label: "Zone / area",    type: "area",     lineStyle: "area",     color: "#22c55e", dash: "",        unit: "sqm", hint: "Click corners to mark an area" },
  ],
};

function getTools(trade?: string): ToolDef[] {
  if (!trade) return TRADE_TOOLS.default;
  const key = trade.toLowerCase().replace(/\s+/g, "_");
  if (key.includes("electric"))  return TRADE_TOOLS.electrician;
  if (key.includes("plumb"))     return TRADE_TOOLS.plumber;
  if (key.includes("carpent"))   return TRADE_TOOLS.carpenter;
  if (key.includes("roof"))      return TRADE_TOOLS.roofer;
  return TRADE_TOOLS.default;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

function dist(a: ShapePoint, b: ShapePoint) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function polylineLength(pts: ShapePoint[]) {
  let t = 0; for (let i = 1; i < pts.length; i++) t += dist(pts[i-1], pts[i]); return t;
}
function polygonArea(pts: ShapePoint[]) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const j=(i+1)%pts.length; a += pts[i].x*pts[j].y - pts[j].x*pts[i].y; } return Math.abs(a)/2;
}
function pxToMetres(px: number, cal: CalibrationLine | null) {
  if (!cal) return null;
  const cpx = dist(cal.p1, cal.p2); if (!cpx) return null;
  return (px / cpx) * cal.real_metres;
}
function pxSqToSqm(pxSq: number, cal: CalibrationLine | null) {
  if (!cal) return null;
  const cpx = dist(cal.p1, cal.p2); if (!cpx) return null;
  const s = cal.real_metres / cpx; return pxSq * s * s;
}
function measuredQty(shape: PlanShape, cal: CalibrationLine | null): { qty: number; unit: string } | null {
  if (shape.type === "pin") return { qty: 1, unit: "ea" };
  if ((shape.type === "line" || shape.type === "freehand") && shape.points.length >= 2) {
    const m = pxToMetres(polylineLength(shape.points), cal);
    if (m === null) return null;
    return { qty: Math.round(m * 100) / 100, unit: "m" };
  }
  if (shape.type === "area" && shape.points.length >= 3) {
    const m = pxSqToSqm(polygonArea(shape.points), cal);
    if (m === null) return null;
    return { qty: Math.round(m * 100) / 100, unit: "sqm" };
  }
  return null;
}
function shapeCost(s: PlanShape) { return Math.round(s.qty * s.unit_cost * (1 + s.margin_pct/100)); }

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlanMarkup({
  imageUrl, shapes, calibration, onShapesChange, onCalibrationChange,
  materials, marginPct, trade, onCostChange,
}: {
  imageUrl: string;
  shapes: PlanShape[];
  calibration: CalibrationLine | null;
  onShapesChange: (next: PlanShape[]) => void;
  onCalibrationChange: (cal: CalibrationLine | null) => void;
  materials: MaterialItem[];
  marginPct: number;
  trade?: string;
  onCostChange?: (total: number) => void;
}) {
  const imgRef      = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState<{w:number;h:number}|null>(null);
  const [activeTool, setActiveTool] = useState<string | "calibrate" | null>(null);
  const [draftPts,   setDraftPts]   = useState<ShapePoint[]>([]);
  const [calDraft,   setCalDraft]   = useState<ShapePoint|null>(null);
  const [isDrawing,  setIsDrawing]  = useState(false);   // freehand mouse-down
  const [openId,     setOpenId]     = useState<string|null>(null);
  const [listOpen,   setListOpen]   = useState(true);

  const tools = getTools(trade);

  const getPoint = useCallback((e: React.MouseEvent | React.Touch): ShapePoint | null => {
    const img = imgRef.current; if (!img) return null;
    const rect = img.getBoundingClientRect();
    const cx = "clientX" in e ? e.clientX : e.clientX;
    const cy = "clientY" in e ? e.clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(100, ((cx - rect.left) / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((cy - rect.top)  / rect.height) * 100)),
    };
  }, []);

  useEffect(() => {
    onCostChange?.(shapes.reduce((s, sh) => s + shapeCost(sh), 0));
  }, [shapes, onCostChange]);

  const activeDef = tools.find(t => t.id === activeTool) ?? null;

  // ── Click handler ──────────────────────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent) {
    if (!activeTool) return;
    e.stopPropagation();
    const pt = getPoint(e); if (!pt) return;

    if (activeTool === "calibrate") {
      if (!calDraft) { setCalDraft(pt); return; }
      const raw = prompt("Real-world length of this line in metres?\n(e.g. 0.9 for a standard door)");
      const m = parseFloat(raw ?? "");
      if (!isNaN(m) && m > 0) onCalibrationChange({ p1: calDraft, p2: pt, real_metres: m });
      setCalDraft(null); setActiveTool(null); return;
    }

    if (!activeDef) return;
    if (activeDef.type === "freehand") return; // handled by mouse events

    if (activeDef.type === "pin") {
      finishShape(activeDef, [pt]); return;
    }
    setDraftPts(p => [...p, pt]);
  }

  function handleCanvasDblClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!activeDef || activeDef.type === "pin" || activeDef.type === "freehand") return;
    const minPts = activeDef.type === "area" ? 3 : 2;
    if (draftPts.length >= minPts) finishShape(activeDef, draftPts);
  }

  // ── Freehand mouse events ──────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (!activeDef || activeDef.type !== "freehand") return;
    e.preventDefault();
    const pt = getPoint(e); if (!pt) return;
    setIsDrawing(true);
    setDraftPts([pt]);
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing || !activeDef || activeDef.type !== "freehand") return;
    const pt = getPoint(e); if (!pt) return;
    setDraftPts(p => [...p, pt]);
  }
  function handleMouseUp() {
    if (!isDrawing || !activeDef) return;
    setIsDrawing(false);
    if (draftPts.length >= 2) finishShape(activeDef, draftPts);
    else setDraftPts([]);
  }

  function finishShape(def: ToolDef, pts: ShapePoint[]) {
    const id = `shape_${Date.now()}`;
    const newShape: PlanShape = {
      id, type: def.type, lineStyle: def.lineStyle, points: pts,
      label: def.label, material_key: null, material_label: "",
      unit_cost: 0, margin_pct: marginPct, qty: 0, unit: def.unit, note: "",
    };
    const m = measuredQty(newShape, calibration);
    if (m) { newShape.qty = m.qty; newShape.unit = m.unit; }
    else if (def.type === "pin") { newShape.qty = 1; }
    onShapesChange([...shapes, newShape]);
    setOpenId(id);
    setDraftPts([]);
  }

  function updateShape(id: string, patch: Partial<PlanShape>) {
    onShapesChange(shapes.map(s => s.id === id ? { ...s, ...patch } : s));
  }
  function removeShape(id: string) {
    onShapesChange(shapes.filter(s => s.id !== id));
    if (openId === id) setOpenId(null);
  }

  // convert % coords to display px
  function toD(pt: ShapePoint) {
    const img = imgRef.current;
    if (!img) return {x:0,y:0};
    return { x: (pt.x/100)*img.offsetWidth, y: (pt.y/100)*img.offsetHeight };
  }
  function ptsToPath(pts: ShapePoint[]) {
    return pts.map((p,i) => `${i===0?"M":"L"}${toD(p).x},${toD(p).y}`).join(" ");
  }

  const totalCost = shapes.reduce((s, sh) => s + shapeCost(sh), 0);
  const openShape = shapes.find(s => s.id === openId);

  return (
    <div className="flex flex-col gap-0" onClick={() => setOpenId(null)}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {/* Calibrate */}
        <button onClick={e => { e.stopPropagation(); setActiveTool(activeTool === "calibrate" ? null : "calibrate"); setDraftPts([]); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${
            activeTool === "calibrate" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-[var(--line)] text-[var(--ink-soft)]"
          }`}>
          <Ruler size={12} /> Calibrate {calibration
            ? <Check size={10} className="text-[var(--green)]" />
            : <AlertCircle size={10} className="text-amber-500" />}
        </button>

        {/* Trade tools */}
        {tools.map(t => (
          <button key={t.id}
            onClick={e => { e.stopPropagation(); setActiveTool(activeTool === t.id ? null : t.id); setDraftPts([]); setIsDrawing(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${
              activeTool === t.id ? "text-white border-transparent" : "border-[var(--line)] text-[var(--ink-soft)]"
            }`}
            style={activeTool === t.id ? { background: t.color, borderColor: t.color } : {}}>
            <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}

        {/* Finish button for click-point tools */}
        {activeDef && activeDef.type !== "freehand" && activeDef.type !== "pin" && draftPts.length >= 2 && (
          <button onClick={e => { e.stopPropagation(); finishShape(activeDef, draftPts); }}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--navy)] text-white border border-[var(--navy)]">
            Done ({draftPts.length} pts)
          </button>
        )}
      </div>

      {/* Hint */}
      {activeTool && activeTool !== "calibrate" && activeDef && (
        <p className="text-[11.5px] text-[var(--ink-faint)] mb-1.5">{activeDef.hint}{activeDef.type === "freehand" ? " — hold and drag." : ""}</p>
      )}
      {activeTool === "calibrate" && (
        <p className="text-[11.5px] text-[var(--ink-faint)] mb-1.5">{calDraft ? "Now click the end of the reference line." : "Click one end of a known length (e.g. door = 0.9m)."}</p>
      )}
      {!calibration && activeDef && activeDef.type !== "pin" && activeTool !== "calibrate" && (
        <p className="text-[11.5px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-1.5">
          Calibrate first for accurate measurements.
        </p>
      )}

      {/* Canvas -- full width, taller */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--app-bg)] select-none ${
          activeTool ? (activeDef?.type === "freehand" ? "cursor-crosshair" : "cursor-crosshair") : "cursor-default"
        }`}
        style={{ touchAction: activeDef?.type === "freehand" ? "none" : "manipulation" }}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDblClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={imageUrl} alt="Plan"
          className="w-full block pointer-events-none"
          style={{ maxHeight: "65vh", objectFit: "contain" }}
          draggable={false}
          onLoad={e => { const i=e.currentTarget; setImgNatural({w:i.naturalWidth,h:i.naturalHeight}); }}
        />

        {/* SVG overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
          {/* Calibration */}
          {calibration && (() => {
            const p1=toD(calibration.p1), p2=toD(calibration.p2);
            return <g><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="5 3" /><circle cx={p1.x} cy={p1.y} r="4" fill="#a855f7" /><circle cx={p2.x} cy={p2.y} r="4" fill="#a855f7" /></g>;
          })()}
          {calDraft && (() => { const p=toD(calDraft); return <circle cx={p.x} cy={p.y} r="5" fill="#a855f7" opacity=".8" />; })()}

          {/* Drawn shapes */}
          {shapes.map(s => {
            const def = tools.find(t => t.lineStyle === s.lineStyle) ?? tools[0];
            const col = def?.color ?? "#3b82f6";
            const dash = def?.dash ?? "";
            const isOpen = s.id === openId;
            if (s.type === "pin") return null; // rendered as DOM
            if ((s.type === "line" || s.type === "freehand") && s.points.length >= 2) {
              const d = ptsToPath(s.points);
              return <g key={s.id} onClick={e => { e.stopPropagation(); setOpenId(openId===s.id?null:s.id); }} className="cursor-pointer">
                {/* Fat invisible hit target */}
                <path d={d} stroke="transparent" strokeWidth="14" fill="none" />
                <path d={d} stroke={col} strokeWidth={isOpen?3.5:2.5} fill="none" strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" opacity={isOpen?1:0.85} />
                {/* Midpoint label */}
                {(() => { const mid=s.points[Math.floor(s.points.length/2)]; const mp=toD(mid); const m=measuredQty(s,calibration); return m ? <text x={mp.x} y={mp.y-6} textAnchor="middle" fontSize="10" fontWeight="700" fill={col}>{m.qty}{m.unit}</text> : null; })()}
              </g>;
            }
            if (s.type === "area" && s.points.length >= 3) {
              const d = ptsToPath(s.points) + " Z";
              const cx = s.points.reduce((a,p)=>a+p.x,0)/s.points.length;
              const cy = s.points.reduce((a,p)=>a+p.y,0)/s.points.length;
              const cp = toD({x:cx,y:cy});
              const m = measuredQty(s, calibration);
              return <g key={s.id} onClick={e => { e.stopPropagation(); setOpenId(openId===s.id?null:s.id); }} className="cursor-pointer">
                <path d={d} stroke={col} strokeWidth={isOpen?2.5:1.5} fill={col} fillOpacity=".15" strokeLinejoin="round" />
                {m && <text x={cp.x} y={cp.y} textAnchor="middle" fontSize="11" fontWeight="700" fill={col}>{m.qty}{m.unit}</text>}
              </g>;
            }
            return null;
          })}

          {/* Draft in progress */}
          {draftPts.length > 0 && activeDef && (() => {
            const d = ptsToPath(draftPts);
            return <path d={d} stroke={activeDef.color} strokeWidth="2.5" fill="none" strokeDasharray={activeDef.type === "freehand" ? "" : "6 4"} strokeLinecap="round" opacity=".8" />;
          })()}
        </svg>

        {/* Pin markers */}
        {shapes.filter(s => s.type === "pin").map((s, i) => {
          const def  = tools.find(t => t.lineStyle === s.lineStyle);
          const col  = def?.color ?? "#ffb400";
          const pt   = s.points[0];
          const idx  = shapes.filter(x => x.type==="pin").indexOf(s);
          return (
            <div key={s.id} className="absolute" style={{ left:`${pt.x}%`, top:`${pt.y}%`, transform:"translate(-50%,-50%)" }}
              onClick={e => { e.stopPropagation(); setOpenId(openId===s.id?null:s.id); }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white cursor-pointer text-[11px] font-bold transition-transform ${openId===s.id?"scale-125":""}`}
                style={{ background: col, color: "#fff" }}>
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspector panel -- slides in below canvas */}
      {openShape && (
        <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden mt-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--app-bg)] border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: tools.find(t=>t.lineStyle===openShape.lineStyle)?.color ?? "#888" }} />
              <span className="text-[13px] font-bold text-[var(--ink)]">{openShape.label}</span>
              {(() => { const m=measuredQty(openShape,calibration); return m ? <span className="text-[12px] text-[var(--ink-faint)] font-semibold">{m.qty} {m.unit}</span> : null; })()}
            </div>
            <div className="flex gap-1">
              <button onClick={() => removeShape(openShape.id)} className="p-1.5 text-[var(--red)] hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
              <button onClick={() => setOpenId(null)} className="p-1.5 text-[var(--ink-faint)] hover:bg-[var(--app-bg)] rounded-lg"><X size={14} /></button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Label</label>
              <input value={openShape.label} onChange={e => updateShape(openShape.id,{label:e.target.value})} className="app-field text-[13px]" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Material</label>
              {materials.length > 0 ? (
                <select value={openShape.material_key ?? ""} className="app-field text-[13px]"
                  onChange={e => {
                    if (!e.target.value) { updateShape(openShape.id,{material_key:null,material_label:"",unit_cost:0}); return; }
                    const mat = materials.find(m=>m.item_key===e.target.value);
                    if (mat) updateShape(openShape.id,{material_key:mat.item_key,material_label:mat.label,unit_cost:mat.unit_cost});
                  }}>
                  <option value="">-- Pick from your materials --</option>
                  {materials.map(m => <option key={m.item_key} value={m.item_key}>{m.label} (${m.unit_cost}/{openShape.unit})</option>)}
                </select>
              ) : (
                <input value={openShape.material_label} onChange={e => updateShape(openShape.id,{material_label:e.target.value})} className="app-field text-[13px]" placeholder="e.g. 2.5mm T&E cable" />
              )}
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Qty ({openShape.unit})</label>
              <input type="number" min={0} step={0.1} value={openShape.qty} onChange={e => updateShape(openShape.id,{qty:parseFloat(e.target.value)||0})} className="app-field text-[13px] text-right" />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Unit cost ($)</label>
              <input type="number" min={0} step={0.01} value={openShape.unit_cost} onChange={e => updateShape(openShape.id,{unit_cost:parseFloat(e.target.value)||0})} className="app-field text-[13px] text-right" />
            </div>
            <div className="col-span-2 bg-[var(--navy)] rounded-xl px-4 py-2.5 flex justify-between items-center">
              <span className="text-[13px] text-[var(--steel-2)]">Line total</span>
              <span className="font-display text-[20px] text-[var(--amber)]">${shapeCost(openShape).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shape list */}
      {shapes.length > 0 && (
        <div className="border border-[var(--line)] rounded-2xl overflow-hidden mt-2">
          <button className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--app-bg)] border-b border-[var(--line)]"
            onClick={e => { e.stopPropagation(); setListOpen(v=>!v); }}>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
              {shapes.length} shape{shapes.length!==1?"s":""} on this plan
            </span>
            <div className="flex items-center gap-3">
              <span className="font-display text-[16px] text-[var(--amber)]">${totalCost.toLocaleString()}</span>
              {listOpen ? <ChevronUp size={14} className="text-[var(--ink-faint)]" /> : <ChevronDown size={14} className="text-[var(--ink-faint)]" />}
            </div>
          </button>
          {listOpen && (
            <div className="divide-y divide-[var(--line-subtle)] max-h-48 overflow-y-auto">
              {shapes.map(s => {
                const def = tools.find(t=>t.lineStyle===s.lineStyle);
                const m = measuredQty(s, calibration);
                return (
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--app-bg)] ${openId===s.id?"bg-[var(--amber-light)]":""}`}
                    onClick={e => { e.stopPropagation(); setOpenId(openId===s.id?null:s.id); }}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: def?.color ?? "#888" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{s.label || s.material_label || "Unnamed"}</p>
                      {s.material_label && <p className="text-[11px] text-[var(--ink-faint)] truncate">{s.material_label}</p>}
                    </div>
                    <span className="text-[11.5px] text-[var(--ink-soft)] tabular shrink-0">{m?`${m.qty}${m.unit}`:`${s.qty}${s.unit}`}</span>
                    <span className="text-[13px] font-bold text-[var(--ink)] tabular shrink-0 w-16 text-right">${shapeCost(s).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
