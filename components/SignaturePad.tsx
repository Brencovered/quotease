"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/**
 * A minimal canvas signature pad - deliberately not a new npm dependency.
 * Draws with pointer events (works for touch, mouse and pen alike) and
 * exports a base64 PNG data URL on submit.
 */
export default function SignaturePad({
  onSubmit,
  submitLabel = "Confirm signature",
  disabled = false,
}: {
  onSubmit: (dataUrl: string) => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Size the canvas's internal pixel buffer to match its displayed size at
  // devicePixelRatio, so signatures aren't blurry on retina screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0a1722";
    }
  }, []);

  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    lastPoint.current = getPoint(e);
    setHasSignature(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPoint.current) return;
    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
  };

  const stopDrawing = () => {
    drawing.current = false;
    lastPoint.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    onSubmit(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <div className="border-2 border-dashed border-[#d5dce1] rounded-xl bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
      {!hasSignature && (
        <p className="text-[12px] text-[#8a9ba8] mt-1.5">Sign above with your finger or mouse</p>
      )}
      <div className="flex gap-3 mt-3">
        <button
          type="button"
          onClick={clear}
          disabled={!hasSignature || disabled}
          className="text-[13px] font-semibold text-[#5a6a78] disabled:opacity-40 px-3 py-2"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!hasSignature || disabled}
          className="flex-1 bg-[#ffb400] text-[#0a1722] font-extrabold text-[14px] px-6 py-3 rounded-xl disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
