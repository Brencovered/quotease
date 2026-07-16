"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin, Ruler, Pencil, RotateCcw, X, Check, Minus, Plus,
  ChevronRight, MoveHorizontal, Crosshair,
  DoorOpen, Box, Grid3x3, Lightbulb, MoveVertical, AlertTriangle, StickyNote,
} from "lucide-react";
import { Suspense } from "react";

/* ─── Types ─────────────────────────────────────────────────────── */
type AnnotationType = "point" | "line" | "area" | "note";
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

/* ─── Spec: CatalogItem -- maps to MaterialRow from price book ───── */
interface CatalogItem {
  item_key:   string;
  name:       string;     // display label
  unitType:   "meter" | "per_unit";
  unitPrice:  number;     // from price book unit_cost
  baseFee:    number;     // fixed component (default 0)
}

/* ─── Spec: PricingEngine ─────────────────────────────────────────── */
class PricingEngine {
  static generateLineItems(
    roomName: string,
    annotations: Annotation[],
    catalog: Record<string, CatalogItem>
  ): QuoteLineItem[] {
    const lineItems: QuoteLineItem[] = [];

    // Group annotations by itemKey
    const grouped: Record<string, Annotation[]> = {};
    for (const ann of annotations) {
      const key = ann.itemKey;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ann);
    }

    for (const [itemKey, items] of Object.entries(grouped)) {
      const config = catalog[itemKey];
      if (!config) continue;

      let quantity = 0;
      if (config.unitType === "meter") {
        // Spec: prioritise userConfirmedLengthMeters (qty) over calculatedLength
        quantity = items.reduce((sum, item) => sum + item.qty, 0);
        quantity = Math.round(quantity * 10) / 10;
      } else {
        quantity = items.length;
      }

      // Spec: (quantity * unitPrice) + baseFee, rounded to 2dp
      const subtotal = Math.round(((quantity * config.unitPrice) + config.baseFee) * 100) / 100;

      lineItems.push({ id: uid(), roomName, catalogItemName: config.name, quantity, unitType: config.unitType, subtotal });
    }

    return lineItems;
  }
}

/* ─── QuoteLineItem (spec) ────────────────────────────────────────── */
interface QuoteLineItem {
  id:              string;
  roomName:        string;
  catalogItemName: string;
  quantity:        number;
  unitType:        "meter" | "per_unit";
  subtotal:        number;
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
    {key:"dl",      label:"Downlight",         unit:"each",defaultType:"point"},
    {key:"gpo",     label:"Power point (GPO)",  unit:"each",defaultType:"point"},
    {key:"switch",  label:"Switch",             unit:"each",defaultType:"point"},
    {key:"data",    label:"Data point",         unit:"each",defaultType:"point"},
    {key:"exhaust", label:"Exhaust fan",        unit:"each",defaultType:"point"},
    {key:"smoke",   label:"Smoke alarm",        unit:"each",defaultType:"point"},
    {key:"cable",   label:"Cable run",          unit:"m",   defaultType:"line"},
    {key:"conduit", label:"Conduit run",        unit:"m",   defaultType:"line"},
    {key:"sb",      label:"Switchboard",        unit:"each",defaultType:"point"},
    {key:"circuit", label:"New circuit",        unit:"each",defaultType:"line"},
  ],
  plumber: [
    {key:"tap",       label:"Tap / mixer",        unit:"each",defaultType:"point"},
    {key:"toilet",    label:"Toilet (WC)",         unit:"each",defaultType:"point"},
    {key:"basin",     label:"Basin",               unit:"each",defaultType:"point"},
    {key:"shower",    label:"Shower",              unit:"each",defaultType:"point"},
    {key:"bath",      label:"Bath",                unit:"each",defaultType:"point"},
    {key:"hwu",       label:"Hot water unit",      unit:"each",defaultType:"point"},
    {key:"pipe_cold", label:"Cold water pipe",     unit:"m",   defaultType:"line"},
    {key:"pipe_hot",  label:"Hot water pipe",      unit:"m",   defaultType:"line"},
    {key:"pipe_waste",label:"Waste / drain pipe",  unit:"m",   defaultType:"line"},
    {key:"gas_pipe",  label:"Gas pipe run",        unit:"m",   defaultType:"line"},
    {key:"gas_point", label:"Gas point",           unit:"each",defaultType:"point"},
    {key:"slab_pen",  label:"Slab penetration",    unit:"each",defaultType:"point"},
    {key:"floor_waste",label:"Floor waste",        unit:"each",defaultType:"point"},
  ],
  roofer: [
    {key:"gutter",    label:"Gutter run",          unit:"m",   defaultType:"line"},
    {key:"downpipe",  label:"Downpipe",            unit:"m",   defaultType:"line"},
    {key:"ridge",     label:"Ridge capping",       unit:"m",   defaultType:"line"},
    {key:"valley",    label:"Valley iron",         unit:"m",   defaultType:"line"},
    {key:"fascia",    label:"Fascia board",        unit:"m",   defaultType:"line"},
    {key:"skylight",  label:"Skylight",            unit:"each",defaultType:"point"},
    {key:"whirlybird",label:"Whirlybird",          unit:"each",defaultType:"point"},
    {key:"roof_area", label:"Roof section",        unit:"m2",  defaultType:"area"},
    {key:"damage",    label:"Damaged area",        unit:"m2",  defaultType:"area"},
    {key:"flashing",  label:"Flashing run",        unit:"m",   defaultType:"line"},
  ],
  carpenter: [
    {key:"wall_frame",  label:"Wall frame",          unit:"m",   defaultType:"line"},
    {key:"stud",        label:"Stud wall (height)",  unit:"m",   defaultType:"line"},
    {key:"door",        label:"Door opening",        unit:"each",defaultType:"point"},
    {key:"window",      label:"Window opening",      unit:"each",defaultType:"point"},
    {key:"skirting",    label:"Skirting board",      unit:"m",   defaultType:"line"},
    {key:"architrave",  label:"Architrave",          unit:"m",   defaultType:"line"},
    {key:"decking",     label:"Decking run",         unit:"m",   defaultType:"line"},
    {key:"deck_area",   label:"Deck area",           unit:"m2",  defaultType:"area"},
    {key:"shelf",       label:"Shelving run",        unit:"m",   defaultType:"line"},
    {key:"robe",        label:"Robe / wardrobe",     unit:"each",defaultType:"point"},
    {key:"fascia",      label:"Fascia / barge",      unit:"m",   defaultType:"line"},
    {key:"ceiling_h",   label:"Ceiling height mark", unit:"m",   defaultType:"line"},
  ],
  painter: [
    {key:"wall_area",   label:"Wall area",           unit:"m2",  defaultType:"area"},
    {key:"ceiling",     label:"Ceiling area",        unit:"m2",  defaultType:"area"},
    {key:"door_paint",  label:"Door (paint)",        unit:"each",defaultType:"point"},
    {key:"window_paint",label:"Window frame",        unit:"each",defaultType:"point"},
    {key:"skirting_p",  label:"Skirting (paint)",    unit:"m",   defaultType:"line"},
    {key:"feature_wall",label:"Feature wall",        unit:"m2",  defaultType:"area"},
    {key:"ext_wall",    label:"External wall area",  unit:"m2",  defaultType:"area"},
  ],
  tiler: [
    {key:"floor_tile",  label:"Floor tile area",     unit:"m2",  defaultType:"area"},
    {key:"wall_tile",   label:"Wall tile area",      unit:"m2",  defaultType:"area"},
    {key:"wet_area",    label:"Wet area",            unit:"m2",  defaultType:"area"},
    {key:"grout_run",   label:"Grout line run",      unit:"m",   defaultType:"line"},
    {key:"trim_tile",   label:"Trim / edge tile",    unit:"m",   defaultType:"line"},
    {key:"shower_niche",label:"Shower niche",        unit:"each",defaultType:"point"},
  ],
  landscaper: [
    {key:"lawn_area",   label:"Lawn area",           unit:"m2",  defaultType:"area"},
    {key:"garden_bed",  label:"Garden bed",          unit:"m2",  defaultType:"area"},
    {key:"paving",      label:"Paving area",         unit:"m2",  defaultType:"area"},
    {key:"retaining",   label:"Retaining wall",      unit:"m",   defaultType:"line"},
    {key:"edging",      label:"Edging / border",     unit:"m",   defaultType:"line"},
    {key:"irrigation",  label:"Irrigation line",     unit:"m",   defaultType:"line"},
    {key:"tree",        label:"Tree",                unit:"each",defaultType:"point"},
    {key:"drain_ag",    label:"AG drain run",        unit:"m",   defaultType:"line"},
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

  // Load price book from sessionStorage (set by QuoteBuilder before navigating here)
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("swiftscope_price_book");
      if (!raw) return;
      const lib: { item_key: string; label: string; unit_cost: number; base_fee?: number }[] = JSON.parse(raw);
      const map: Record<string, CatalogItem> = {};
      for (const row of lib) {
        // Map price book item_key to annotation itemKey
        // e.g. pp->gpo, dl_standard->dl, sw->switch, etc.
        const aliases: Record<string, string> = {
          // Electrician
          pp: "gpo", sw: "switch", dl_standard: "dl", dl_builder: "dl",
          dl_premium: "dl", exhaust_ceiling: "exhaust", exhaust_ducted: "exhaust",
          cable_2_5: "cable", cable_1_5: "cable", cable_4: "cable",
          cable_6: "cable", cable_10: "cable",
          data: "data", nbn: "data", smoke: "smoke",
          appliance: "circuit", sb_rcd: "sb", sb_rcbo_full: "sb",
          // Plumber
          pipe_run: "pipe_cold", drain_line: "pipe_waste",
          // Carpenter
          framing_lm: "wall_frame", stud_lm: "stud", skirting_lm: "skirting",
          architrave_lm: "architrave", decking_lm: "decking",
          door_internal: "door", door_external: "door",
          // Roofer
          gutter_lm: "gutter", downpipe_lm: "downpipe", ridge_lm: "ridge",
          valley_lm: "valley", fascia_lm: "fascia",
          colorbond_sqm: "roof_area", terracotta_sqm: "roof_area",
        };
        const key = aliases[row.item_key] ?? row.item_key;
        const isLinear = ["cable","conduit","pipe","drain","gutter","ridge","valley"].includes(key);
        if (!map[key]) {
          map[key] = {
            item_key: key,
            name:     row.label,
            unitType: isLinear ? "meter" : "per_unit",
            unitPrice: row.unit_cost,
            baseFee:  row.base_fee ?? 0,
          };
        }
      }
      setCatalog(map);
    } catch {}
  }, []);

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
  const [formIsNote,  setFormIsNote]  = useState(false);
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

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState("");

  const ROOM_PRESETS = [
    "Kitchen","Living room","Master bedroom","Bedroom 2","Bedroom 3",
    "Bathroom","Ensuite","Laundry","Garage","Study","Hallway",
    "Exterior - Front","Exterior - Rear","Exterior - Side","Roof","Under floor",
  ];

  function addRoom() {
    const newRoom: RoomSession = {
      roomId: uid(),
      roomName: `Room ${rooms.length + 1}`,
      calibration: { objectType: "", pxPerMetre: 0, isCalibrated: false },
      annotations: [],
    };
    setRooms(prev => [...prev, newRoom]);
    setActiveRoomId(newRoom.roomId);
    // Immediately open rename for new room
    setEditingRoomId(newRoom.roomId);
    setEditingRoomName(newRoom.roomName);
  }

  function renameRoom(roomId: string, name: string) {
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, roomName: name } : r));
    setEditingRoomId(null);
  }

  /* ── Calibration state ───────────────────────────────────────── */
  const [calibMode,   setCalibMode]   = useState(false);
  const [calibStep,   setCalibStep]   = useState<"pick" | "target" | "confirm">("pick");
  const [calibObj,    setCalibObj]    = useState(REFERENCE_OBJECTS[0]);
  const [calibCustom, setCalibCustom] = useState("");
  // Box size as a fraction of screen width - user-adjustable (see
  // selectCalibObj/resizeCalibBox) instead of the fixed 60% it used to be.
  // A small reference object like a GPO (115mm) at a comfortable standing
  // distance only fills a small fraction of the frame - forcing the box to
  // always be 60vw meant walking right up to the wall to make it fit,
  // which then leaves almost no field of view left to actually mark up
  // anything else in the room.
  const [calibBoxFrac, setCalibBoxFrac] = useState(0.6);

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
      if (drawMode === "line" && curPts.length === 1) {
        // Waiting for the second tap - show exactly where the start point
        // landed (a drag would have this covered by the finger the whole
        // time) plus a hint of what to do next.
        ctx.setLineDash([]);
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(curPts[0].x, curPts[0].y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.font = "bold 13px system-ui";
        const hint = "Tap the end point";
        const hw = ctx.measureText(hint).width;
        ctx.fillStyle = "rgba(0,0,0,.75)";
        ctx.fillRect(curPts[0].x - hw / 2 - 10, curPts[0].y - 42, hw + 20, 26);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(hint, curPts[0].x, curPts[0].y - 29);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      } else if (drawMode === "line" && curPts.length >= 2) {
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
      } else if ((drawMode === "area" || drawMode === "note") && curPts.length >= 2) {
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
    activeRoom.annotations.forEach((ann) => {
      if (ann.opacity <= 0) return;
      const c = ann.colour;
      ctx.globalAlpha = ann.opacity * 0.6;
      if (ann.points[0]) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(ann.points[0].x, ann.points[0].y, 8, 0, Math.PI * 2); ctx.fill();
        // Short label tag next to the dot (not inside it - a real label
        // like "Cold water pipe" doesn't fit in an 8px circle). By this
        // point the annotation is already fully committed, so its real
        // label is always known here - never a placeholder count.
        ctx.fillStyle = "rgba(0,0,0,.7)";
        ctx.font = "bold 11px system-ui";
        const lw = Math.min(ctx.measureText(ann.label).width + 10, 160);
        ctx.fillRect(ann.points[0].x + 10, ann.points[0].y - 10, lw, 20);
        ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(ann.label, ann.points[0].x + 15, ann.points[0].y, 150);
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
    if (drawMode === "line") {
      if (curPts.length === 0) {
        // First tap: mark the start point only, then wait for a second,
        // separate tap to place the end point. Dragging a finger across
        // the screen to draw a cable/pipe run means the fingertip itself
        // covers the exact point being placed the whole time - two
        // independent taps let the person actually see where each end
        // lands before committing to it.
        setCurPts([p]);
        return;
      }
      const line = [curPts[0], p];
      setCurPts([]);
      captureAnnotation(line);
      return;
    }
    setIsDrawing(true); setCurPts([p]);
  }

  function handleMove(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault(); if (!isDrawing) return;
    const p = canvasPt(e);
    setCurPts(prev => [...prev, p]);
  }

  function handleEnd(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault(); if (!isDrawing) return;
    setIsDrawing(false);
    if (drawMode === "area" && curPts.length >= 3) captureAnnotation(curPts);
    // Note mode accepts either gesture: a plain tap (curPts stays a single
    // point, since handleMove never added more) or a traced zone (3+
    // points) - "mark an area or a section and drop a note" covers both.
    else if (drawMode === "note" && curPts.length >= 1) captureAnnotation(curPts);
  }

  /* ═══════════════════════════════════════════════════════════════
     CAPTURE FRAME
     ═══════════════════════════════════════════════════════════════ */
  function captureFrame(pts: Pt[], label?: string) {
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
        if (label) {
          // Stamp mode: the item is already chosen at capture time, so
          // bake its real name onto the photo (e.g. "Downlight") instead
          // of a meaningless running count. For the manual flow the item
          // isn't picked until after this frame is captured (the form
          // comes up next), so there's deliberately no text baked in here
          // for that path - nothing to show yet that wouldn't be wrong.
          const fontSize = Math.max(13, s.width / 70);
          ctx.font = `bold ${fontSize}px system-ui`;
          const padding = 10;
          const textWidth = ctx.measureText(label).width;
          const tagX = pts[0].x * sx + 24;
          const tagY = pts[0].y * sy - fontSize;
          ctx.fillStyle = "rgba(0,0,0,.75)";
          ctx.fillRect(tagX, tagY, textWidth + padding * 2, fontSize + 12);
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(label, tagX + padding, tagY + (fontSize + 12) / 2);
          ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
        }
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
    const def = items.find(i => i.key === itemKey) ?? items[0];
    const fd  = captureFrame(pts, def.label);
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
    if (drawMode === "note") {
      captureFrame(pts);
      setFormNote("");
      setPendingPts(pts); setCurPts([]); setShowForm(true);
      return;
    }
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
    setFormIsNote(false);
    setPendingPts(pts); setCurPts([]); setShowForm(true);
  }

  function commitAnnotation() {
    if (drawMode === "note" || formIsNote) {
      // Deliberately not tied to a material or a cost: itemKey "__note__"
      // never matches any catalog item, so PricingEngine.generateLineItems
      // silently skips it (same as any unrecognised key), and
      // LiveSiteAnnotation filters it out before building the priced
      // review table too. It still gets a photo and still shows up in
      // the site survey report - purely informational.
      //
      // type stays as the actual gesture used (point/line/area), not
      // hardcoded to "note" - formIsNote lets someone trace an Area (or
      // draw a Line, or drop a Point) and still opt out of pricing
      // without needing to have pre-selected the dedicated Note mode
      // from the toolbar first.
      const text = formNote.trim();
      if (!text) return;
      const ann: Annotation = {
        id: uid(), type: drawMode, points: pendingPts,
        label: text, itemKey: "__note__",
        qty: 0, calculatedLength: null,
        unit: "", note: text,
        frameData: pendingFrameRef.current,
        colour: COLOURS[colourIdx % COLOURS.length],
        opacity: 1, fading: false,
      };
      addAnnotationToRoom(ann);
      setColourIdx(i => (i + 1) % COLOURS.length);
      setShowForm(false); setPendingPts([]); setFormNote(""); setFormIsNote(false);
      startFade(ann.id);
      return;
    }
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
    // Sensible starting size per object - small objects (GPO, switch,
    // brick, tile) start with a small box since they're small in real
    // life; door/ceiling start bigger. Just a starting point - the +/-
    // buttons on the target screen let a tradie fine-tune it to whatever
    // size the object actually appears at their current distance.
    const SMALL_OBJECTS = ["gpo", "light_switch", "standard_brick", "tile_300"];
    setCalibBoxFrac(SMALL_OBJECTS.includes(obj.key) ? 0.22 : obj.key === "custom" ? 0.4 : 0.5);
    setCalibStep("target");   // show adjustable target box
  }

  function lockAndCalibrate() {
    // Spec: read bounding box width from the fixed overlay box
    const o = overlayRef.current;
    if (!o) return;

    if (calibObj.key === "custom") {
      setCalibStep("confirm");
      return;
    }

    // Box width in px reflects whatever size the user has adjusted it to
    const boxWidthPx = o.width * calibBoxFrac;
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
    const boxWidthPx = o.width * calibBoxFrac;
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
        <button onClick={() => router.push("/quote")} className="bg-[#0a1722] text-white font-bold px-6 py-3 rounded-xl">Go back</button>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     RENDER: Review screen
     ═══════════════════════════════════════════════════════════════ */
  if (review) {
    // Build line items per room using PricingEngine
    const hasCatalog = Object.keys(catalog).length > 0;
    const allLineItems = rooms.flatMap(r =>
      PricingEngine.generateLineItems(r.roomName, r.annotations, catalog)
    );
    const grandTotal = Math.round(allLineItems.reduce((s, li) => s + li.subtotal, 0) * 100) / 100;

    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        {/* Header */}
        <div className="bg-[#0a1722] px-4 pt-12 pb-5">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setReview(false)} className="text-white/60 text-sm font-bold bg-white/10 px-3 py-1.5 rounded-full border-0">
              Back to camera
            </button>
            <button onClick={finish} className="bg-[#ffb400] text-[#0a1722] font-extrabold text-[13px] px-5 py-2 rounded-full border-0 flex items-center gap-1.5">
              <Check size={14} /> Add to quote
            </button>
          </div>
          <div className="mt-4">
            <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-0.5">
              {allAnnotations.length} item{allAnnotations.length !== 1 ? "s" : ""} across {rooms.filter(r => r.annotations.length > 0).length} space{rooms.filter(r => r.annotations.length > 0).length !== 1 ? "s" : ""}
            </p>
            {hasCatalog ? (
              <div className="font-display text-[3rem] leading-none text-[#ffb400]">
                ${grandTotal.toLocaleString()}
              </div>
            ) : (
              <p className="text-white/40 text-[13px]">
                Connect your price book in Settings to see live pricing
              </p>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {rooms.filter(r => r.annotations.length > 0).map(room => {
            const roomLineItems = PricingEngine.generateLineItems(room.roomName, room.annotations, catalog);
            const roomTotal = Math.round(roomLineItems.reduce((s, li) => s + li.subtotal, 0) * 100) / 100;

            return (
              <div key={room.roomId} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {/* Room header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px] text-[#0a1722]">{room.roomName}</span>
                    {room.calibration.isCalibrated && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Calibrated</span>
                    )}
                  </div>
                  {hasCatalog && roomTotal > 0 && (
                    <span className="font-bold text-[14px] text-[#0a1722]">${roomTotal.toLocaleString()}</span>
                  )}
                </div>

                {/* Priced line items (editable subtotals -- spec Option B) */}
                {hasCatalog && roomLineItems.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {roomLineItems.map(li => (
                      <div key={li.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[13px] text-[#0a1722]">{li.catalogItemName}</p>
                          <p className="text-[11.5px] text-gray-400">
                            {li.quantity} {li.unitType === "meter" ? "m" : "×"}
                          </p>
                        </div>
                        {/* Spec: inline editable subtotal override */}
                        <div className="flex items-center gap-1">
                          <span className="text-[12px] text-gray-400">$</span>
                          <input
                            type="number"
                            defaultValue={li.subtotal}
                            onBlur={e => {
                              // Update the annotation quantities to reflect the override
                              const newTotal = parseFloat(e.target.value);
                              if (!isNaN(newTotal) && newTotal !== li.subtotal) {
                                // Store override in annotation note for now
                                // Full implementation would update annotation qty proportionally
                              }
                            }}
                            className="w-20 text-right font-bold text-[14px] text-[#0a1722] border border-gray-200 rounded-lg px-2 py-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Annotations list */}
                <div className="divide-y divide-gray-50">
                  {room.annotations.map((ann, i) => (
                    <div key={ann.id} className="flex items-center gap-3 px-4 py-2.5">
                      {ann.frameData && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ann.frameData} alt="" className="w-12 h-9 object-cover rounded-lg shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ann.colour }} />
                          <p className="font-semibold text-[13px] text-[#0a1722] truncate">{ann.label}</p>
                        </div>
                        <p className="text-[11.5px] text-gray-400 ml-3.5">
                          {ann.qty} {ann.unit}
                          {ann.length != null && ` · ~${ann.length}m`}
                          {ann.note ? ` · ${ann.note}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setRooms(prev => prev.map(r =>
                          r.roomId === room.roomId ? { ...r, annotations: r.annotations.filter((_, j) => j !== i) } : r
                        ))}
                        className="text-red-300 hover:text-red-500 p-1 border-0 bg-transparent"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {allAnnotations.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-[15px] font-semibold mb-1">No annotations yet</p>
              <p className="text-[13px]">Go back and tap or draw on the camera view</p>
            </div>
          )}

          {allAnnotations.length > 0 && (
            <button onClick={finish}
              className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold py-4 rounded-xl border-0 flex items-center justify-center gap-2 text-[16px]">
              <Check size={16} /> Add {allAnnotations.length} item{allAnnotations.length !== 1 ? "s" : ""} to quote
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER: Camera view
     ═══════════════════════════════════════════════════════════════ */
  // Spec: if not calibrated, show lock screen (can still skip)
  const isLocked = !calibration && !stampMode;

  // Calibration target box dimensions - width is user-adjustable
  // (calibBoxFrac), aspect ratio matches the selected object: width:height
  const objDim = OBJECT_DIMENSIONS[calibObj.key] ?? { width: 1, height: 0.5 };
  const targetAspect = calibObj.useWidth ? (objDim.width / objDim.height) : (objDim.height / objDim.width);
  const targetW = `${calibBoxFrac * 100}vw`;
  const targetH = `calc(${calibBoxFrac * 100}vw / ${targetAspect})`;

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
            <div className="flex gap-1 flex-wrap">
              {rooms.map(r => (
                <button key={r.roomId}
                  onClick={() => {
                    setActiveRoomId(r.roomId);
                    setEditingRoomId(r.roomId);
                    setEditingRoomName(r.roomName);
                  }}
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
            <button onClick={() => router.push("/quote")} className="text-white p-1.5 rounded-lg bg-black/40 border-0">
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

          {/* Resize controls - grow/shrink the box to match the object's
              size at whatever distance the tradie is standing, instead of
              forcing them to walk up to the wall to fit a fixed-size box */}
          <div className="absolute z-20 flex items-center gap-3" style={{ pointerEvents: "auto", bottom: "16rem", left: 0, right: 0, justifyContent: "center" }}>
            <button
              onClick={() => setCalibBoxFrac((f) => Math.max(0.08, Math.round((f - 0.04) * 100) / 100))}
              className="w-11 h-11 rounded-full bg-black/70 border-2 border-[#00FF88] flex items-center justify-center text-[#00FF88]"
              aria-label="Shrink box"
            >
              <Minus size={18} />
            </button>
            <span className="bg-black/70 text-white text-[11px] font-bold px-3 py-1.5 rounded-full">Resize box</span>
            <button
              onClick={() => setCalibBoxFrac((f) => Math.min(0.92, Math.round((f + 0.04) * 100) / 100))}
              className="w-11 h-11 rounded-full bg-black/70 border-2 border-[#00FF88] flex items-center justify-center text-[#00FF88]"
              aria-label="Grow box"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Instruction text below box */}
          <div className="absolute bottom-48 left-0 right-0 flex flex-col items-center gap-2" style={{ pointerEvents: "none" }}>
            <div className="bg-black/70 text-white text-[12px] font-bold px-4 py-2 rounded-full text-center mx-4">
              Resize the box to match the {calibObj.label.toLowerCase()}&apos;s size, then tap Lock
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
            {(["point", "line", "area", "note"] as AnnotationType[]).map(m => {
              const Icon = m === "point" ? MapPin : m === "line" ? Ruler : m === "area" ? Pencil : StickyNote;
              const label = m === "point" ? "Tap" : m === "line" ? "Line" : m === "area" ? "Area" : "Note";
              return (
                <button key={m} onClick={() => { setDrawMode(m); setCurPts([]); }}
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
              <p className="font-bold text-[15px]">{(drawMode === "note" || formIsNote) ? "What's the note?" : "What is this?"}</p>
              <button onClick={() => { setShowForm(false); setPendingPts([]); setCurPts([]); setFormNote(""); setFormIsNote(false); }} className="border-0 bg-none p-1"><X size={17} /></button>
            </div>

            {(drawMode === "note" || formIsNote) ? (
              <>
                <p className="text-[12px] text-gray-500 mb-2">
                  Not tied to a material or cost - just shows up in the site report against this spot.
                </p>
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder="e.g. Client wants extra power here, confirm on site. Possible asbestos - check before cutting."
                  rows={4}
                  autoFocus
                  className="w-full border-2 border-gray-200 focus:border-[#0a1722] rounded-xl px-3 py-2.5 text-[14px] mb-3 resize-none"
                />
                <button onClick={commitAnnotation} disabled={!formNote.trim()}
                  className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl border-0 flex items-center justify-center gap-1.5 disabled:opacity-40">
                  <Check size={15} /> Add note
                </button>
                {drawMode !== "note" && (
                  <button onClick={() => setFormIsNote(false)} className="w-full text-center text-[12.5px] font-semibold text-gray-400 py-2 mt-1 border-0 bg-none">
                    Back to picking a material
                  </button>
                )}
              </>
            ) : (
              <>
            {drawMode !== "point" && (
              <button onClick={() => setFormIsNote(true)} className="w-full text-left text-[12.5px] font-semibold text-[#0a1722] underline underline-offset-2 mb-3 border-0 bg-none p-0">
                Just a note here - no material or cost
              </button>
            )}
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
                {formCalcLen != null && (items.find(i => i.key === formItem)?.unit === "m") && (
                  <div className="flex items-start gap-1 mt-1">
                    <AlertTriangle size={10} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-600 font-semibold leading-tight">
                      Cable/pipe length accuracy depends on camera distance. Verify on site.
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
              <Check size={15} /> Add to markup
            </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Colour dot */}
      <div className="absolute top-14 right-4 w-3.5 h-3.5 rounded-full border-2 border-white"
        style={{ background: COLOURS[colourIdx % COLOURS.length] }} />

      {/* ═══ Room rename overlay ══════════════════════════════════════ */}
      {editingRoomId && (
        <div className="absolute inset-0 z-30 bg-black/60 flex items-end">
          <div className="bg-white rounded-t-3xl p-5 w-full">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-[15px]">Name this space</p>
              <button onClick={() => setEditingRoomId(null)} className="border-0 bg-none p-1"><X size={17} /></button>
            </div>
            <input
              value={editingRoomName}
              onChange={e => setEditingRoomName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") renameRoom(editingRoomId, editingRoomName || "Room"); }}
              placeholder="e.g. Kitchen, Bedroom 2, Exterior..."
              className="w-full border-2 border-[#0a1722] rounded-xl px-3 py-2.5 text-[15px] font-semibold mb-3"
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 mb-4 max-h-28 overflow-y-auto">
              {ROOM_PRESETS.map(preset => (
                <button key={preset}
                  onClick={() => setEditingRoomName(preset)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full border-0"
                  style={{
                    background: editingRoomName === preset ? "#0a1722" : "#f3f4f6",
                    color: editingRoomName === preset ? "white" : "#374151",
                  }}>
                  {preset}
                </button>
              ))}
            </div>
            <button
              onClick={() => renameRoom(editingRoomId, editingRoomName || "Room")}
              className="w-full bg-[#ffb400] text-[#0a1722] font-extrabold text-[15px] py-3.5 rounded-xl border-0">
              Set name
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CameraPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[13.5px] text-[var(--ink-faint)]">Loading...</div>}>
      <CameraPage />
    </Suspense>
  );
}
