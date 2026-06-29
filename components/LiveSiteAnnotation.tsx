"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera, X, Check, Plus, Ruler, MapPin, Minus,
  ChevronRight, Pencil, RotateCcw, ZoomIn,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type AnnotationType = "point" | "line" | "area";

interface Point { x: number; y: number; }

interface Annotation {
  id:         string;
  type:       AnnotationType;
  points:     Point[];          // 1 point for point, 2 for line, 3+ for area
  label:      string;
  itemKey:    string;
  qty:        number;
  unit:       string;
  note:       string;
  length?:    number;           // real-world length in metres (calibrated)
  frameData:  string;           // base64 snapshot of the frame + overlay
  colour:     string;
}

interface CalibrationData {
  pixelLength: number;          // pixels between the two calibration points
  realLength:  number;          // metres the tradie entered
  pxPerMetre:  number;
}

// ── Trade item definitions ─────────────────────────────────────────────────

const TRADE_ITEMS: Record<string, { key: string; label: string; unit: string; defaultType: AnnotationType }[]> = {
  electrician: [
    { key: "dl",       label: "Downlight",         unit: "each", defaultType: "point" },
    { key: "gpo",      label: "Power point (GPO)",  unit: "each", defaultType: "point" },
    { key: "switch",   label: "Switch",             unit: "each", defaultType: "point" },
    { key: "data",     label: "Data point",         unit: "each", defaultType: "point" },
    { key: "exhaust",  label: "Exhaust fan",        unit: "each", defaultType: "point" },
    { key: "smoke",    label: "Smoke alarm",        unit: "each", defaultType: "point" },
    { key: "cable",    label: "Cable run",          unit: "m",    defaultType: "line"  },
    { key: "conduit",  label: "Conduit run",        unit: "m",    defaultType: "line"  },
    { key: "sb",       label: "Switchboard",        unit: "each", defaultType: "point" },
    { key: "circuit",  label: "New circuit",        unit: "each", defaultType: "line"  },
    { key: "zone",     label: "Work zone",          unit: "lot",  defaultType: "area"  },
  ],
  plumber: [
    { key: "tap",      label: "Tap / mixer",        unit: "each", defaultType: "point" },
    { key: "toilet",   label: "Toilet (WC)",        unit: "each", defaultType: "point" },
    { key: "basin",    label: "Basin",              unit: "each", defaultType: "point" },
    { key: "shower",   label: "Shower",             unit: "each", defaultType: "point" },
    { key: "hwu",      label: "Hot water unit",     unit: "each", defaultType: "point" },
    { key: "pipe",     label: "Pipe run",           unit: "m",    defaultType: "line"  },
    { key: "drain",    label: "Drain line",         unit: "m",    defaultType: "line"  },
    { key: "gas",      label: "Gas point",          unit: "each", defaultType: "point" },
    { key: "zone",     label: "Work zone",          unit: "lot",  defaultType: "area"  },
  ],
  roofer: [
    { key: "gutter",   label: "Gutter run",         unit: "m",    defaultType: "line"  },
    { key: "downpipe", label: "Downpipe",           unit: "each", defaultType: "point" },
    { key: "ridge",    label: "Ridge line",         unit: "m",    defaultType: "line"  },
    { key: "valley",   label: "Valley iron",        unit: "m",    defaultType: "line"  },
    { key: "skylight", label: "Skylight",           unit: "each", defaultType: "point" },
    { key: "whirly",   label: "Whirlybird",         unit: "each", defaultType: "point" },
    { key: "damage",   label: "Damaged area",       unit: "m2",   defaultType: "area"  },
    { key: "section",  label: "Roof section",       unit: "m2",   defaultType: "area"  },
  ],
  carpenter: [
    { key: "door",     label: "Door opening",       unit: "each", defaultType: "point" },
    { key: "window",   label: "Window opening",     unit: "each", defaultType: "point" },
    { key: "wall",     label: "Stud wall",          unit: "m",    defaultType: "line"  },
    { key: "deck",     label: "Deck area",          unit: "m2",   defaultType: "area"  },
    { key: "shelving", label: "Shelving run",       unit: "m",    defaultType: "line"  },
    { key: "bulkhead", label: "Bulkhead",           unit: "m",    defaultType: "line"  },
    { key: "skirting", label: "Skirting board",     unit: "m",    defaultType: "line"  },
  ],
};

const DEFAULT_ITEMS = [
  { key: "item",     label: "Work item",          unit: "each", defaultType: "point" as AnnotationType },
  { key: "run",      label: "Line / run",         unit: "m",    defaultType: "line"  as AnnotationType },
  { key: "area",     label: "Area",               unit: "m2",   defaultType: "area"  as AnnotationType },
];

const ANNOTATION_COLOURS = [
  "#FFB400","#EF4444","#3B82F6","#10B981","#8B5CF6","#F97316",
];

function uid() { return Math.random().toString(36).slice(2, 9); }

function dist(a: Point, b: Point) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LiveSiteAnnotation({
  trade,
  onAddLineItems,
}: {
  trade:          string;
  onAddLineItems: (items: { description: string; quantity: number; unit: string; notes: string }[]) => void;
}) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const overlayRef     = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);

  const [mode,          setMode]          = useState<"idle" | "camera" | "review">("idle");
  const [cameraError,   setCameraError]   = useState<string | null>(null);

  // Drawing state
  const [drawMode,      setDrawMode]      = useState<AnnotationType>("point");
  const [isDrawing,     setIsDrawing]     = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Calibration
  const [calibMode,     setCalibMode]     = useState(false);
  const [calibPoints,   setCalibPoints]   = useState<Point[]>([]);
  const [calibration,   setCalibration]   = useState<CalibrationData | null>(null);
  const [calibInput,    setCalibInput]    = useState("");
  const [showCalibForm, setShowCalibForm] = useState(false);

  // Annotations
  const [annotations,   setAnnotations]   = useState<Annotation[]>([]);
  const [colourIdx,     setColourIdx]     = useState(0);

  // Annotation form
  const [showForm,      setShowForm]      = useState(false);
  const [pendingPoints, setPendingPoints] = useState<Point[]>([]);
  const [formItem,      setFormItem]      = useState("");
  const [formQty,       setFormQty]       = useState(1);
  const [formNote,      setFormNote]      = useState("");
  const [formLength,    setFormLength]    = useState<number | null>(null);

  const items = TRADE_ITEMS[trade] ?? DEFAULT_ITEMS;

  // ── Camera ──────────────────────────────────────────────────────────────

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");
    } catch (err) {
      setCameraError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access in your browser settings."
          : "Could not open camera. Try refreshing the page."
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Lock body scroll when camera is open
  useEffect(() => {
    if (mode === "camera") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mode]);

  // ── Canvas sizing ────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== "camera") return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    function resize() {
      if (!video || !overlay) return;
      overlay.width  = window.innerWidth;
      overlay.height = window.innerHeight;
    }

    video.addEventListener("loadedmetadata", resize);
    window.addEventListener("resize", resize);
    resize();
    return () => {
      video.removeEventListener("loadedmetadata", resize);
      window.removeEventListener("resize", resize);
    };
  }, [mode]);

  // ── Draw overlay (live canvas redraw) ────────────────────────────────────

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw committed annotations
    for (const ann of annotations) {
      drawAnnotation(ctx, ann, ann.colour, false);
    }

    // Draw in-progress shape
    if (currentPoints.length > 0) {
      drawInProgress(ctx, currentPoints, drawMode, ANNOTATION_COLOURS[colourIdx % ANNOTATION_COLOURS.length]);
    }

    // Draw calibration points
    if (calibMode && calibPoints.length > 0) {
      ctx.strokeStyle = "#00FF88";
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 4]);
      for (const p of calibPoints) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
      }
      if (calibPoints.length === 2) {
        ctx.beginPath(); ctx.moveTo(calibPoints[0].x, calibPoints[0].y);
        ctx.lineTo(calibPoints[1].x, calibPoints[1].y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [annotations, currentPoints, drawMode, colourIdx, calibMode, calibPoints]);

  useEffect(() => {
    if (mode !== "camera") return;
    const raf = requestAnimationFrame(function loop() {
      drawOverlay();
      requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [mode, drawOverlay]);

  // ── Touch / mouse input ──────────────────────────────────────────────────

  function canvasPoint(e: React.TouchEvent | React.MouseEvent): Point {
    const canvas = overlayRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handleStart(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    const p = canvasPoint(e);

    if (calibMode) {
      const next = [...calibPoints, p];
      setCalibPoints(next);
      if (next.length === 2) {
        setShowCalibForm(true);
      }
      return;
    }

    if (drawMode === "point") {
      // Points are committed immediately on tap
      captureAnnotation([p]);
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([p]);
  }

  function handleMove(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    const p = canvasPoint(e);
    setCurrentPoints((prev) => {
      if (drawMode === "line") return [prev[0], p];
      return [...prev, p]; // area: track all points
    });
  }

  function handleEnd(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);

    if (drawMode === "line" && currentPoints.length === 2) {
      captureAnnotation(currentPoints);
    } else if (drawMode === "area" && currentPoints.length >= 3) {
      captureAnnotation(currentPoints);
    }
  }

  // ── Capture a frame + open annotation form ───────────────────────────────

  function captureAnnotation(points: Point[]) {
    // Snapshot the current video frame + overlay
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!video || !canvas || !overlay) return;

    canvas.width  = video.videoWidth  || overlay.width;
    canvas.height = video.videoHeight || overlay.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Scale overlay coords to video resolution
    const scaleX = canvas.width  / overlay.width;
    const scaleY = canvas.height / overlay.height;
    const scaledPoints = points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));

    // Draw the annotation shape onto the snapshot
    const colour = ANNOTATION_COLOURS[colourIdx % ANNOTATION_COLOURS.length];
    drawAnnotation(ctx, { points: scaledPoints, type: drawMode } as Annotation, colour, true);

    const frameData = canvas.toDataURL("image/jpeg", 0.85);

    // Calculate real-world length if calibrated and it's a line
    let autoLength: number | null = null;
    if (calibration && drawMode === "line" && points.length === 2) {
      const px = dist(points[0], points[1]);
      autoLength = Math.round((px / calibration.pxPerMetre) * 100) / 100;
    }

    setPendingPoints(points);
    setFormLength(autoLength);

    // Pre-select first item for this draw mode
    const defaultItem = items.find((i) => i.defaultType === drawMode) ?? items[0];
    setFormItem(defaultItem.key);
    setFormQty(autoLength ?? 1);
    setFormNote("");
    setShowForm(true);
    setCurrentPoints([]);
  }

  // ── Commit annotation from form ──────────────────────────────────────────

  function commitAnnotation() {
    if (!formItem) return;
    const itemDef  = items.find((i) => i.key === formItem) ?? items[0];
    const colour   = ANNOTATION_COLOURS[colourIdx % ANNOTATION_COLOURS.length];

    // Capture a clean snapshot with the annotation drawn
    const video   = videoRef.current;
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    let frameData = "";
    if (video && canvas && overlay) {
      canvas.width  = video.videoWidth  || overlay.width;
      canvas.height = video.videoHeight || overlay.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const scaleX = canvas.width / overlay.width;
      const scaleY = canvas.height / overlay.height;
      const sp = pendingPoints.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
      drawAnnotation(ctx, { points: sp, type: drawMode, label: itemDef.label } as Annotation, colour, true);
      frameData = canvas.toDataURL("image/jpeg", 0.85);
    }

    const ann: Annotation = {
      id:        uid(),
      type:      drawMode,
      points:    pendingPoints,
      label:     itemDef.label,
      itemKey:   formItem,
      qty:       formQty,
      unit:      itemDef.unit,
      note:      formNote,
      length:    formLength ?? undefined,
      frameData,
      colour,
    };

    setAnnotations((prev) => [...prev, ann]);
    setColourIdx((i) => (i + 1) % ANNOTATION_COLOURS.length);
    setShowForm(false);
    setPendingPoints([]);
  }

  // ── Calibration commit ───────────────────────────────────────────────────

  function commitCalibration() {
    const real = parseFloat(calibInput);
    if (!calibPoints[0] || !calibPoints[1] || isNaN(real) || real <= 0) return;
    const px = dist(calibPoints[0], calibPoints[1]);
    setCalibration({ pixelLength: px, realLength: real, pxPerMetre: px / real });
    setCalibMode(false);
    setCalibPoints([]);
    setShowCalibForm(false);
    setCalibInput("");
  }

  // ── Review: push to quote ────────────────────────────────────────────────

  function finishAndAddToQuote() {
    const lineItems = annotations.map((ann) => {
      const lengthNote = ann.length != null ? ` (${ann.length}m estimated)` : "";
      return {
        description: ann.label,
        quantity:    ann.qty,
        unit:        ann.unit,
        notes:       [ann.note, lengthNote].filter(Boolean).join(" — "),
      };
    });
    onAddLineItems(lineItems);
    // Reset
    setAnnotations([]);
    setMode("idle");
    stopCamera();
  }

  // ── Draw helpers ─────────────────────────────────────────────────────────

  function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Pick<Annotation,"points"|"type"|"label">, colour: string, showLabel: boolean) {
    ctx.strokeStyle = colour;
    ctx.fillStyle   = colour;
    ctx.lineWidth   = 3;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur  = 4;

    if (ann.type === "point" && ann.points[0]) {
      ctx.beginPath();
      ctx.arc(ann.points[0].x, ann.points[0].y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.stroke();
      if (showLabel && "label" in ann && ann.label) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px system-ui";
        ctx.fillText(ann.label, ann.points[0].x + 14, ann.points[0].y + 5);
      }
    } else if (ann.type === "line" && ann.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      ctx.lineTo(ann.points[ann.points.length - 1].x, ann.points[ann.points.length - 1].y);
      ctx.stroke();
      // End caps
      for (const p of [ann.points[0], ann.points[ann.points.length - 1]]) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      if (showLabel && "label" in ann && ann.label) {
        ctx.shadowBlur = 0;
        const mx = (ann.points[0].x + ann.points[ann.points.length - 1].x) / 2;
        const my = (ann.points[0].y + ann.points[ann.points.length - 1].y) / 2;
        ctx.fillStyle = colour;
        ctx.fillRect(mx - 2, my - 16, ctx.measureText(ann.label).width + 8, 20);
        ctx.fillStyle = "#000";
        ctx.font = "bold 12px system-ui";
        ctx.fillText(ann.label, mx + 2, my - 2);
      }
    } else if (ann.type === "area" && ann.points.length >= 3) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (const p of ann.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      for (const p of ann.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath(); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawInProgress(ctx: CanvasRenderingContext2D, pts: Point[], type: AnnotationType, colour: string) {
    ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    if (type === "line" && pts.length >= 2) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
    } else if (type === "area" && pts.length >= 2) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // ── RENDER: Idle ─────────────────────────────────────────────────────────

  if (mode === "idle") {
    return (
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-[var(--navy)] rounded-xl flex items-center justify-center shrink-0">
            <Camera size={18} className="text-[var(--amber)]" />
          </div>
          <div>
            <p className="font-bold text-[14px] text-[var(--ink)]">Live site annotation</p>
            <p className="text-[12.5px] text-[var(--ink-faint)]">
              Open your camera, tap or draw on the live view to mark up items, then add them to your quote.
            </p>
          </div>
        </div>

        {cameraError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-[12.5px] text-red-700 font-semibold">{cameraError}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4 text-[11.5px] text-[var(--ink-faint)]">
          <div className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
            <MapPin size={16} className="mx-auto text-[var(--amber)] mb-1" />
            <p className="font-semibold">Tap</p>
            <p>Drop a pin on an item</p>
          </div>
          <div className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
            <Ruler size={16} className="mx-auto text-[var(--amber)] mb-1" />
            <p className="font-semibold">Draw line</p>
            <p>Mark a run or pipe</p>
          </div>
          <div className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
            <ZoomIn size={16} className="mx-auto text-[var(--amber)] mb-1" />
            <p className="font-semibold">Draw area</p>
            <p>Mark a zone or section</p>
          </div>
        </div>

        <button onClick={startCamera} className="btn-primary w-full justify-center">
          <Camera size={15} /> Open camera
        </button>
      </div>
    );
  }

  // ── RENDER: Review ───────────────────────────────────────────────────────

  if (mode === "review") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-[14px] text-[var(--ink)]">{annotations.length} annotation{annotations.length !== 1 ? "s" : ""} — review before adding</p>
          <button onClick={() => { setMode("camera"); startCamera(); }} className="btn-secondary text-[12px] py-1.5 px-3">
            Back to camera
          </button>
        </div>

        <div className="space-y-2">
          {annotations.map((ann, i) => (
            <div key={ann.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                {ann.frameData && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ann.frameData} alt="site annotation" className="w-20 h-14 object-cover rounded-xl shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ann.colour }} />
                    <p className="font-bold text-[13px] text-[var(--ink)] truncate">{ann.label}</p>
                  </div>
                  <p className="text-[12px] text-[var(--ink-soft)]">
                    {ann.qty} {ann.unit}
                    {ann.length != null && ` · ~${ann.length}m`}
                    {ann.note && ` · ${ann.note}`}
                  </p>
                </div>
                <button onClick={() => setAnnotations((prev) => prev.filter((_, j) => j !== i))}
                  className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1 shrink-0">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {annotations.length > 0 ? (
          <button onClick={finishAndAddToQuote} className="btn-primary w-full justify-center">
            <Check size={14} /> Add {annotations.length} item{annotations.length !== 1 ? "s" : ""} to quote
          </button>
        ) : (
          <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-3">No annotations. Go back and mark up some items.</p>
        )}
      </div>
    );
  }

  // ── RENDER: Camera ───────────────────────────────────────────────────────

  const currentColour = ANNOTATION_COLOURS[colourIdx % ANNOTATION_COLOURS.length];
  const currentItem = items.find((i) => i.key === formItem);

  return (
    <div className="fixed inset-0 z-50 bg-black" style={{ touchAction: "none" }}>
      {/* Hidden canvases */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video feed */}
      <video
        ref={videoRef} autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover" style={{ width: "100%", height: "100%" }}
      />

      {/* Drawing overlay */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full touch-none" style={{ width: "100%", height: "100%" }}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        style={{ cursor: drawMode === "point" ? "crosshair" : "crosshair" }}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-[12px] font-bold">LIVE</span>
          {calibration && (
            <span className="text-[10px] text-green-400 font-bold bg-black/40 px-2 py-0.5 rounded-full">
              Calibrated
            </span>
          )}
          {annotations.length > 0 && (
            <span className="text-[11px] text-[var(--amber)] font-bold bg-black/40 px-2 py-0.5 rounded-full">
              {annotations.length} marked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { stopCamera(); setMode("review"); }}
            className="bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1">
            Done <ChevronRight size={12} />
          </button>
          <button onClick={() => { stopCamera(); setMode("idle"); setAnnotations([]); }}
            className="bg-black/40 text-white p-1.5 rounded-lg">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
        {/* Draw mode selector */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {(["point","line","area"] as AnnotationType[]).map((m) => {
              const Icon = m === "point" ? MapPin : m === "line" ? Ruler : Pencil;
              const label = m === "point" ? "Point" : m === "line" ? "Line" : "Area";
              return (
                <button key={m} onClick={() => setDrawMode(m)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${drawMode === m ? "bg-[var(--amber)] text-[var(--navy)]" : "bg-black/40 text-white"}`}>
                  <Icon size={11} /> {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Calibration button */}
            <button onClick={() => { setCalibMode(!calibMode); setCalibPoints([]); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${calibMode ? "bg-green-500 text-white" : "bg-black/40 text-white"}`}>
              <Ruler size={11} /> {calibMode ? "Calibrating..." : "Calibrate"}
            </button>
            {annotations.length > 0 && (
              <button onClick={() => setAnnotations((p) => p.slice(0, -1))}
                className="bg-black/40 text-white p-1.5 rounded-lg">
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Item quick-select strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {items.map((item) => (
            <button key={item.key}
              onClick={() => { setDrawMode(item.defaultType); }}
              className="bg-black/40 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap border border-white/20 flex-shrink-0">
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calibration form overlay */}
      {showCalibForm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-5 mx-4 w-full max-w-xs">
            <p className="font-bold text-[14px] text-[var(--ink)] mb-1">Set reference length</p>
            <p className="text-[12px] text-[var(--ink-faint)] mb-3">How long is the object between your two taps, in metres?</p>
            <input type="number" step="0.01" min="0.01" value={calibInput}
              onChange={(e) => setCalibInput(e.target.value)}
              placeholder="e.g. 2.1 (for a door, 2100mm)"
              className="app-field mb-3 w-full" autoFocus />
            <div className="flex gap-2">
              <button onClick={commitCalibration} disabled={!calibInput}
                className="btn-primary flex-1 justify-center text-[13px] py-2.5">Set</button>
              <button onClick={() => { setShowCalibForm(false); setCalibPoints([]); setCalibMode(false); }}
                className="btn-secondary flex-1 justify-center text-[13px] py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Annotation form overlay */}
      {showForm && (
        <div className="absolute inset-0 flex items-end bg-black/50">
          <div className="bg-white rounded-t-2xl p-4 w-full">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-[14px] text-[var(--ink)]">What is this?</p>
              <button onClick={() => { setShowForm(false); setCurrentPoints([]); }} className="text-[var(--ink-faint)]"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-36 overflow-y-auto">
              {items.map((item) => (
                <button key={item.key} onClick={() => setFormItem(item.key)}
                  className={`text-left px-3 py-2 rounded-xl border text-[12.5px] font-semibold transition-colors ${formItem === item.key ? "border-[var(--navy)] bg-[var(--navy)]/5 text-[var(--navy)]" : "border-[var(--line)] text-[var(--ink)]"}`}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-[11px] text-[var(--ink-faint)] mb-1 font-semibold uppercase tracking-wide">
                  {currentItem?.unit === "m" ? "Length (m)" : currentItem?.unit === "m2" ? "Area (m2)" : "Quantity"}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setFormQty((q) => Math.max(1, q - 1))} className="btn-secondary px-2 py-1.5"><Minus size={12} /></button>
                  <input type="number" min="0.1" step="0.1" value={formQty} onChange={(e) => setFormQty(Number(e.target.value))}
                    className="app-field text-center flex-1 py-1.5 text-[13px]" />
                  <button onClick={() => setFormQty((q) => q + 1)} className="btn-secondary px-2 py-1.5"><Plus size={12} /></button>
                </div>
                {formLength != null && (
                  <p className="text-[10.5px] text-green-600 mt-1">Est. {formLength}m from calibration</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-[var(--ink-faint)] mb-1 font-semibold uppercase tracking-wide">Note (optional)</p>
                <input value={formNote} onChange={(e) => setFormNote(e.target.value)}
                  placeholder="e.g. kitchen ceiling" className="app-field py-1.5 text-[13px] w-full" />
              </div>
            </div>

            <button onClick={commitAnnotation} disabled={!formItem}
              className="btn-primary w-full justify-center">
              <Check size={13} /> Add annotation
            </button>
          </div>
        </div>
      )}

      {/* Colour indicator */}
      <div className="absolute top-12 right-3">
        <div className="w-4 h-4 rounded-full border-2 border-white" style={{ background: currentColour }} />
      </div>
    </div>
  );
}
