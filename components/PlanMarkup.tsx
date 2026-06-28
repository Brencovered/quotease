"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Trash2, Ruler, Check, AlertCircle, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export type ShapeType = "pin" | "line" | "area" | "freehand";
export interface ShapePoint { x: number; y: number; }
export interface PlanShape {
  id: string; type: ShapeType; lineStyle: string;
  points: ShapePoint[]; label: string;
  material_key: string | null; material_label: string;
  unit_cost: number; margin_pct: number; qty: number; unit: string; note: string;
}
export interface CalibrationLine { p1: ShapePoint; p2: ShapePoint; real_metres: number; }
export type PlanAnnotation = PlanShape;
export interface MaterialItem { item_key: string; label: string; unit_cost: number; }

interface ToolDef {
  id: string; label: string; type: ShapeType; lineStyle: string;
  color: string; dash: string; unit: string; hint: string;
}

const TRADE_TOOLS: Record<string, ToolDef[]> = {
  electrician: [
    { id: "cable",   label: "Cable run",    type: "freehand", lineStyle: "cable",   color: "#ef4444", dash: "",      unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "conduit", label: "Conduit",      type: "freehand", lineStyle: "conduit", color: "#f97316", dash: "6 3",   unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "circuit", label: "Circuit",      type: "line",     lineStyle: "circuit", color: "#8b5cf6", dash: "8 4",   unit: "m",   hint: "Click to add points. Double-click to finish." },
    { id: "gpo",     label: "GPO",          type: "pin",      lineStyle: "gpo",     color: "#ffb400", dash: "",      unit: "ea",  hint: "Click to place." },
    { id: "light",   label: "Light",        type: "pin",      lineStyle: "light",   color: "#fbbf24", dash: "",      unit: "ea",  hint: "Click to place." },
    { id: "board",   label: "Board",        type: "pin",      lineStyle: "board",   color: "#0a1722", dash: "",      unit: "ea",  hint: "Click to place." },
    { id: "zone",    label: "Zone",         type: "area",     lineStyle: "area",    color: "#3b82f6", dash: "",      unit: "sqm", hint: "Click corners. Double-click to close." },
  ],
  plumber: [
    { id: "hotpipe",  label: "Hot pipe",   type: "freehand", lineStyle: "hotpipe",  color: "#ef4444", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "coldpipe", label: "Cold pipe",  type: "freehand", lineStyle: "coldpipe", color: "#3b82f6", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "drain",    label: "Drain",      type: "freehand", lineStyle: "drain",    color: "#78716c", dash: "8 4",  unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "gas",      label: "Gas line",   type: "freehand", lineStyle: "gas",      color: "#f59e0b", dash: "10 5", unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "fixture",  label: "Fixture",    type: "pin",      lineStyle: "fixture",  color: "#22c55e", dash: "",     unit: "ea",  hint: "Click to place." },
    { id: "wetarea",  label: "Wet area",   type: "area",     lineStyle: "area",     color: "#06b6d4", dash: "",     unit: "sqm", hint: "Click corners. Double-click to close." },
  ],
  carpenter: [
    { id: "wall",     label: "New wall",   type: "line",     lineStyle: "wall",     color: "#0a1722", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish." },
    { id: "timber",   label: "Timber",     type: "freehand", lineStyle: "timber",   color: "#92400e", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "deck",     label: "Decking",    type: "area",     lineStyle: "area",     color: "#78350f", dash: "",     unit: "sqm", hint: "Click corners. Double-click to close." },
    { id: "door",     label: "Door",       type: "pin",      lineStyle: "door",     color: "#d97706", dash: "",     unit: "ea",  hint: "Click to place." },
    { id: "skirting", label: "Skirting",   type: "freehand", lineStyle: "skirting", color: "#b45309", dash: "4 2", unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
  ],
  roofer: [
    { id: "ridge",    label: "Ridge",      type: "line",     lineStyle: "ridge",    color: "#7c3aed", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish." },
    { id: "gutter",   label: "Gutter",     type: "freehand", lineStyle: "gutter",   color: "#0891b2", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "valley",   label: "Valley",     type: "freehand", lineStyle: "valley",   color: "#0e7490", dash: "6 3",  unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "roofarea", label: "Roof area",  type: "area",     lineStyle: "area",     color: "#6d28d9", dash: "",     unit: "sqm", hint: "Click corners. Double-click to close." },
    { id: "skylight", label: "Skylight",   type: "pin",      lineStyle: "skylight", color: "#fbbf24", dash: "",     unit: "ea",  hint: "Click to place." },
  ],
  default: [
    { id: "run",     label: "Run / line",  type: "freehand", lineStyle: "generic",  color: "#3b82f6", dash: "",     unit: "m",   hint: "Click to add points. Double-click to finish. Or hold and drag." },
    { id: "measure", label: "Measure",     type: "line",     lineStyle: "generic",  color: "#8b5cf6", dash: "6 3",  unit: "m",   hint: "Click to add points. Double-click to finish." },
    { id: "item",    label: "Item / pin",  type: "pin",      lineStyle: "generic",  color: "#ffb400", dash: "",     unit: "ea",  hint: "Click to place." },
    { id: "zone",    label: "Zone",        type: "area",     lineStyle: "area",     color: "#22c55e", dash: "",     unit: "sqm", hint: "Click corners. Double-click to close." },
  ],
};

function getTools(trade?: string): ToolDef[] {
  if (!trade) return TRADE_TOOLS.default;
  const k = trade.toLowerCase();
  if (k.includes("electric")) return TRADE_TOOLS.electrician;
  if (k.includes("plumb"))    return TRADE_TOOLS.plumber;
  if (k.includes("carpent"))  return TRADE_TOOLS.carpenter;
  if (k.includes("roof"))     return TRADE_TOOLS.roofer;
  return TRADE_TOOLS.default;
}

function dist(a: ShapePoint, b: ShapePoint) { return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2); }
function polyLen(pts: ShapePoint[]) { let t=0; for(let i=1;i<pts.length;i++) t+=dist(pts[i-1],pts[i]); return t; }
function polyArea(pts: ShapePoint[]) { let a=0; for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length; a+=pts[i].x*pts[j].y-pts[j].x*pts[i].y;} return Math.abs(a)/2; }
function toMetres(px: number, cal: CalibrationLine|null) { if(!cal) return null; const cpx=dist(cal.p1,cal.p2); if(!cpx) return null; return (px/cpx)*cal.real_metres; }
function toSqm(pxSq: number, cal: CalibrationLine|null) { if(!cal) return null; const cpx=dist(cal.p1,cal.p2); if(!cpx) return null; const s=cal.real_metres/cpx; return pxSq*s*s; }
function measuredQty(s: PlanShape, cal: CalibrationLine|null): {qty:number;unit:string}|null {
  if(s.type==="pin") return {qty:1,unit:"ea"};
  if((s.type==="line"||s.type==="freehand")&&s.points.length>=2){const m=toMetres(polyLen(s.points),cal); return m===null?null:{qty:Math.round(m*100)/100,unit:"m"};}
  if(s.type==="area"&&s.points.length>=3){const m=toSqm(polyArea(s.points),cal); return m===null?null:{qty:Math.round(m*100)/100,unit:"sqm"};}
  return null;
}
function shapeCost(s: PlanShape) { return Math.round(s.qty*s.unit_cost*(1+s.margin_pct/100)); }

export default function PlanMarkup({
  imageUrl, shapes, calibration, onShapesChange, onCalibrationChange,
  materials, marginPct, trade, onCostChange,
}: {
  imageUrl: string; shapes: PlanShape[]; calibration: CalibrationLine|null;
  onShapesChange: (n: PlanShape[]) => void; onCalibrationChange: (c: CalibrationLine|null) => void;
  materials: MaterialItem[]; marginPct: number; trade?: string; onCostChange?: (t: number) => void;
}) {
  const canvasRef   = useRef<HTMLDivElement>(null);
  const imgRef      = useRef<HTMLImageElement>(null);
  const tools       = getTools(trade);

  // Zoom / pan state
  const [zoom,    setZoom]    = useState(1);
  const [pan,     setPan]     = useState({x:0,y:0});
  const [panning, setPanning] = useState(false);
  const panStart  = useRef({mx:0,my:0,px:0,py:0});

  // Drawing state
  const [activeTool, setActiveTool] = useState<string|"calibrate"|null>(null);
  const [draftPts,   setDraftPts]   = useState<ShapePoint[]>([]);
  const [calDraft,   setCalDraft]   = useState<ShapePoint|null>(null);
  const [isDrawing,  setIsDrawing]  = useState(false);  // freehand drag mode
  const [openId,     setOpenId]     = useState<string|null>(null);
  const [listOpen,   setListOpen]   = useState(true);

  const activeDef = tools.find(t=>t.id===activeTool)??null;

  useEffect(()=>{ onCostChange?.(shapes.reduce((s,sh)=>s+shapeCost(sh),0)); },[shapes,onCostChange]);

  // Convert mouse event to 0-100% image coords (accounting for zoom/pan)
  const getPoint = useCallback((e: React.MouseEvent): ShapePoint|null => {
    const img = imgRef.current; if(!img) return null;
    const rect = img.getBoundingClientRect();
    // Map screen coords to natural image % space
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    return { x: Math.max(0,Math.min(100,x)), y: Math.max(0,Math.min(100,y)) };
  }, []);

  // ── Zoom ───────────────────────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(z => Math.max(1, Math.min(5, z + delta)));
  }
  function zoomBtn(delta: number) { setZoom(z => Math.max(1, Math.min(5, z + delta))); }
  function resetZoom() { setZoom(1); setPan({x:0,y:0}); }

  // ── Pan (middle-click drag, or space+drag) ─────────────────────────────────
  function handlePanStart(e: React.MouseEvent) {
    if (e.button !== 1 && !e.altKey) return;
    e.preventDefault();
    setPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }
  function handlePanMove(e: React.MouseEvent) {
    if (!panning) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
  }
  function handlePanEnd() { setPanning(false); }

  // ── Click (place point or pin) ─────────────────────────────────────────────
  function handleClick(e: React.MouseEvent) {
    if (panning || !activeTool) return;
    e.stopPropagation();
    const pt = getPoint(e); if (!pt) return;

    if (activeTool === "calibrate") {
      if (!calDraft) { setCalDraft(pt); return; }
      const raw = prompt("Real-world length of this line in metres?\n(e.g. 0.9 for a standard door)");
      const m = parseFloat(raw ?? "");
      if (!isNaN(m) && m > 0) onCalibrationChange({p1:calDraft,p2:pt,real_metres:m});
      setCalDraft(null); setActiveTool(null); return;
    }

    if (!activeDef) return;
    if (activeDef.type === "pin") { finishShape(activeDef,[pt]); return; }
    // For freehand and line/area: click adds a point
    if (!isDrawing) setDraftPts(p => [...p, pt]);
  }

  function handleDblClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!activeDef || activeDef.type === "pin") return;
    const minPts = activeDef.type === "area" ? 3 : 2;
    if (draftPts.length >= minPts) { finishShape(activeDef, draftPts); }
  }

  // ── Freehand drag (hold and drag for smooth curves) ────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || e.altKey) { handlePanStart(e); return; }
    if (!activeDef || activeDef.type !== "freehand") return;
    // Only start freehand drag if no points placed yet (clean start)
    if (draftPts.length > 0) return; // already in click-mode
    e.preventDefault();
    const pt = getPoint(e); if (!pt) return;
    setIsDrawing(true);
    setDraftPts([pt]);
  }
  function handleMouseMove(e: React.MouseEvent) {
    handlePanMove(e);
    if (!isDrawing || !activeDef || activeDef.type !== "freehand") return;
    const pt = getPoint(e); if (!pt) return;
    setDraftPts(p => [...p, pt]);
  }
  function handleMouseUp(e: React.MouseEvent) {
    handlePanEnd();
    if (!isDrawing || !activeDef) return;
    setIsDrawing(false);
    if (draftPts.length >= 2) finishShape(activeDef, draftPts);
    else setDraftPts([]);
  }

  function finishShape(def: ToolDef, pts: ShapePoint[]) {
    const id = `shape_${Date.now()}`;
    const s: PlanShape = {
      id, type: def.type, lineStyle: def.lineStyle, points: pts,
      label: def.label, material_key: null, material_label: "",
      unit_cost: 0, margin_pct: marginPct, qty: 0, unit: def.unit, note: "",
    };
    const m = measuredQty(s, calibration);
    if (m) { s.qty=m.qty; s.unit=m.unit; } else if(def.type==="pin") s.qty=1;
    onShapesChange([...shapes,s]);
    setOpenId(id); setDraftPts([]); setIsDrawing(false);
  }

  function updateShape(id: string, patch: Partial<PlanShape>) { onShapesChange(shapes.map(s=>s.id===id?{...s,...patch}:s)); }
  function removeShape(id: string) { onShapesChange(shapes.filter(s=>s.id!==id)); if(openId===id) setOpenId(null); }

  // Convert 0-100% coords to SVG px relative to the img element
  function toD(pt: ShapePoint) {
    const img = imgRef.current; if(!img) return {x:0,y:0};
    return {x:(pt.x/100)*img.offsetWidth, y:(pt.y/100)*img.offsetHeight};
  }
  function ptsToPath(pts: ShapePoint[]) {
    return pts.map((p,i)=>`${i===0?"M":"L"}${toD(p).x},${toD(p).y}`).join(" ");
  }

  const totalCost = shapes.reduce((s,sh)=>s+shapeCost(sh),0);
  const openShape = shapes.find(s=>s.id===openId);
  const canDone = draftPts.length >= (activeDef?.type==="area"?3:2);

  return (
    <div className="flex flex-col gap-2" onClick={()=>setOpenId(null)}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={e=>{e.stopPropagation();setActiveTool(activeTool==="calibrate"?null:"calibrate");setDraftPts([]);}}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${activeTool==="calibrate"?"border-purple-500 bg-purple-50 text-purple-700":"border-[var(--line)] text-[var(--ink-soft)]"}`}>
          <Ruler size={12}/> Calibrate {calibration?<Check size={10} className="text-[var(--green)]"/>:<AlertCircle size={10} className="text-amber-500"/>}
        </button>
        {tools.map(t=>(
          <button key={t.id}
            onClick={e=>{e.stopPropagation();setActiveTool(activeTool===t.id?null:t.id);setDraftPts([]);setIsDrawing(false);}}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${activeTool===t.id?"text-white border-transparent":"border-[var(--line)] text-[var(--ink-soft)]"}`}
            style={activeTool===t.id?{background:t.color,borderColor:t.color}:{}}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:t.color}}/> {t.label}
          </button>
        ))}
        {canDone && !isDrawing && (
          <button onClick={e=>{e.stopPropagation();if(activeDef)finishShape(activeDef,draftPts);}}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-[var(--navy)] text-white">
            Done ({draftPts.length} pts)
          </button>
        )}
      </div>

      {/* Hint */}
      {activeTool && activeTool!=="calibrate" && activeDef && (
        <p className="text-[11.5px] text-[var(--ink-faint)]">{activeDef.hint}</p>
      )}
      {activeTool==="calibrate" && (
        <p className="text-[11.5px] text-[var(--ink-faint)]">{calDraft?"Now click the end point, then enter its real length.":"Click one end of a known-length line on the plan (e.g. a door = 0.9m)."}</p>
      )}
      {!calibration && activeDef && activeDef.type!=="pin" && activeTool!=="calibrate" && (
        <p className="text-[11.5px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          Calibrate first for accurate measurements. Pins work without calibration.
        </p>
      )}

      {/* Zoom controls */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[11px] font-bold text-[var(--ink-faint)] mr-1">{Math.round(zoom*100)}%</span>
        <button onClick={()=>zoomBtn(-0.25)} disabled={zoom<=1} className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-30 hover:bg-[var(--app-bg)]"><ZoomOut size={13}/></button>
        <button onClick={()=>zoomBtn(0.25)} disabled={zoom>=5} className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-30 hover:bg-[var(--app-bg)]"><ZoomIn size={13}/></button>
        <button onClick={resetZoom} disabled={zoom===1} className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-soft)] disabled:opacity-30 hover:bg-[var(--app-bg)]"><Maximize2 size={13}/></button>
        {zoom>1 && <span className="text-[10.5px] text-[var(--ink-faint)]">Alt+drag to pan</span>}
      </div>

      {/* Canvas */}
      <div ref={canvasRef}
        className="relative w-full rounded-xl overflow-hidden border border-[var(--line)] bg-[#1a1a1a]"
        style={{ height: "60vh", cursor: panning?"grabbing": activeTool?"crosshair":"default" }}
        onWheel={handleWheel}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Zoomable/pannable inner container */}
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:"center center", transition: panning?"none":"transform 0.1s ease" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={imageUrl} alt="Plan"
            className="max-w-full max-h-full block pointer-events-none select-none"
            style={{ maxHeight: "60vh" }}
            draggable={false}
            onLoad={e => {
              const i = e.currentTarget;
              // Force a re-render so toD() picks up real dimensions
              i.style.display="block";
            }}
          />

          {/* SVG overlay -- same size as img, sits on top */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {/* Calibration */}
            {calibration&&(()=>{const p1=toD(calibration.p1),p2=toD(calibration.p2);return<g><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="5 3"/><circle cx={p1.x} cy={p1.y} r="4" fill="#a855f7"/><circle cx={p2.x} cy={p2.y} r="4" fill="#a855f7"/></g>;})()}
            {calDraft&&(()=>{const p=toD(calDraft);return<circle cx={p.x} cy={p.y} r="5" fill="#a855f7" opacity=".8"/>;})()}

            {/* Shapes */}
            {shapes.map(s=>{
              const def=tools.find(t=>t.lineStyle===s.lineStyle)??tools[0];
              const col=def?.color??"#3b82f6";
              const dash=def?.dash??"";
              const isOpen=s.id===openId;
              if(s.type==="pin") return null;
              if((s.type==="line"||s.type==="freehand")&&s.points.length>=2){
                const d=ptsToPath(s.points);
                const mid=s.points[Math.floor(s.points.length/2)];
                const mp=toD(mid);
                const m=measuredQty(s,calibration);
                return<g key={s.id} onClick={e=>{e.stopPropagation();setOpenId(openId===s.id?null:s.id);}} style={{cursor:"pointer"}}>
                  <path d={d} stroke="transparent" strokeWidth="14" fill="none"/>
                  <path d={d} stroke={col} strokeWidth={isOpen?3.5:2.5} fill="none" strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" opacity={isOpen?1:0.85}/>
                  {m&&<text x={mp.x} y={mp.y-6} textAnchor="middle" fontSize="10" fontWeight="700" fill={col} style={{pointerEvents:"none"}}>{m.qty}{m.unit}</text>}
                </g>;
              }
              if(s.type==="area"&&s.points.length>=3){
                const d=ptsToPath(s.points)+" Z";
                const cx=s.points.reduce((a,p)=>a+p.x,0)/s.points.length;
                const cy=s.points.reduce((a,p)=>a+p.y,0)/s.points.length;
                const cp=toD({x:cx,y:cy});
                const m=measuredQty(s,calibration);
                return<g key={s.id} onClick={e=>{e.stopPropagation();setOpenId(openId===s.id?null:s.id);}} style={{cursor:"pointer"}}>
                  <path d={d} stroke={col} strokeWidth={isOpen?2.5:1.5} fill={col} fillOpacity=".15" strokeLinejoin="round"/>
                  {m&&<text x={cp.x} y={cp.y} textAnchor="middle" fontSize="11" fontWeight="700" fill={col}>{m.qty}{m.unit}</text>}
                </g>;
              }
              return null;
            })}

            {/* Draft */}
            {draftPts.length>0&&activeDef&&(()=>{
              const d=ptsToPath(draftPts);
              return<>
                <path d={d} stroke={activeDef.color} strokeWidth="2.5" fill="none" strokeDasharray={isDrawing?"":activeDef.type==="freehand"?"":"6 4"} strokeLinecap="round" opacity=".8"/>
                {!isDrawing&&draftPts.map((p,i)=>{const dp=toD(p);return<circle key={i} cx={dp.x} cy={dp.y} r="4" fill={activeDef.color} opacity=".7"/>;})}
              </>;
            })()}
          </svg>

          {/* Pin markers */}
          {shapes.filter(s=>s.type==="pin").map((s)=>{
            const def=tools.find(t=>t.lineStyle===s.lineStyle);
            const col=def?.color??"#ffb400";
            const pt=s.points[0];
            const idx=shapes.filter(x=>x.type==="pin").indexOf(s);
            return(
              <div key={s.id} className="absolute" style={{left:`${pt.x}%`,top:`${pt.y}%`,transform:"translate(-50%,-50%)"}}
                onClick={e=>{e.stopPropagation();setOpenId(openId===s.id?null:s.id);}}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white cursor-pointer text-[11px] font-bold transition-transform ${openId===s.id?"scale-125":""}`}
                  style={{background:col,color:"#fff"}}>{idx+1}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspector */}
      {openShape&&(
        <div className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--app-bg)] border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{background:tools.find(t=>t.lineStyle===openShape.lineStyle)?.color??"#888"}}/>
              <span className="text-[13px] font-bold text-[var(--ink)]">{openShape.label}</span>
              {(()=>{const m=measuredQty(openShape,calibration);return m?<span className="text-[12px] text-[var(--ink-faint)] font-semibold">{m.qty} {m.unit}</span>:null;})()}
            </div>
            <div className="flex gap-1">
              <button onClick={()=>removeShape(openShape.id)} className="p-1.5 text-[var(--red)] hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
              <button onClick={()=>setOpenId(null)} className="p-1.5 text-[var(--ink-faint)] hover:bg-[var(--app-bg)] rounded-lg"><X size={14}/></button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Label</label>
              <input value={openShape.label} onChange={e=>updateShape(openShape.id,{label:e.target.value})} className="app-field text-[13px]"/>
            </div>
            <div className="col-span-2">
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Material</label>
              {materials.length>0?(
                <select value={openShape.material_key??""} className="app-field text-[13px]"
                  onChange={e=>{
                    if(!e.target.value){updateShape(openShape.id,{material_key:null,material_label:"",unit_cost:0});return;}
                    const mat=materials.find(m=>m.item_key===e.target.value);
                    if(mat) updateShape(openShape.id,{material_key:mat.item_key,material_label:mat.label,unit_cost:mat.unit_cost});
                  }}>
                  <option value="">-- Pick from your materials --</option>
                  {materials.map(m=><option key={m.item_key} value={m.item_key}>{m.label} (${m.unit_cost}/{openShape.unit})</option>)}
                </select>
              ):(
                <input value={openShape.material_label} onChange={e=>updateShape(openShape.id,{material_label:e.target.value})} className="app-field text-[13px]" placeholder="e.g. 2.5mm T&E cable"/>
              )}
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Qty ({openShape.unit})</label>
              <input type="number" min={0} step={0.1} value={openShape.qty} onChange={e=>updateShape(openShape.id,{qty:parseFloat(e.target.value)||0})} className="app-field text-[13px] text-right"/>
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[var(--ink-soft)] mb-1">Unit cost ($)</label>
              <input type="number" min={0} step={0.01} value={openShape.unit_cost} onChange={e=>updateShape(openShape.id,{unit_cost:parseFloat(e.target.value)||0})} className="app-field text-[13px] text-right"/>
            </div>
            <div className="col-span-2 bg-[var(--navy)] rounded-xl px-4 py-2.5 flex justify-between items-center">
              <span className="text-[13px] text-[var(--steel-2)]">Line total</span>
              <span className="font-display text-[20px] text-[var(--amber)]">${shapeCost(openShape).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shape list */}
      {shapes.length>0&&(
        <div className="border border-[var(--line)] rounded-2xl overflow-hidden">
          <button className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--app-bg)] border-b border-[var(--line)]"
            onClick={e=>{e.stopPropagation();setListOpen(v=>!v);}}>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">{shapes.length} shape{shapes.length!==1?"s":""}</span>
            <div className="flex items-center gap-3">
              <span className="font-display text-[16px] text-[var(--amber)]">${totalCost.toLocaleString()}</span>
              {listOpen?<ChevronUp size={14} className="text-[var(--ink-faint)]"/>:<ChevronDown size={14} className="text-[var(--ink-faint)]"/>}
            </div>
          </button>
          {listOpen&&(
            <div className="divide-y divide-[var(--line-subtle)] max-h-48 overflow-y-auto">
              {shapes.map(s=>{
                const def=tools.find(t=>t.lineStyle===s.lineStyle);
                const m=measuredQty(s,calibration);
                return(
                  <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--app-bg)] ${openId===s.id?"bg-[var(--amber-light)]":""}`}
                    onClick={e=>{e.stopPropagation();setOpenId(openId===s.id?null:s.id);}}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:def?.color??"#888"}}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{s.label||s.material_label||"Unnamed"}</p>
                      {s.material_label&&<p className="text-[11px] text-[var(--ink-faint)] truncate">{s.material_label}</p>}
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
