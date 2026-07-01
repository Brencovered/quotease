"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin, Ruler, Pencil, RotateCcw, X, Check, Minus, Plus,
  ChevronRight, MoveHorizontal, MoveVertical, Crosshair,
  DoorOpen, Box, Grid3x3, Lightbulb,
} from "lucide-react";
import { Suspense } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */
type AnnotationType = "point" | "line" | "area";
interface Pt { x: number; y: number; }
interface Annotation {
  id: string; type: AnnotationType; points: Pt[];
  label: string; itemKey: string; qty: number; unit: string; note: string;
  length?: number; frameData: string; colour: string;
  opacity: number; fading: boolean;
}

/* ─── Constants ─────────────────────────────────────────────────── */
const COLOURS = ["#FFB400","#EF4444","#3B82F6","#10B981","#8B5CF6","#F97316"];

const TRADE_ITEMS: Record<string, {key:string;label:string;unit:string;defaultType:AnnotationType}[]> = {
  electrician: [
    {key:"dl",label:"Downlight",unit:"each",defaultType:"point"},
    {key:"gpo",label:"Power point (GPO)",unit:"each",defaultType:"point"},
    {key:"switch",label:"Switch",unit:"each",defaultType:"point"},
    {key:"data",label:"Data point",unit:"each",defaultType:"point"},
    {key:"exhaust",label:"Exhaust fan",unit:"each",defaultType:"point"},
    {key:"smoke",label:"Smoke alarm",unit:"each",defaultType:"point"},
    {key:"cable",label:"Cable run",unit:"m",defaultType:"line"},
    {key:"conduit",label:"Conduit run",unit:"m",defaultType:"line"},
    {key:"sb",label:"Switchboard",unit:"each",defaultType:"point"},
    {key:"circuit",label:"New circuit",unit:"each",defaultType:"line"},
  ],
  plumber: [
    {key:"tap",label:"Tap / mixer",unit:"each",defaultType:"point"},
    {key:"toilet",label:"Toilet (WC)",unit:"each",defaultType:"point"},
    {key:"basin",label:"Basin",unit:"each",defaultType:"point"},
    {key:"shower",label:"Shower",unit:"each",defaultType:"point"},
    {key:"hwu",label:"Hot water unit",unit:"each",defaultType:"point"},
    {key:"pipe",label:"Pipe run",unit:"m",defaultType:"line"},
    {key:"drain",label:"Drain line",unit:"m",defaultType:"line"},
  ],
  roofer: [
    {key:"gutter",label:"Gutter run",unit:"m",defaultType:"line"},
    {key:"downpipe",label:"Downpipe",unit:"each",defaultType:"point"},
    {key:"ridge",label:"Ridge line",unit:"m",defaultType:"line"},
    {key:"valley",label:"Valley iron",unit:"m",defaultType:"line"},
    {key:"skylight",label:"Skylight",unit:"each",defaultType:"point"},
    {key:"damage",label:"Damaged area",unit:"m2",defaultType:"area"},
  ],
};

/** Known-size reference objects for calibration */
const REFERENCE_OBJECTS = [
  { key: "door",     label: "Standard door",   metres: 2.10, icon: DoorOpen,    desc: "Tap top and bottom of door" },
  { key: "gpo",      label: "Power point",     metres: 0.12, icon: Lightbulb,   desc: "Tap left and right edges" },
  { key: "tile_600", label: "Floor tile 600mm", metres: 0.60, icon: Grid3x3,     desc: "Tap two corners of one tile" },
  { key: "tile_300", label: "Floor tile 300mm", metres: 0.30, icon: Grid3x3,     desc: "Tap two corners of one tile" },
  { key: "brick",    label: "Brick (standard)", metres: 0.23, icon: Box,         desc: "Tap top and bottom of one brick" },
  { key: "ceiling",  label: "Room height",      metres: 2.40, icon: MoveVertical, desc: "Tap floor and ceiling" },
  { key: "custom",   label: "Custom",           metres: 0,    icon: Ruler,       desc: "Enter your own measurement" },
];

/* ─── Helpers ───────────────────────────────────────────────────── */
function dist(a:Pt,b:Pt){return Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);}
function uid(){return Math.random().toString(36).slice(2,9);}

/* ═══════════════════════════════════════════════════════════════════
   CAMERA PAGE
   ═══════════════════════════════════════════════════════════════════ */
function CameraPage() {
  const router = useRouter();
  const params = useSearchParams();
  const trade  = params.get("trade") ?? "electrician";
  const items  = TRADE_ITEMS[trade] ?? TRADE_ITEMS.electrician;

  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const snapRef    = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream|null>(null);
  const pendingFrameRef = useRef<string>("");
  const motionRef  = useRef({ beta:0, gamma:0, alpha:0, lastBeta:0, lastGamma:0, lastAlpha:0, moving:false, since:0 });
  const fadeRafRef = useRef<number>(0);

  /* ── Core state ─────────────────────────────────────────────── */
  const [ready,       setReady]       = useState(false);
  const [error,       setCameraError] = useState<string|null>(null);
  const [drawMode,    setDrawMode]    = useState<AnnotationType>("point");
  const [isDrawing,   setIsDrawing]   = useState(false);
  const [curPts,      setCurPts]      = useState<Pt[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [colourIdx,   setColourIdx]   = useState(0);
  const [showForm,    setShowForm]    = useState(false);
  const [pendingPts,  setPendingPts]  = useState<Pt[]>([]);
  const [formItem,    setFormItem]    = useState(items[0].key);
  const [formQty,     setFormQty]     = useState(1);
  const [formNote,    setFormNote]    = useState("");
  const [formLength,  setFormLength]  = useState<number|null>(null);
  const [review,      setReview]      = useState(false);
  const [stampMode,   setStampMode]   = useState(true);
  const [stampItem,   setStampItem]   = useState<string>(items[0]?.key ?? "dl");

  /* ── Calibration state (enhanced) ───────────────────────────── */
  const [calibMode,   setCalibMode]   = useState(false);
  const [calibStep,   setCalibStep]   = useState<"pick" | "tap" | "confirm">("pick");
  const [calibObj,    setCalibObj]    = useState(REFERENCE_OBJECTS[0]);
  const [calibPts,    setCalibPts]    = useState<Pt[]>([]);
  const [calibPx,     setCalibPx]     = useState(0);
  const [calibCustom, setCalibCustom] = useState("");
  const [calibration, setCalibration] = useState<{pxPerMetre:number}|null>(null);

  /* ── Level guide state ──────────────────────────────────────── */
  const [level, setLevel] = useState({ beta: 0, gamma: 0, isLevel: false });
  const [showLevel, setShowLevel] = useState(true);

  /* ═══════════════════════════════════════════════════════════════
     CAMERA SETUP
     ═══════════════════════════════════════════════════════════════ */
  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        v.onloadedmetadata = () => { v.play(); setReady(true); };
      } catch(e) {
        setCameraError(e instanceof DOMException && e.name==="NotAllowedError"
          ? "Camera access denied. Tap the camera icon in your browser address bar to allow."
          : "Could not open camera.");
      }
    }
    start();
    return () => { streamRef.current?.getTracks().forEach(t=>t.stop()); };
  }, []);

  /* ── Canvas resize ──────────────────────────────────────────── */
  useEffect(()=>{
    const v = videoRef.current; const o = overlayRef.current;
    if(!v||!o) return;
    function resize(){
      if(!v||!o) return;
      o.width = v.clientWidth || window.innerWidth;
      o.height = v.clientHeight || window.innerHeight;
    }
    resize();
    window.addEventListener("resize",resize);
    const t = setInterval(resize, 500);
    return ()=>{ clearInterval(t); window.removeEventListener("resize",resize); };
  },[]);

  /* ═══════════════════════════════════════════════════════════════
     DEVICE ORIENTATION - Level Guide + Motion Detection
     ═══════════════════════════════════════════════════════════════ */
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      const b = e.beta  ?? 0;
      const g = e.gamma ?? 0;
      const a = e.alpha ?? 0;

      const m = motionRef.current;

      /* ── Level guide ──────────────────────────────────────── */
      const isLevel = Math.abs(b) < 3 && Math.abs(g) < 3;
      setLevel({ beta: b, gamma: g, isLevel });

      /* ── Motion detection for annotation fade ─────────────── */
      const dBeta  = Math.abs(b - m.lastBeta);
      const dGamma = Math.abs(g - m.lastGamma);
      const dAlpha = Math.abs(((a - m.lastAlpha + 180) % 360) - 180);

      const MOTION_THRESHOLD = 4.0;
      const isMoving = dBeta > MOTION_THRESHOLD || dGamma > MOTION_THRESHOLD || dAlpha > MOTION_THRESHOLD * 2;

      if (isMoving && !m.moving) {
        m.moving = true;
        m.since = Date.now();
        setAnnotations(prev => prev.map(ann =>
          ann.opacity > 0 && !ann.fading ? { ...ann, fading: true } : ann
        ));
      } else if (!isMoving && m.moving) {
        m.moving = false;
      }

      m.beta = b; m.gamma = g; m.alpha = a;
      m.lastBeta = b; m.lastGamma = g; m.lastAlpha = a;
    }

    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      (DeviceOrientationEvent as any).requestPermission()
        .then((state: string) => { if (state === "granted") window.addEventListener("deviceorientation", handleOrientation); })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => { window.removeEventListener("deviceorientation", handleOrientation); };
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     ANNOTATION FADE ANIMATION LOOP
     ═══════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!ready) return;
    function fadeLoop() {
      setAnnotations(prev => {
        let changed = false;
        const updated = prev.map(ann => {
          if (ann.fading && ann.opacity > 0) {
            changed = true;
            return { ...ann, opacity: Math.max(0, ann.opacity - 0.04) };
          }
          return ann;
        });
        return changed ? updated : prev;
      });
      fadeRafRef.current = requestAnimationFrame(fadeLoop);
    }
    fadeRafRef.current = requestAnimationFrame(fadeLoop);
    return () => { cancelAnimationFrame(fadeRafRef.current); };
  }, [ready]);

  /* ═══════════════════════════════════════════════════════════════
     OVERLAY DRAWING
     ═══════════════════════════════════════════════════════════════ */
  const drawOverlay = useCallback(()=>{
    const o = overlayRef.current; if(!o) return;
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0,0,o.width,o.height);

    /* ── Level guide crosshairs ─────────────────────────────── */
    if (showLevel) {
      const cx = o.width / 2;
      const cy = o.height / 2;
      const offsetX = (level.gamma / 45) * Math.min(o.width, o.height) * 0.15;
      const offsetY = (level.beta  / 45) * Math.min(o.width, o.height) * 0.15;

      const levelColor = level.isLevel ? "#4ade80" : "#ef4444";
      const levelAlpha = level.isLevel ? 0.9 : 0.5;

      ctx.save();
      ctx.globalAlpha = levelAlpha;
      ctx.strokeStyle = levelColor;
      ctx.lineWidth = level.isLevel ? 2.5 : 1.5;

      // Horizontal line (moves with gamma/tilt)
      ctx.beginPath();
      ctx.moveTo(cx - 80 + offsetX, cy + offsetY);
      ctx.lineTo(cx - 20 + offsetX, cy + offsetY);
      ctx.moveTo(cx + 20 + offsetX, cy + offsetY);
      ctx.lineTo(cx + 80 + offsetX, cy + offsetY);
      ctx.stroke();

      // Vertical line (moves with beta/tilt)
      ctx.beginPath();
      ctx.moveTo(cx + offsetX, cy - 80 + offsetY);
      ctx.lineTo(cx + offsetX, cy - 20 + offsetY);
      ctx.moveTo(cx + offsetX, cy + 20 + offsetY);
      ctx.lineTo(cx + offsetX, cy + 80 + offsetY);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = levelColor;
      ctx.beginPath();
      ctx.arc(cx + offsetX, cy + offsetY, level.isLevel ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();

      // Level indicator text
      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = levelColor;
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.7;
      ctx.fillText(level.isLevel ? "LEVEL" : `${Math.abs(level.beta).toFixed(0)}\u00b0 ${Math.abs(level.gamma).toFixed(0)}\u00b0`, cx, cy + offsetY + 50);
      ctx.textAlign = "start";
      ctx.restore();
    }

    /* ── Saved annotations (with fade opacity) ───────────────── */
    annotations.forEach((ann, idx) => {
      if (ann.opacity <= 0) return;
      ctx.save();
      ctx.globalAlpha = ann.opacity;
      ctx.strokeStyle = ann.colour;
      ctx.fillStyle = ann.colour;
      ctx.lineWidth = 3;

      if (ann.type === "point" && ann.points.length >= 1) {
        const p = ann.points[0];
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#000"; ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), p.x, p.y);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = ann.colour; ctx.font = "bold 11px system-ui";
        ctx.fillText(`${ann.label} \u00d7${ann.qty}`, p.x + 18, p.y + 4);
      } else if (ann.type === "line" && ann.points.length >= 2) {
        const [a, b] = ann.points;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        [a, b].forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI*2); ctx.fill(); });
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const al = 16;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - al*Math.cos(angle-0.4), b.y - al*Math.sin(angle-0.4));
        ctx.lineTo(b.x - al*Math.cos(angle+0.4), b.y - al*Math.sin(angle+0.4));
        ctx.closePath(); ctx.fill();
        const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`${ann.label}${ann.length ? ` ~${ann.length}m` : ""}`, mx, my - 8);
        ctx.textAlign = "start";
      } else if (ann.type === "area" && ann.points.length >= 3) {
        ctx.globalAlpha = ann.opacity * 0.25;
        ctx.beginPath(); ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = ann.opacity;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    });

    /* ── Current drawing (in-progress) ──────────────────────── */
    if (curPts.length > 0) {
      const c = COLOURS[colourIdx % COLOURS.length];
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
      if (drawMode === "line" && curPts.length >= 2) {
        ctx.beginPath(); ctx.moveTo(curPts[0].x, curPts[0].y); ctx.lineTo(curPts[1].x, curPts[1].y); ctx.stroke();
      } else if (drawMode === "area" && curPts.length >= 2) {
        ctx.beginPath(); ctx.moveTo(curPts[0].x, curPts[0].y);
        curPts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    /* ── Calibration tap points ─────────────────────────────── */
    if (calibMode && calibPts.length > 0) {
      ctx.strokeStyle = "#00FF88"; ctx.lineWidth = 2; ctx.fillStyle = "#00FF88";
      calibPts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(i === 0 ? "1" : "2", p.x, p.y);
      });
      if (calibPts.length === 2) {
        ctx.strokeStyle = "#00FF88"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(calibPts[0].x, calibPts[0].y); ctx.lineTo(calibPts[1].x, calibPts[1].y); ctx.stroke();
        const px = dist(calibPts[0], calibPts[1]);
        const mx = (calibPts[0].x + calibPts[1].x) / 2;
        const my = (calibPts[0].y + calibPts[1].y) / 2;
        ctx.fillStyle = "#00FF88"; ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(px)}px`, mx, my - 12);
        ctx.textAlign = "start";
      }
    }
  }, [curPts, drawMode, colourIdx, calibMode, calibPts, annotations, level, showLevel]);

  useEffect(()=>{
    if(!ready) return;
    const raf = requestAnimationFrame(function loop(){ drawOverlay(); requestAnimationFrame(loop); });
    return ()=>cancelAnimationFrame(raf);
  },[ready, drawOverlay]);

  /* ═══════════════════════════════════════════════════════════════
     TOUCH / MOUSE HANDLERS
     ═══════════════════════════════════════════════════════════════ */
  function canvasPt(e: React.TouchEvent|React.MouseEvent):Pt{
    const o = overlayRef.current!; const r = o.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {x: cx-r.left, y: cy-r.top};
  }

  function handleStart(e:React.TouchEvent|React.MouseEvent){
    e.preventDefault();
    const p = canvasPt(e);

    if (calibMode) {
      if (calibStep === "pick") return;
      const next = [...calibPts, p];
      setCalibPts(next);
      if (next.length === 1) return;
      if (next.length === 2) {
        const pxDist = dist(next[0], next[1]);
        setCalibPx(pxDist);
        if (calibObj.key === "custom") {
          setCalibStep("confirm");
        } else {
          const realMetres = calibObj.metres;
          setCalibration({ pxPerMetre: pxDist / realMetres });
          setCalibMode(false); setCalibPts([]); setCalibStep("pick");
        }
      }
      return;
    }

    if (drawMode === "point") { captureAnnotation([p]); return; }
    setIsDrawing(true); setCurPts([p]);
  }

  function handleMove(e:React.TouchEvent|React.MouseEvent){
    e.preventDefault(); if(!isDrawing) return;
    const p = canvasPt(e);
    setCurPts(prev => drawMode === "line" ? [prev[0], p] : [...prev, p]);
  }

  function handleEnd(e:React.TouchEvent|React.MouseEvent){
    e.preventDefault(); if(!isDrawing) return;
    setIsDrawing(false);
    if (drawMode === "line" && curPts.length === 2) captureAnnotation(curPts);
    else if (drawMode === "area" && curPts.length >= 3) captureAnnotation(curPts);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAPTURE FRAME
     ═══════════════════════════════════════════════════════════════ */
  function captureFrame(pts:Pt[]){
    const v = videoRef.current; const s = snapRef.current; const o = overlayRef.current;
    let fd = "";
    if (v && s && o) {
      s.width = v.videoWidth || o.width; s.height = v.videoHeight || o.height;
      const ctx = s.getContext("2d")!;
      ctx.drawImage(v, 0, 0, s.width, s.height);
      const sx = s.width / o.width; const sy = s.height / o.height;
      const colour = COLOURS[colourIdx % COLOURS.length];
      ctx.fillStyle = colour; ctx.strokeStyle = colour; ctx.lineWidth = Math.max(3, s.width/200);
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6;

      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x*sx, pts[0].y*sy, 18, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();
        ctx.fillStyle = "#000"; ctx.font = `bold ${Math.max(14, s.width/60)}px system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(annotations.length + 1), pts[0].x*sx, pts[0].y*sy);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      } else if (pts.length === 2) {
        ctx.strokeStyle = colour; ctx.lineWidth = Math.max(4, s.width/200); ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.moveTo(pts[0].x*sx, pts[0].y*sy); ctx.lineTo(pts[1].x*sx, pts[1].y*sy); ctx.stroke();
        [pts[0], pts[1]].forEach(p => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(p.x*sx, p.y*sy, 8, 0, Math.PI*2); ctx.fill(); });
      }
      ctx.shadowBlur = 0;
      fd = s.toDataURL("image/jpeg", 0.55);
      pendingFrameRef.current = fd;
    }
    return pendingFrameRef.current;
  }

  /* ═══════════════════════════════════════════════════════════════
     QUICK COMMIT (stamp mode)
     ═══════════════════════════════════════════════════════════════ */
  function quickCommit(pts:Pt[], itemKey:string){
    const fd = captureFrame(pts);
    const def = items.find(i => i.key === itemKey) ?? items[0];
    let qty = 1;
    if (def.unit === "m" && calibration && pts.length === 2) {
      qty = Math.round(dist(pts[0], pts[1]) / calibration.pxPerMetre * 100) / 100;
    }
    const ann: Annotation = {
      id: uid(), type: def.defaultType as AnnotationType, points: pts,
      label: def.label, itemKey, qty, unit: def.unit,
      note: "", length: def.unit === "m" ? qty : undefined,
      frameData: fd, colour: COLOURS[colourIdx % COLOURS.length],
      opacity: 1, fading: false,
    };
    setAnnotations(p => [...p, ann]);
    setColourIdx(i => (i + 1) % COLOURS.length);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAPTURE ANNOTATION
     ═══════════════════════════════════════════════════════════════ */
  function captureAnnotation(pts:Pt[]){
    if (stampMode && drawMode === "point") { quickCommit(pts, stampItem); return; }
    if (stampMode && (drawMode === "line" || drawMode === "area")) { quickCommit(pts, stampItem); return; }

    captureFrame(pts);
    let autoLen: number | null = null;
    if (calibration && drawMode === "line" && pts.length === 2) {
      autoLen = Math.round(dist(pts[0], pts[1]) / calibration.pxPerMetre * 100) / 100;
    }
    const def = items.find(i => i.defaultType === drawMode) ?? items[0];
    setFormItem(def.key); setFormQty(autoLen ?? 1); setFormNote(""); setFormLength(autoLen);
    setPendingPts(pts); setCurPts([]); setShowForm(true);
  }

  function commitAnnotation(){
    const def = items.find(i => i.key === formItem) ?? items[0];
    const ann: Annotation = {
      id: uid(), type: drawMode, points: pendingPts,
      label: def.label, itemKey: formItem, qty: formQty, unit: def.unit,
      note: formNote, length: formLength ?? undefined,
      frameData: pendingFrameRef.current,
      colour: COLOURS[colourIdx % COLOURS.length],
      opacity: 1, fading: false,
    };
    setAnnotations(p => [...p, ann]);
    setColourIdx(i => (i + 1) % COLOURS.length);
    setShowForm(false); setPendingPts([]);
  }

  /* ═══════════════════════════════════════════════════════════════
     CALIBRATION - Enhanced with reference objects
     ═══════════════════════════════════════════════════════════════ */
  function startCalibration() {
    setCalibMode(true);
    setCalibStep("pick");
    setCalibPts([]);
  }

  function selectCalibObj(obj: typeof REFERENCE_OBJECTS[0]) {
    setCalibObj(obj);
    setCalibStep("tap");
  }

  function commitCustomCalib() {
    const real = parseFloat(calibCustom);
    if (isNaN(real) || real <= 0 || calibPx <= 0) return;
    setCalibration({ pxPerMetre: calibPx / real });
    setCalibMode(false); setCalibPts([]); setCalibStep("pick"); setCalibCustom(""); setCalibPx(0);
  }

  /* ═══════════════════════════════════════════════════════════════
     FINISH
     ═══════════════════════════════════════════════════════════════ */
  function finish(){
    sessionStorage.setItem("liveAnnotations", JSON.stringify(annotations));
    sessionStorage.setItem("liveAnnotationMeta", JSON.stringify(
      annotations.map(ann => ({
        id: ann.id, type: ann.type, label: ann.label, itemKey: ann.itemKey,
        qty: ann.qty, unit: ann.unit, note: ann.note, length: ann.length,
        colour: ann.colour, frameData: ann.frameData,
      }))
    ));
    router.back();
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  if (error) return (
    <div className="h-screen bg-black flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl p-6 text-center max-w-xs">
        <p className="font-bold text-[15px] mb-2">Camera unavailable</p>
        <p className="text-[13px] text-gray-500 mb-4">{error}</p>
        <button onClick={() => router.push("/electrician")} className="bg-[#0a1722] text-white font-bold px-6 py-3 rounded-xl">Go back</button>
      </div>
    </div>
  );

  if (review) return (
    <div className="min-h-screen bg-[#f8f9fa] p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-[16px]">{annotations.filter(a => a.opacity > 0 || a.frameData).length} annotation{annotations.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setReview(false)} className="text-sm font-bold text-blue-600">Back to camera</button>
      </div>
      <div className="space-y-3 mb-6">
        {annotations.map((ann, i) => (
          <div key={ann.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            {ann.frameData && <img src={ann.frameData} alt="" className="w-16 h-12 object-cover rounded-xl shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ann.colour }} />
                <p className="font-bold text-[13px] truncate">{ann.label}</p>
              </div>
              <p className="text-[12px] text-gray-500">{ann.qty} {ann.unit}{ann.length != null ? ` \u00b7 ~${ann.length}m` : ""}{ann.note ? ` \u00b7 ${ann.note}` : ""}</p>
            </div>
            <button onClick={() => setAnnotations(p => p.filter((_, j) => j !== i))} className="text-red-400 p-1"><X size={14} /></button>
          </div>
        ))}
      </div>
      {annotations.length > 0
        ? <button onClick={finish} className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold py-4 rounded-xl flex items-center justify-center gap-2">
            <Check size={16} /> Add {annotations.length} item{annotations.length !== 1 ? "s" : ""} to quote
          </button>
        : <p className="text-center text-gray-400 text-sm">No annotations yet.</p>
      }
    </div>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <canvas ref={snapRef} className="hidden" />
      <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <canvas
        ref={overlayRef}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", touchAction: "none" }}
      />

      {/* ═══════════════════════════════════════════════════════════
          TOP BAR
          ═══════════════════════════════════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0 z-10" style={{ padding: "12px 16px", background: "linear-gradient(to bottom,rgba(0,0,0,.7),transparent)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: "pulse 1s infinite" }} />
            <span className="text-white text-[12px] font-bold">LIVE</span>
            {calibration && (
              <span className="text-green-400 text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full">Calibrated</span>
            )}
            {annotations.length > 0 && (
              <span className="text-[#ffb400] text-[11px] font-bold bg-black/40 px-2 py-0.5 rounded-full">{annotations.length} saved</span>
            )}
            {level.isLevel && (
              <span className="text-green-400 text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crosshair size={9} /> LEVEL
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowLevel(v => !v)}
              className="text-white p-1.5 rounded-lg"
              style={{ background: showLevel ? "rgba(74,222,128,.3)" : "rgba(0,0,0,.4)" }}>
              <MoveHorizontal size={14} />
            </button>
            <button onClick={() => setReview(true)} className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[12px] px-4 py-1.5 rounded-full flex items-center gap-1 border-0">
              Done <ChevronRight size={13} />
            </button>
            <button onClick={() => router.push("/electrician")} className="text-white p-1.5 rounded-lg bg-black/40 border-0">
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM TOOLBAR
          ═══════════════════════════════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ padding: "12px 16px calc(80px + env(safe-area-inset-bottom))", background: "linear-gradient(to top,rgba(0,0,0,.8),transparent)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1.5">
            {(["point","line","area"] as AnnotationType[]).map(m => {
              const Icon = m === "point" ? MapPin : m === "line" ? Ruler : Pencil;
              const label = m === "point" ? "Tap" : m === "line" ? "Line" : "Area";
              return (
                <button key={m} onClick={() => setDrawMode(m)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-0"
                  style={{ background: drawMode === m ? "#ffb400" : "rgba(0,0,0,.4)", color: drawMode === m ? "#0a1722" : "white" }}>
                  <Icon size={11} /> {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 items-center">
            <button onClick={() => setStampMode(s => !s)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-0"
              style={{ background: stampMode ? "#22c55e" : "rgba(0,0,0,.4)", color: "white" }}>
              {stampMode ? "Stamp ON" : "Stamp off"}
            </button>
            <button onClick={startCalibration}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-0"
              style={{ background: calibMode ? "#22c55e" : "rgba(0,0,0,.4)", color: "white" }}>
              <Ruler size={11} /> {calibMode ? "Calibrating..." : "Calibrate"}
            </button>
            {annotations.length > 0 && (
              <button onClick={() => setAnnotations(p => p.slice(0, - 1))} className="text-white p-1.5 rounded-lg bg-black/40 border-0">
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {items.map(item => {
            const isActive = stampMode ? stampItem === item.key : drawMode === item.defaultType;
            return (
              <button key={item.key}
                onClick={() => { if (stampMode) { setStampItem(item.key); setDrawMode(item.defaultType as AnnotationType); } else { setDrawMode(item.defaultType as AnnotationType); } }}
                className="text-[11px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shrink-0"
                style={{ background: isActive ? "#ffb400" : "rgba(0,0,0,.4)", color: isActive ? "#0a1722" : "white", border: isActive ? "2px solid #ffb400" : "1px solid rgba(255,255,255,.2)" }}>
                {item.label}
              </button>
            );
          })}
        </div>
        {stampMode && (
          <p className="text-green-400 text-[10px] font-bold mt-1 text-center">
            Tap to add {items.find(i => i.key === stampItem)?.label ?? "item"}s instantly
          </p>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CALIBRATION UI - Enhanced with reference objects
          ═══════════════════════════════════════════════════════════ */}
      {calibMode && calibStep === "pick" && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-end">
          <div className="bg-white rounded-t-3xl p-5 w-full max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-[16px]">Calibrate with a known object</p>
              <button onClick={() => { setCalibMode(false); setCalibStep("pick"); setCalibPts([]); }} className="bg-none border-0 p-1"><X size={18} /></button>
            </div>
            <p className="text-[12.5px] text-gray-500 mb-4">
              Pick an object you can see, then tap its start and end points on screen.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {REFERENCE_OBJECTS.map(obj => {
                const Icon = obj.icon;
                return (
                  <button key={obj.key} onClick={() => selectCalibObj(obj)}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all hover:bg-gray-50"
                    style={{ borderColor: calibObj.key === obj.key ? "#0a1722" : "#e5e7eb" }}>
                    <div className="w-10 h-10 rounded-xl bg-[#0a1722] flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#ffb400]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-[14px]">{obj.label}</p>
                      <p className="text-[12px] text-gray-500">{obj.desc}</p>
                    </div>
                    {obj.key !== "custom" && (
                      <span className="text-[12px] font-bold text-[#0a1722] bg-gray-100 px-2 py-1 rounded-lg shrink-0">
                        {obj.metres >= 1 ? `${obj.metres}m` : `${Math.round(obj.metres * 1000)}mm`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {calibMode && calibStep === "tap" && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute top-20 left-0 right-0 flex justify-center">
            <div className="bg-black/60 text-white px-4 py-2 rounded-full text-[13px] font-bold flex items-center gap-2">
              <Crosshair size={14} className="text-[#00FF88]" />
              Tap <strong className="text-[#00FF88]">{calibObj.label}</strong> start point, then end point
            </div>
          </div>
          {calibPts.length === 1 && (
            <div className="absolute bottom-32 left-0 right-0 flex justify-center">
              <div className="bg-[#00FF88] text-black px-4 py-2 rounded-full text-[12px] font-bold animate-bounce">
                Now tap the end point
              </div>
            </div>
          )}
        </div>
      )}

      {calibMode && calibStep === "confirm" && calibObj.key === "custom" && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
            <p className="font-bold text-[15px] mb-1">Enter real measurement</p>
            <p className="text-[12px] text-gray-500 mb-3">
              {Math.round(calibPx)} pixels measured. How many metres is that?
            </p>
            <input type="number" step="0.01" min="0.01" value={calibCustom} onChange={e => setCalibCustom(e.target.value)}
              placeholder="e.g. 2.4" autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[14px] mb-3" />
            <div className="flex gap-2">
              <button onClick={commitCustomCalib} disabled={!calibCustom}
                className="flex-1 bg-[#0a1722] text-white font-bold py-2.5 rounded-lg border-0">Set calibration</button>
              <button onClick={() => { setCalibStep("pick"); setCalibPts([]); setCalibPx(0); }}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg border-0">Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ANNOTATION FORM (detail mode)
          ═══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="absolute inset-0 z-20 bg-black/50 flex items-end">
          <div className="bg-white rounded-t-3xl p-5 w-full">
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold text-[15px]">What is this?</p>
              <button onClick={() => { setShowForm(false); setPendingPts([]); setCurPts([]); }} className="border-0 bg-none p-1"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-40 overflow-y-auto">
              {items.map(item => (
                <button key={item.key} onClick={() => setFormItem(item.key)}
                  className="text-left px-3 py-2 rounded-xl border-2 text-[13px] font-semibold"
                  style={{ borderColor: formItem === item.key ? "#0a1722" : "#e5e7eb", background: formItem === item.key ? "rgba(10,23,34,.05)" : "white" }}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">
                  {items.find(i => i.key === formItem)?.unit === "m" ? "Length (m)" : "Quantity"}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setFormQty(q => Math.max(0.5, q - 1))} className="border border-gray-200 rounded-lg p-1.5 bg-white"><Minus size={12} /></button>
                  <input type="number" min={0.1} step={0.5} value={formQty} onChange={e => setFormQty(Number(e.target.value))}
                    className="flex-1 text-center border border-gray-200 rounded-lg py-1.5 text-[14px]" />
                  <button onClick={() => setFormQty(q => q + 1)} className="border border-gray-200 rounded-lg p-1.5 bg-white"><Plus size={12} /></button>
                </div>
                {formLength != null && <p className="text-[10px] text-green-600 mt-1">Est. {formLength}m</p>}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">Note (optional)</p>
                <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="e.g. kitchen ceiling"
                  className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 text-[13px]" />
              </div>
            </div>
            <button onClick={commitAnnotation} disabled={!formItem}
              className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl border-0 flex items-center justify-center gap-1.5">
              <Check size={15} /> Add annotation
            </button>
          </div>
        </div>
      )}

      {/* Colour dot */}
      <div className="absolute top-14 right-4 w-3.5 h-3.5 rounded-full border-2 border-white"
        style={{ background: COLOURS[colourIdx % COLOURS.length] }} />
    </div>
  );
}

export default function CameraPageWrapper() {
  return (
    <Suspense>
      <CameraPage />
    </Suspense>
  );
}
