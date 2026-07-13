"use client";

import { useEffect, useState } from "react";
import { Camera, Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import DrawingAnalysisReviewTable, {
  type DetectedItem,
  type ReviewLineItem,
} from "@/components/DrawingAnalysisReviewTable";

/**
 * Starting labour-hour estimate per annotation tag, used ONLY to pre-fill
 * the review table's editable "Hrs" column -- the same role the AI's
 * labour_hours estimate plays for drawing takeoff and voice quoting.
 *
 * Pricing must NEVER come from this map. It used to (via a direct
 * item_key -> lib.find lookup), which silently zero-priced every
 * annotation for any business with a real uploaded price book, since
 * price_book_items are UUID-keyed and these tags never match a UUID.
 * Pricing now comes from the tradie's real price book through
 * archetypeDefaults + DrawingAnalysisReviewTable, exactly like drawing
 * analysis and voice quoting, so all three channels stay consistent.
 */
const ANNOTATION_LABOUR_HOURS: Record<string, number> = {
  // Electrician
  dl: 0.4, gpo: 0.4, switch: 0.3, data: 0.5, exhaust: 0.75, smoke: 1.0,
  cable: 0, conduit: 0, sb: 4, circuit: 1.5,
  // Plumber
  tap: 1.0, toilet: 1.5, basin: 1.0, shower: 2.0, bath: 2.5, hwu: 3.0,
  pipe_cold: 0.2, pipe_hot: 0.2, pipe_waste: 0.25, gas_pipe: 0.3, gas_point: 1.5,
  slab_pen: 1.0, floor_waste: 0.5,
  // Roofer
  gutter: 0.2, downpipe: 0.3, ridge: 0.25, valley: 0.3, fascia: 0.2,
  skylight: 4.0, whirlybird: 1.0, roof_area: 0.15, damage: 0.5, flashing: 0.2,
  // Carpenter
  wall_frame: 0.3, stud: 0.25, door: 2.0, window: 1.5, skirting: 0.15,
  architrave: 0.15, decking: 0.3, deck_area: 0.3, shelf: 0.25, robe: 3.0, ceiling_h: 0.1,
};

export default function LiveSiteAnnotation({
  trade,
  lib,
  archetypeDefaults = {},
  onSaveDefault,
  onSaveDraft,
  onAnnotationMeta,
  onAddLineItems,
}: {
  trade: string;
  lib?: { item_key: string; label: string; unit_cost: number }[];
  /** Map "trade:archetype_key" -> price_book item_key from profiles.archetype_defaults.
   *  Same store the drawing-analysis and voice-quoting review tables use,
   *  so a link made from one channel prices the others automatically. */
  archetypeDefaults?: Record<string, string>;
  /** Persist a newly chosen default; fire-and-forget, shared with the
   *  drawing/voice review table's onSaveDefault. */
  onSaveDefault?: (archetypeKey: string, itemKey: string) => void;
  onSaveDraft?: () => void;
  onAnnotationMeta?: (meta: {id:string;label:string;itemKey:string;type:string;qty:number;unit:string;note:string;length?:number;colour:string;frameData:string}[]) => void;
  onAddLineItems: (items: {
    description: string; quantity: number; unit: string;
    notes: string; materialsCost: number; labourHrs: number;
  }[]) => void;
}) {
  const router = useRouter();
  const [pendingItems, setPendingItems] = useState<DetectedItem[]>([]);
  const [added, setAdded] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  // Check for results when page regains focus (after camera page returns)
  useEffect(() => {
    function onFocus() {
      const raw = sessionStorage.getItem("liveAnnotations");
      const rawMeta = sessionStorage.getItem("liveAnnotationMeta");
      if (!raw) return;
      sessionStorage.removeItem("liveAnnotations");
      sessionStorage.removeItem("liveAnnotationMeta");

      try {
        const annotations = JSON.parse(raw) as {
          label: string; itemKey: string; qty: number; unit: string;
          note: string; length?: number;
        }[];

        // Hand off to the same review-and-price step drawing takeoff and
        // voice quoting use -- counts come from the camera markup, prices
        // come from the real price book, never from a hardcoded guess.
        const detected: DetectedItem[] = annotations.map((ann) => ({
          label: ann.length != null ? `${ann.label} (~${ann.length}m)` : ann.label,
          item_key: ann.itemKey,
          quantity: ann.qty,
          unit: ann.unit,
          labour_hours: (ANNOTATION_LABOUR_HOURS[ann.itemKey] ?? 0) * ann.qty,
        }));

        setAdded(false);
        setPendingItems(detected);

        if (rawMeta && onAnnotationMeta) {
          try { onAnnotationMeta(JSON.parse(rawMeta)); } catch {}
        }
      } catch {}
    }

    window.addEventListener("focus", onFocus);
    // Also check immediately in case we're returning from the camera page
    onFocus();
    return () => window.removeEventListener("focus", onFocus);
  }, [onAnnotationMeta]);

  function handleAccept(items: ReviewLineItem[]) {
    onAddLineItems(items.map((item) => ({
      description:  item.label,
      quantity:     item.quantity,
      unit:         item.unit,
      notes:        "from site annotation",
      materialsCost: item.total ?? 0,
      labourHrs:    item.labourHrs,
    })));
    setPendingItems([]);
    setAddedCount(items.length);
    setAdded(true);
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-[var(--navy)] rounded-xl flex items-center justify-center shrink-0">
            <Camera size={18} className="text-[var(--amber)]" />
          </div>
          <div>
            <p className="font-bold text-[14px] text-[var(--ink)]">Live site annotation</p>
            <p className="text-[12.5px] text-[var(--ink-faint)]">
              Open your camera and tap or draw on the live view to mark up items. Each annotation adds to your quote automatically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-[11.5px] text-[var(--ink-faint)]">
          <div className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
            <p className="font-bold text-[var(--ink)] mb-0.5">Tap</p>
            <p>Pin an item</p>
          </div>
          <div className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
            <p className="font-bold text-[var(--ink)] mb-0.5">Drag</p>
            <p>Mark a run</p>
          </div>
          <div className="bg-[var(--app-bg)] rounded-xl p-3 text-center">
            <p className="font-bold text-[var(--ink)] mb-0.5">Trace</p>
            <p>Draw a zone</p>
          </div>
        </div>

        {added && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 mb-3">
            <Check size={14} className="text-green-600 shrink-0" />
            <p className="text-[13px] font-semibold text-green-700">
              {addedCount} annotation{addedCount !== 1 ? "s" : ""} added to quote
            </p>
          </div>
        )}

        <button
          onClick={() => {
            setAdded(false);
            if (onSaveDraft) onSaveDraft();
            router.push(`/camera?trade=${trade}`);
            // Also save price book for PricingEngine in camera page
            if (lib) {
              try { sessionStorage.setItem("swiftscope_price_book", JSON.stringify(lib)); } catch {}
            }
          }}
          className="btn-primary w-full justify-center">
          <Camera size={15} /> Open camera
          <ChevronRight size={14} />
        </button>
      </div>

      {pendingItems.length > 0 && (
        <DrawingAnalysisReviewTable
          detectedItems={pendingItems}
          confidence="high"
          notes="Counts from your camera markup -- prices from your price book."
          lib={lib ?? []}
          trade={trade}
          archetypeDefaults={archetypeDefaults}
          onSaveDefault={onSaveDefault}
          onAccept={handleAccept}
          onDismiss={() => setPendingItems([])}
        />
      )}
    </div>
  );
}
