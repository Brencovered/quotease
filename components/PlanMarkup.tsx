"use client";

import { useState, useRef } from "react";
import { X, Trash2, ListPlus, Check } from "lucide-react";

export type PlanAnnotation = { id: string; x: number; y: number; text: string };

export default function PlanMarkup({
  imageUrl,
  annotations,
  onAnnotationsChange,
  onAddToChecklist,
}: {
  imageUrl: string;
  annotations: PlanAnnotation[];
  onAnnotationsChange: (next: PlanAnnotation[]) => void;
  onAddToChecklist?: (text: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = `pin_${Date.now()}`;
    onAnnotationsChange([...annotations, { id, x, y, text: "" }]);
    setOpenId(id);
  }

  function updateText(id: string, text: string) {
    onAnnotationsChange(annotations.map((a) => (a.id === id ? { ...a, text } : a)));
  }

  function removeAnnotation(id: string) {
    onAnnotationsChange(annotations.filter((a) => a.id !== id));
    if (openId === id) setOpenId(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        Click anywhere on the plan to drop a pin and add a note - new GPO here, switchboard location, that kind of thing.
      </p>
      <div
        ref={imgRef}
        onClick={handleImageClick}
        className="relative w-full rounded-xl overflow-hidden border border-[var(--line)] cursor-crosshair bg-[var(--app-bg)]"
        style={{ touchAction: "manipulation" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Plan" className="w-full h-auto block pointer-events-none select-none" draggable={false} />
        {annotations.map((a, i) => (
          <div
            key={a.id}
            className="absolute"
            style={{ left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%, -50%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenId(openId === a.id ? null : a.id)}
              className="w-7 h-7 rounded-full bg-[var(--amber)] text-[var(--navy)] font-bold text-[12px] flex items-center justify-center shadow-md border-2 border-white"
            >
              {i + 1}
            </button>
            {openId === a.id && (
              <div
                className="absolute z-20 top-9 left-1/2 -translate-x-1/2 w-56 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Pin {i + 1}</span>
                  <button onClick={() => setOpenId(null)} className="text-[var(--ink-faint)]"><X size={14} /></button>
                </div>
                <textarea
                  autoFocus
                  value={a.text}
                  onChange={(e) => updateText(a.id, e.target.value)}
                  placeholder="What's here?"
                  rows={2}
                  className="app-field text-[13px] mb-2"
                />
                <div className="flex items-center gap-2">
                  {onAddToChecklist && (
                    <button
                      onClick={() => { if (a.text.trim()) { onAddToChecklist(a.text.trim()); setOpenId(null); } }}
                      disabled={!a.text.trim()}
                      className="btn-secondary text-[11.5px] py-1.5 px-2.5 flex-1"
                    >
                      <ListPlus size={12} /> Add to checklist
                    </button>
                  )}
                  <button onClick={() => removeAnnotation(a.id)} className="text-[var(--red)] p-1.5">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {annotations.length > 0 && (
        <div className="space-y-1.5">
          {annotations.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="w-5 h-5 rounded-full bg-[var(--amber)] text-[var(--navy)] font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-[var(--ink-soft)] flex-1 truncate">{a.text || <em className="text-[var(--ink-faint)]">No note yet</em>}</span>
              {a.text.trim() && <Check size={13} className="text-[var(--green)] shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
