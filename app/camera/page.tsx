"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin, Ruler, Pencil, RotateCcw, X, Check, Minus, Plus,
  ChevronRight, MoveHorizontal, Crosshair,
  DoorOpen, Box, Grid3x3, Lightbulb, MoveVertical, AlertTriangle,
} from "lucide-react";
import { Suspense } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */
type AnnotationType = "point" | "line" | "area";
interface Pt { x: number; y: number; }

interface Annotation {
  id: string; type: AnnotationType; points: Pt[];
  label: string; itemKey: string;
  qty: number;                         // confirmed quantity (userConfirmedLengthMeters or count)
  calculatedLength: number | null;     // raw engine output
  unit: string; note: string;
  length?: number; frameData: string; colour: string;
  opacity: number; fading: boolean;
}

/* ─── Per-room calibration (spec: RoomSession) ───────────────────── */
interface RoomCalibration {
  objectType: string;
  pxPerMetre: number;
  isCalibrated: boolean;
}

interface RoomSession {
  roomId: string;
  roomName: string;
  calibration: RoomCalibration;
  annotations: Annotation[];
}

/* ─── iOS orientation permission helper ─────────────────────────── */
function requestOrientationPermission(): Promise<string> | undefined {
  const ctor = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  return ctor.requestPermission?.();
}

/* ─── Constants ─────────────────────────────────────────────────── */
const COLOURS = ["#FFB400","#EF4444","#3B82F6","#10B981","#8B5CF6","#F97316"];

const TRADE_ITEMS: Record<string, {key:string;label:string;unit:string;defaultType:AnnotationType}[]> = {
  electrician: [
    {key:"dl",     label:"Downlight",        unit:"each",defaultType:"point"},
    {key:"gpo",    label:"Power point (GPO)", unit:"each",defaultType:"point"},
    {key:"switch", label:"Switch",            unit:"each",defaultType:"point"},
    {key:"data",   label:"Data point",        unit:"each",defaultType:"point"},
    {key:"exhaust",label:"Exhaust fan",       unit:"each",defaultType:"point"},
    {key:"smoke",  label:"Smoke alarm",       unit:"each",defaultType:"point"},
    {key:"cable",  label:"Cable run",         unit:"m",   defaultType:"line"},
    {key:"conduit",label:"Conduit run",       unit:"m",   defaultType:"line"},
    {key:"sb",     label:"Switchboard",       unit:"each",defaultType:"point"},
    {key:"circuit",label:"New circuit",       unit:"each",defaultType:"line"},
  ],
  plumber: [
    {key:"tap",    label:"Tap / mixer",       unit:"each",defaultType:"point"},
    {key:"toilet", label:"Toilet (WC)",       unit:"each",defaultType:"point"},
    {key:"basin",  label:"Basin",             unit:"each",defaultType:"point"},
    {key:"shower", label:"Shower",            unit:"each",defaultType:"point"},
    {key:"hwu",    label:"Hot water unit",    unit:"each",defaultType:"point"},
    {key:"pipe",   label:"Pipe run",          unit:"m",   defaultType:"line"},
    {key:"drain",  label:"Drain line",        unit:"m",   defaultType:"line"},
  ],
  roofer: [
    {key:"gutter",  label:"Gutter run",       unit:"m",   defaultType:"line"},
    {key:"downpipe",label:"Downpipe",         unit:"each",defaultType:"point"},
    {key:"ridge",   label:"Ridge line",       unit:"m",   defaultType:"line"},
    {key:"valley",  label:"Valley iron",      unit:"m",   defaultType:"line"},
    {key:"skylight",label:"Skylight",         unit:"each",defaultType:"point"},
    {key:"damage",  label:"Damaged area",     unit:"m2",  defaultType:"area"},
  ],
};

/* ═══════════════════════════════════════════════════════════════════
   SPEC: SpatialMeasurementEngine
   AU standard dimensions (metres)
   ═══════════════════════════════════════════════════════════════════ */
const OBJECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  gpo:          { width: 0.115, height: 0.075 },
  light_switch: { width: 0.115, height: 0.075 },
  standard_brick:{ width: 0.230, height: 0.076 },
  door:         { width: 0.810, height: 2.100 },
  tile_600:     { width: 0.600, height: 0.600 },
  tile_300:     { width: 0.300, height: 0.300 },
  ceiling:      { width: 2.400, height: 2.400 },  // room height used as width ref
  custom:       { width: 1.000, height: 1.000 },  // overridden by user
};

class SpatialMeasurementEngine {
  /** Returns pxPerMetre based on measured box width and known object type */
  static calculateCalibrationFactor(objectType: string, measuredWidthPx: number): number {
    const dim = OBJECT_DIMENSIONS[objectType];
    const realWidth = dim?.width ?? 1.0;
    if (realWidth <= 0 || measuredWidthPx <= 0) throw new Error("Invalid dimensions");
    return measuredWidthPx / realWidth;
  }

  /** Returns real-world distance in metres, rounded to nearest cm */
  static calculateLineLength(p1: Pt, p2: Pt, pxPerMetre: number): number {
    if (pxPerMetre <= 0) return 0;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    return Math.round((distPx / pxPerMetre) * 100) / 100;
  }
}

/** Known-size reference objects for calibration */
const REFERENCE_OBJECTS = [
  { key: "door",          label: "Standard door",    icon: DoorOpen,    desc: "Align box to door width",           useWidth: true  },
  { key: "gpo",           label: "Power point (GPO)",icon: Lightbulb,   desc: "Align box to GPO width (115mm)",    useWidth: true  },
  { key: "light_switch",  label: "Light switch",     icon: Lightbulb,   desc: "Align box to switch width (115mm)", useWidth: true  },
  { key: "standard_brick",label: "Brick (standard)", icon: Box,         desc: "Align box to brick width (230mm)",  useWidth: true  },
  { key: "tile_600",      label: "Floor tile 600mm", icon: Grid3x3,     desc: "Align box to tile width (600mm)",   useWidth: true  },
  { key: "tile_300",      label: "Floor tile 300mm", icon: Grid3x3,     desc: "Align box to tile width (300mm)",   useWidth: true  },
  { key: "ceiling",       label: "Room height",      icon: MoveVertical,desc: "Align box to ceiling height",       useWidth: false },
  { key: "custom",        label: "Custom",           icon: Ruler,       desc: "Enter your own dimension",          useWidth: true  },
];

function uid() { return Math.random().toString(36).slice(2, 9); }
function dist(a: Pt, b: Pt) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2); }

/* ═══════════════════════════════════════════════════════════════════
   CAMERA PAGE
   ═══════════════════════════════════════════════════════════════════ */
function CameraPage() {
  const router = useRouter();
  const params = useSearchParams();
  const trade  = params.get("trade") ?? "electrician";
  const items  = TRADE_ITEMS[trade] ?? TRADE_ITEMS.electrician;

  const videoRef        = useRef<HTMLVideoElement>(null);
  const overlayRef      = useRef<HTMLCanvasElement>(null);
  const snapRef         = useRef<HTMLCanvasElement>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const pendingFrameRef = useRef<string>("");
  const motionRef       = useRef({ beta: 0, gamma: 0, moving: false });
  const fadeRafRef      = useRef<number>(0);

  /* ── Core state ─────────────────────────────────────────────── */
  const [ready,       setReady]       = useState(false);
  const [error,       setCameraError] = useState<string | null>(null);
  const [drawMode,    setDrawMode]    = useState<AnnotationType>("point");
  const [isDrawing,   setIsDrawing]   = useState(false);
  const [curPts,      setCurPts]      = useState<Pt[]>([]);
  const [colourIdx,   setColourIdx]   = useState(0);
  const [showForm,    setShowForm]    = useState(false);
  const [pendingPts,  setPendingPts]  = useState<Pt[]>([]);
  const [formItem,    setFormItem]    = useState(items[0].key);
  const [formQty,     setFormQty]     = useState(1);
  const [formNote,    setFormNote]    = useState("");
  const [formCalcLen, setFormCalcLen] = useState<number | null>(null); // spec: calculatedLengthMeters
  const [review,      setReview]      = useState(false);
  const [stampMode,   setStampMode]   = useState(true);
  const [stampItem,   setStampItem]   = useState<string>(items[0]?.key ?? "dl");
  const [level,       setLevel]       = useState({ beta: 0, gamma: 0, isLevel: false });
  const [showLevel,   setShowLevel]   = useState(true);

  /* ── Spec: RoomSession state ─────────────────────────────────── */
  const [rooms,       setRooms]       = useState<RoomSession[]>([
    { roomId: uid(), roomName: "Room 1", calibration: { objectType: "", pxPerMetre: 0, isCalibrated: false }, annotations: [] }
  ]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");

  // Active room derived state
  const activeRoom = rooms.find(r => r.roomId === activeRoomId) ?? rooms[0];
  const calibration = activeRoom.calibration.isCalibrated ? activeRoom.calibration : null;

  // All annotations flat (for review/finish)
  const allAnnotations = rooms.flatMap(r => r.annotations);

  function addAnnotationToRoom(ann: Annotation) {
    setRooms(prev => prev.map(r =>
      r.roomId === (activeRoom.roomId)
        ? { ...r, annotations: [...r.annotations, ann] }
        : r
    ));
  }

  function setRoomCalibration(roomId: string, cal: RoomCalibration) {
    setRooms(prev => prev.map(r =>
      r.roomId === roomId ? { ...r, calibration: cal } : r
    ));
  }

  function addRoom() {
    const newRoom: RoomSession = {
      roomId: uid(),
      roomName: `Room ${rooms.length + 1}`,
      calibration: { objectType: "", pxPerMetre: 0, isCalibrated: false },
      annotations: [],
    };
    setRooms(prev => [...prev, newRoom]);
    setActiveRoomId(newRoom.roomId);
  }

  /* ── Calibration state ───────────────────────────────────────── */
  const [calibMode,   setCalibMode]   = useState(false);
  const [calibStep,   setCalibStep]   = useState<"pick" | "target" | "confirm">("pick");
  const [calibObj,    setCalibObj]    = useState(REFERENCE_OBJECTS[0]);
  const [calibCustom, setCalibCustom] = useState("");

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
      } catch (e) {
        setCameraError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access denied. Tap the camera icon in your browser address bar to allow."
            : "Could not open camera."
        );
      }
    }
    start();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  /* ── Level sensor ─────────────────────────────────────────────── */
  useEffect(() => {
    async function requestAndListen() {
      const permFn = requestOrientationPermission?.();
      if (permFn) await permFn.catch(() => {});
      function handler(e: DeviceOrientationEvent) {
        const beta  = e.beta  ?? 0;
        const gamma = e.gamma ?? 0;
        motionRef.current = { beta, gamma, moving: Math.abs(beta - motionRef.current.beta) > 2 || Math.abs(gamma - motionRef.current.gamma) > 2 };
        setLevel({ beta, gamma, isLevel: Math.abs(gamma) < 5 && Math.abs(beta - 90) < 5 });
      }
      window.addEventListener("deviceorientation", handler);
      return () => window.removeEventListener("deviceorientation", handler);
    }
    requestAndListen();
  }, []);

  /* ── Canvas resize ─────────────────────────────────────────────── */
  useEffect(() => {
    const v = videoRef.current; const o = overlayRef.current;
    if (!v || !o) return;
    function resize() {
      if (!v || !o) return;
      o.width  = window.innerWidth;
      o.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    const t = setInterval(resize, 500);
    return () => { clearInterval(t); window.removeEventListener("resize", resize); };
  }, []);

  /* ─── Draw overlay ─────────────────────────────────────────────── */
  const drawOverlay = useCallback(() => {
    const o = overlayRef.current; if (!o) return;
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0, 0, o.width, o.height);

    // In-progress line/area
    if (curPts.length > 0) {
      const c = COLOURS[colourIdx % COLOURS.length];
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
      if (drawMode === "line" && curPts.length >= 2) {
        ctx.beginPath(); ctx.moveTo(curPts[0].x, curPts[0].y); ctx.lineTo(curPts[1].x, curPts[1].y); ctx.stroke();
        // Live measurement label
        if (calibration) {
          const liveLen = SpatialMeasurementEngine.calculateLineLength(curPts[0], curPts[1], calibration.pxPerMetre);
          const mx = (curPts[0].x + curPts[1].x) / 2;
          const my = (curPts[0].y + curPts[1].y) / 2;
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(mx - 28, my - 16, 56, 20);
          ctx.fillStyle = "#FFB400"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
          ctx.fillText(`${liveLen}m`, mx, my - 2); ctx.textAlign = "start";
        }
      } else if (drawMode === "area" && curPts.length >= 2) {
        ctx.beginPath(); ctx.moveTo(curPts[0].x, curPts[0].y);
        curPts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Level guide
    if (showLevel) {
      const cx = o.width / 2; const cy = o.height / 2;
      ctx.strokeStyle = level.isLevel ? "#22c55e" : "rgba(255,255,255,.25)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
    }

    // Fading annotations on live feed (just colour dots so tradie sees what's placed)
    activeRoom.annotations.forEach((ann, i) => {
      if (ann.opacity <= 0) return;
      const c = ann.colour;
      ctx.globalAlpha = ann.opacity * 0.6;
      if (ann.points[0]) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(ann.points[0].x, ann.points[0].y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), ann.points[0].x, ann.points[0].y);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      }
      ctx.globalAlpha = 1;
    });
  }, [curPts, drawMode, colourIdx, calibration, showLevel, level, activeRoom.annotations]);

  useEffect(() => {
    if (!ready) return;
    const raf = requestAnimationFrame(function loop() { drawOverlay(); requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(raf);
  }, [ready, drawOverlay]);

  /* ─── Fade-out effect ─────────────────────────────────────────── */
  function startFade(annId: string) {
    let opacity = 1;
    function step() {
      opacity -= 0.02;
      setRooms(prev => prev.map(r => ({
        ...r,
        annotations: r.annotations.map(a =>
          a.id === annId ? { ...a, opacity: Math.max(0, opacity) } : a
        ),
      })));
      if (opacity > 0) { fadeRafRef.current = requestAnimationFrame(step); }
    }
    setTimeout(() => { fadeRafRef.current = requestAnimationFrame(step); }, 1200);
  }

  /* ═══════════════════════════════════════════════════════════════
     TOUCH / MOUSE HANDLERS
     ═══════════════════════════════════════════════════════════════ */
  function canvasPt(e: React.TouchEvent | React.MouseEvent): Pt {
    const o = overlayRef.current!; const r = o.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: cx - r.left, y: cy - r.top };
  }

  function handleStart(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    // Block touch input when calibration target box is showing
    if (calibMode && calibStep === "target") return;
    if (calibMode) return;
    const p = canvasPt(e);
    if (drawMode === "point") { captureAnnotation([p]); return; }
    setIsDrawing(true); setCurPts([p]);
  }

  function handleMove(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault(); if (!isDrawing) return;
    const p = canvasPt(e);
    setCurPts(prev => drawMode === "line" ? [prev[0], p] : [...prev, p]);
  }

  function handleEnd(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault(); if (!isDrawing) return;
    setIsDrawing(false);
    if (drawMode === "line" && curPts.length === 2) captureAnnotation(curPts);
    else if (drawMode === "area" && curPts.length >= 3) captureAnnotation(curPts);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAPTURE FRAME
     ═══════════════════════════════════════════════════════════════ */
  function captureFrame(pts: Pt[]) {
    const v = videoRef.current; const s = snapRef.current; const o = overlayRef.current;
    let fd = "";
    if (v && s && o) {
      s.width = v.videoWidth || o.width; s.height = v.videoHeight || o.height;
      const ctx = s.getContext("2d")!;
      ctx.drawImage(v, 0, 0, s.width, s.height);
      const sx = s.width / o.width; const sy = s.height / o.height;
      const colour = COLOURS[colourIdx % COLOURS.length];
      ctx.fillStyle = colour; ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(3, s.width / 200);
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6;

      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x * sx, pts[0].y * sy, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();
        ctx.fillStyle = "#000"; ctx.font = `bold ${Math.max(14, s.width / 60)}px system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(allAnnotations.length + 1), pts[0].x * sx, pts[0].y * sy);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      } else if (pts.length === 2) {
        ctx.strokeStyle = colour; ctx.lineWidth = Math.max(4, s.width / 200); ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.moveTo(pts[0].x * sx, pts[0].y * sy); ctx.lineTo(pts[1].x * sx, pts[1].y * sy); ctx.stroke();
        [pts[0], pts[1]].forEach(p => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 8, 0, Math.PI * 2); ctx.fill(); });
        // Arrow
        const angle = Math.atan2((pts[1].y - pts[0].y) * sy, (pts[1].x - pts[0].x) * sx);
        const ex = pts[1].x * sx; const ey = pts[1].y * sy; const al = 20;
        ctx.fillStyle = colour; ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - al * Math.cos(angle - 0.4), ey - al * Math.sin(angle - 0.4));
        ctx.lineTo(ex - al * Math.cos(angle + 0.4), ey - al * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fill();
        // Spec: draw measurement label on frame
        if (calibration) {
          const calcLen = SpatialMeasurementEngine.calculateLineLength(pts[0], pts[1], calibration.pxPerMetre);
          const mx = ((pts[0].x + pts[1].x) / 2) * sx;
          const my = ((pts[0].y + pts[1].y) / 2) * sy;
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(mx - 35, my - 18, 70, 22);
          ctx.fillStyle = "#FFB400"; ctx.font = `bold ${Math.max(12, s.width / 80)}px system-ui`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(`~${calcLen}m`, mx, my - 7);
          ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        }
      } else if (pts.length >= 3) {
        ctx.globalAlpha = 0.25; ctx.fillStyle = colour;
        ctx.beginPath(); ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
        pts.slice(1).forEach(p => ctx.lineTo(p.x * sx, p.y * sy)); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = colour; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
        pts.slice(1).forEach(p => ctx.lineTo(p.x * sx, p.y * sy)); ctx.closePath(); ctx.stroke();
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
  function quickCommit(pts: Pt[], itemKey: string) {
    const fd  = captureFrame(pts);
    const def = items.find(i => i.key === itemKey) ?? items[0];
    let qty = 1;
    let calcLen: number | null = null;
    if (def.unit === "m" && calibration && pts.length === 2) {
      calcLen = SpatialMeasurementEngine.calculateLineLength(pts[0], pts[1], calibration.pxPerMetre);
      qty = calcLen;
    }
    const ann: Annotation = {
      id: uid(), type: def.defaultType as AnnotationType, points: pts,
      label: def.label, itemKey, qty, calculatedLength: calcLen, unit: def.unit,
      note: "", length: calcLen ?? undefined,
      frameData: fd, colour: COLOURS[colourIdx % COLOURS.length],
      opacity: 1, fading: false,
    };
    addAnnotationToRoom(ann);
    setColourIdx(i => (i + 1) % COLOURS.length);
    startFade(ann.id);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAPTURE ANNOTATION
     ═══════════════════════════════════════════════════════════════ */
  function captureAnnotation(pts: Pt[]) {
    if (stampMode) { quickCommit(pts, stampItem); return; }
    captureFrame(pts);

    // Spec: calculatedLengthMeters from engine
    let calcLen: number | null = null;
    if (calibration && drawMode === "line" && pts.length === 2) {
      calcLen = SpatialMeasurementEngine.calculateLineLength(pts[0], pts[1], calibration.pxPerMetre);
    }
    const def = items.find(i => i.defaultType === drawMode) ?? items[0];
    setFormItem(def.key);
    setFormQty(calcLen ?? 1);     // spec: pre-fill with calculated length
    setFormCalcLen(calcLen);
    setFormNote("");
    setPendingPts(pts); setCurPts([]); setShowForm(true);
  }

  function commitAnnotation() {
    const def = items.find(i => i.key === formItem) ?? items[0];
    const ann: Annotation = {
      id: uid(), type: drawMode, points: pendingPts,
      label: def.label, itemKey: formItem,
      qty: formQty,               // spec: userConfirmedLengthMeters (tradie may have edited)
      calculatedLength: formCalcLen,
      unit: def.unit, note: formNote,
      length: formCalcLen ?? undefined,
      frameData: pendingFrameRef.current,
      colour: COLOURS[colourIdx % COLOURS.length],
      opacity: 1, fading: false,
    };
    addAnnotationToRoom(ann);
    setColourIdx(i => (i + 1) % COLOURS.length);
    setShowForm(false); setPendingPts([]);
    startFade(ann.id);
  }

  /* ═══════════════════════════════════════════════════════════════
     SPEC: Calibration with fixed target box
     ═══════════════════════════════════════════════════════════════ */
  function startCalibration() {
    setCalibMode(true);
    setCalibStep("pick");
  }

  function selectCalibObj(obj: typeof REFERENCE_OBJECTS[0]) {
    setCalibObj(obj);
    setCalibStep("target");   // show fixed target box
  }

  function lockAndCalibrate() {
    // Spec: read bounding box width from the fixed overlay box
    const o = overlayRef.current;
    if (!o) return;

    if (calibObj.key === "custom") {
      setCalibStep("confirm");
      return;
    }

    // Fixed box is 60% of screen width, centred
    const boxWidthPx = o.width * 0.60;
    try {
      const pxPerMetre = SpatialMeasurementEngine.calculateCalibrationFactor(calibObj.key, boxWidthPx);
      setRoomCalibration(activeRoom.roomId, {
        objectType: calibObj.key,
        pxPerMetre,
        isCalibrated: true,
      });
      setCalibMode(false); setCalibStep("pick");
    } catch {
      // Fall through -- invalid
    }
  }

  function commitCustomCalib() {
    const real = parseFloat(calibCustom);
    if (isNaN(real) || real <= 0) return;
    const o = overlayRef.current;
    if (!o) return;
    const boxWidthPx = o.width * 0.60;
    const pxPerMetre = boxWidthPx / real;
    setRoomCalibration(activeRoom.roomId, { objectType: "custom", pxPerMetre, isCalibrated: true });
    setCalibMode(false); setCalibStep("pick"); setCalibCustom("");
  }

  /* ═══════════════════════════════════════════════════════════════
     FINISH
     ═══════════════════════════════════════════════════════════════ */
  function finish() {
    sessionStorage.setItem("liveAnnotations", JSON.stringify(allAnnotations));
    sessionStorage.setItem("liveAnnotationMeta", JSON.stringify(
      allAnnotations.map(ann => ({
        id: ann.id, type: ann.type, label: ann.label, itemKey: ann.itemKey,
        qty: ann.qty, unit: ann.unit, note: ann.note, length: ann.length,
        colour: ann.colour, frameData: ann.frameData,
        calculatedLength: ann.calculatedLength,
        roomName: rooms.find(r => r.annotations.some(a => a.id === ann.id))?.roomName,
      }))
    ));
    router.back();
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER: Error
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

  /* ═══════════════════════════════════════════════════════════════
     RENDER: Review screen
     ═══════════════════════════════════════════════════════════════ */
  if (review) return (
    <div className="min-h-screen bg-[#f8f9fa] p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-[16px]">{allAnnotations.length} annotation{allAnnotations.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setReview(false)} className="text-sm font-bold text-blue-600">Back to camera</button>
      </div>

      {/* Room grouping */}
      {rooms.filter(r => r.annotations.length > 0).map(room => (
        <div key={room.roomId} className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-[13px] text-[#0a1722]">{room.roomName}</span>
            {room.calibration.isCalibrated && (
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Calibrated</span>
            )}
          </div>
          <div className="space-y-2">
            {room.annotations.map((ann, i) => (
              <div key={ann.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                {ann.frameData && <img src={ann.frameData} alt="" className="w-16 h-12 object-cover rounded-xl shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ann.colour }} />
                    <p className="font-bold text-[13px] truncate">{ann.label}</p>
                  </div>
                  <p className="text-[12px] text-gray-500">
                    {ann.qty} {ann.unit}
                    {ann.calculatedLength != null && ann.qty !== ann.calculatedLength && (
                      <span className="text-gray-400"> (calc: {ann.calculatedLength}m)</span>
                    )}
                    {ann.note ? ` · ${ann.note}` : ""}
                  </p>
                </div>
                <button onClick={() => setRooms(prev => prev.map(r =>
                  r.roomId === room.roomId ? { ...r, annotations: r.annotations.filter((_, j) => j !== i) } : r
                ))} className="text-red-400 p-1"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {allAnnotations.length > 0
        ? <button onClick={finish} className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold py-4 rounded-xl flex items-center justify-center gap-2">
            <Check size={16} /> Add {allAnnotations.length} item{allAnnotations.length !== 1 ? "s" : ""} to quote
          </button>
        : <p className="text-center text-gray-400 text-sm">No annotations yet.</p>
      }
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     RENDER: Camera view
     ═══════════════════════════════════════════════════════════════ */
  // Spec: if not calibrated, show lock screen (can still skip)
  const isLocked = !calibration && !stampMode;

  // Fixed calibration target box dimensions
  // Aspect ratio matches selected object: width:height
  const objDim = OBJECT_DIMENSIONS[calibObj.key] ?? { width: 1, height: 0.5 };
  const targetAspect = calibObj.useWidth ? (objDim.width / objDim.height) : (objDim.height / objDim.width);
  const targetW = "60vw";
  const targetH = `calc(60vw / ${targetAspect})`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <canvas ref={snapRef} className="hidden" />
      <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <canvas
        ref={overlayRef}
        onMouseDown={!calibMode ? handleStart : undefined}
        onMouseMove={!calibMode ? handleMove : undefined}
        onMouseUp={!calibMode ? handleEnd : undefined}
        onTouchStart={!calibMode ? handleStart : undefined}
        onTouchMove={!calibMode ? handleMove : undefined}
        onTouchEnd={!calibMode ? handleEnd : undefined}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", touchAction: "none" }}
      />

      {/* ═══ TOP BAR ════════════════════════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0 z-10" style={{ padding: "12px 16px", background: "linear-gradient(to bottom,rgba(0,0,0,.7),transparent)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: "pulse 1s infinite" }} />
            <span className="text-white text-[12px] font-bold">LIVE</span>

            {/* Room selector */}
            <div className="flex gap-1">
              {rooms.map(r => (
                <button key={r.roomId}
                  onClick={() => setActiveRoomId(r.roomId)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border-0"
                  style={{
                    background: (activeRoom.roomId === r.roomId) ? "#ffb400" : "rgba(0,0,0,.4)",
                    color: (activeRoom.roomId === r.roomId) ? "#0a1722" : "white",
                  }}>
                  {r.roomName}
                  {r.calibration.isCalibrated && " ✓"}
                  {r.annotations.length > 0 && ` (${r.annotations.length})`}
                </button>
              ))}
              <button onClick={addRoom} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 text-white border-0">
                + Room
              </button>
            </div>

            {allAnnotations.length > 0 && (
              <span className="text-[#ffb400] text-[11px] font-bold bg-black/40 px-2 py-0.5 rounded-full">{allAnnotations.length} saved</span>
            )}
            {level.isLevel && showLevel && (
              <span className="text-green-400 text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crosshair size={9} /> LEVEL
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowLevel(v => !v)}
              className="text-white p-1.5 rounded-lg border-0"
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

      {/* ═══ SPEC: Fixed calibration target box (calibStep === "target") ═══ */}
      {calibMode && calibStep === "target" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ pointerEvents: "none" }}>
          {/* Semi-transparent overlay with hole */}
          <div className="absolute inset-0 bg-black/50" />

          {/* The target box -- clear hole in overlay */}
          <div className="relative z-10" style={{
            width: targetW, height: targetH,
            border: "3px solid #00FF88",
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}>
            {/* Corner markers */}
            {[["top-0 left-0 border-t-4 border-l-4",""],["top-0 right-0 border-t-4 border-r-4",""],
              ["bottom-0 left-0 border-b-4 border-l-4",""],["bottom-0 right-0 border-b-4 border-r-4",""]].map(([cls],i) => (
              <div key={i} className={`absolute ${cls} border-[#00FF88] w-5 h-5`} />
            ))}
            {/* Object label inside box */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                {calibObj.label}
                {calibObj.key !== "custom" && (
                  <span className="ml-1 text-[#00FF88]">
                    {OBJECT_DIMENSIONS[calibObj.key]?.width >= 1
                      ? `${OBJECT_DIMENSIONS[calibObj.key]?.width}m`
                      : `${Math.round((OBJECT_DIMENSIONS[calibObj.key]?.width ?? 0) * 1000)}mm`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Instruction text below box */}
          <div className="absolute bottom-48 left-0 right-0 flex flex-col items-center gap-2" style={{ pointerEvents: "none" }}>
            <div className="bg-black/70 text-white text-[12px] font-bold px-4 py-2 rounded-full text-center mx-4">
              Position the box over the {calibObj.label.toLowerCase()} then tap Lock
            </div>
            {/* Spec: Angle safeguard warning */}
            <div className="flex items-center gap-1.5 bg-black/60 text-amber-400 text-[11px] font-semibold px-3 py-1.5 rounded-full">
              <AlertTriangle size={12} />
              Stand directly square to the wall. Do not capture at an acute angle.
            </div>
          </div>
        </div>
      )}

      {/* Lock & Calibrate button (shown when target box is active) */}
      {calibMode && calibStep === "target" && (
        <div className="absolute bottom-44 left-0 right-0 z-30 flex justify-center gap-3">
          <button onClick={lockAndCalibrate}
            className="bg-[#00FF88] text-black font-extrabold text-[14px] px-8 py-3 rounded-full border-0 flex items-center gap-2">
            <Check size={15} /> Lock & Calibrate
          </button>
          <button onClick={() => { setCalibMode(false); setCalibStep("pick"); }}
            className="bg-black/60 text-white font-bold text-[13px] px-5 py-3 rounded-full border-0">
            Cancel
          </button>
        </div>
      )}

      {/* ═══ BOTTOM TOOLBAR ════════════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0 z-10"
        style={{ padding: "12px 16px calc(80px + env(safe-area-inset-bottom))", background: "linear-gradient(to top,rgba(0,0,0,.8),transparent)" }}>

        {/* Locked overlay -- must calibrate first (non-stamp mode) */}
        {isLocked && (
          <div className="mb-3 flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-xl px-3 py-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-amber-300 text-[11px] font-semibold">Calibrate this room before measuring lengths</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1.5">
            {(["point", "line", "area"] as AnnotationType[]).map(m => {
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
              style={{ background: calibration ? "rgba(34,197,94,.6)" : "rgba(0,0,0,.4)", color: "white" }}>
              <Ruler size={11} />
              {calibMode ? "Calibrating..." : calibration ? "Recalibrate" : "Calibrate"}
            </button>
            {allAnnotations.length > 0 && (
              <button onClick={() => {
                const lastRoom = [...rooms].reverse().find(r => r.annotations.length > 0);
                if (!lastRoom) return;
                setRooms(prev => prev.map(r =>
                  r.roomId === lastRoom.roomId ? { ...r, annotations: r.annotations.slice(0, -1) } : r
                ));
              }} className="text-white p-1.5 rounded-lg bg-black/40 border-0">
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

      {/* ═══ CALIBRATION: Pick object ═══════════════════════════════ */}
      {calibMode && calibStep === "pick" && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-end">
          <div className="bg-white rounded-t-3xl p-5 w-full max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-[16px]">Calibrate {activeRoom.roomName}</p>
              <button onClick={() => { setCalibMode(false); setCalibStep("pick"); }} className="bg-none border-0 p-1"><X size={18} /></button>
            </div>
            <p className="text-[12.5px] text-gray-500 mb-4">
              Point at a known object and select it. A target box will appear that you align to the object, then tap Lock.
            </p>
            {/* Spec: angle warning */}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <p className="text-[12px] text-amber-700 font-semibold">
                For accurate measurements: stand directly square to the wall. Do not capture at an acute angle.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {REFERENCE_OBJECTS.map(obj => {
                const Icon = obj.icon;
                const dim = OBJECT_DIMENSIONS[obj.key];
                return (
                  <button key={obj.key} onClick={() => selectCalibObj(obj)}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                    style={{ borderColor: calibObj.key === obj.key ? "#0a1722" : "#e5e7eb" }}>
                    <div className="w-10 h-10 rounded-xl bg-[#0a1722] flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#ffb400]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-[14px]">{obj.label}</p>
                      <p className="text-[12px] text-gray-500">{obj.desc}</p>
                    </div>
                    {obj.key !== "custom" && dim && (
                      <span className="text-[12px] font-bold text-[#0a1722] bg-gray-100 px-2 py-1 rounded-lg shrink-0">
                        {dim.width >= 1 ? `${dim.width}m` : `${Math.round(dim.width * 1000)}mm`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CALIBRATION: Custom dimension entry ══════════════════════ */}
      {calibMode && calibStep === "confirm" && calibObj.key === "custom" && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
            <p className="font-bold text-[15px] mb-1">Enter real measurement</p>
            <p className="text-[12px] text-gray-500 mb-3">
              How many metres wide is the object inside the target box?
            </p>
            <input type="number" step="0.01" min="0.01" value={calibCustom}
              onChange={e => setCalibCustom(e.target.value)}
              placeholder="e.g. 2.4" autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[14px] mb-3" />
            <div className="flex gap-2">
              <button onClick={commitCustomCalib} disabled={!calibCustom}
                className="flex-1 bg-[#0a1722] text-white font-bold py-2.5 rounded-lg border-0">
                Set calibration
              </button>
              <button onClick={() => { setCalibStep("pick"); }}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-lg border-0">
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SPEC: Annotation form with editable length output ══════════ */}
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
                {/* Spec: editable output -- tradie can override calculated length */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setFormQty(q => Math.max(0.5, q - 1))} className="border border-gray-200 rounded-lg p-1.5 bg-white"><Minus size={12} /></button>
                  <input type="number" min={0.1} step={0.1} value={formQty}
                    onChange={e => setFormQty(Number(e.target.value))}
                    className="flex-1 text-center border-2 rounded-lg py-1.5 text-[15px] font-bold"
                    style={{ borderColor: formCalcLen != null ? "#22c55e" : "#e5e7eb" }} />
                  <button onClick={() => setFormQty(q => q + 1)} className="border border-gray-200 rounded-lg p-1.5 bg-white"><Plus size={12} /></button>
                </div>
                {/* Spec: show calculated value and allow override */}
                {formCalcLen != null && (
                  <div className="flex items-center gap-1 mt-1">
                    <Check size={10} className="text-green-500" />
                    <p className="text-[10px] text-green-600 font-semibold">
                      Calculated: {formCalcLen}m. Edit above if needed.
                    </p>
                  </div>
                )}
                {formCalcLen == null && drawMode === "line" && !calibration && (
                  <p className="text-[10px] text-amber-500 mt-1 font-semibold">
                    Calibrate this room for auto-measurement
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">Note (optional)</p>
                <input value={formNote} onChange={e => setFormNote(e.target.value)}
                  placeholder="e.g. kitchen ceiling"
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
