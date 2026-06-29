"use client";

import { useEffect, useState } from "react";
import { Camera, Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const ITEM_TO_MATERIAL: Record<string, { matKey: string; labourHrs: number }> = {
  dl:       { matKey: "dl_standard",     labourHrs: 0.4  },
  gpo:      { matKey: "pp",              labourHrs: 0.4  },
  switch:   { matKey: "sw",              labourHrs: 0.3  },
  data:     { matKey: "data",            labourHrs: 0.5  },
  exhaust:  { matKey: "exhaust_ceiling", labourHrs: 0.75 },
  smoke:    { matKey: "smoke",           labourHrs: 1.0  },
  cable:    { matKey: "cable_2_5",       labourHrs: 0    },
  conduit:  { matKey: "cable_2_5",       labourHrs: 0    },
  sb:       { matKey: "sb_rcd",          labourHrs: 4    },
  circuit:  { matKey: "appliance",       labourHrs: 1.5  },
  tap:      { matKey: "appliance",       labourHrs: 1.0  },
  toilet:   { matKey: "appliance",       labourHrs: 1.5  },
  basin:    { matKey: "appliance",       labourHrs: 1.0  },
  shower:   { matKey: "appliance",       labourHrs: 2.0  },
  hwu:      { matKey: "appliance",       labourHrs: 3.0  },
  pipe:     { matKey: "cable_2_5",       labourHrs: 0.2  },
  drain:    { matKey: "cable_2_5",       labourHrs: 0.3  },
  gutter:   { matKey: "appliance",       labourHrs: 0.5  },
  downpipe: { matKey: "appliance",       labourHrs: 0.75 },
  ridge:    { matKey: "cable_2_5",       labourHrs: 0.3  },
  valley:   { matKey: "cable_2_5",       labourHrs: 0.4  },
  skylight: { matKey: "appliance",       labourHrs: 4.0  },
  damage:   { matKey: "appliance",       labourHrs: 0.5  },
};

export default function LiveSiteAnnotation({
  trade,
  lib,
  onAddLineItems,
}: {
  trade: string;
  lib?: { item_key: string; unit_cost: number }[];
  onAddLineItems: (items: {
    description: string; quantity: number; unit: string;
    notes: string; materialsCost: number; labourHrs: number;
  }[]) => void;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [count, setCount] = useState(0);

  // Check for results when page regains focus (after camera page returns)
  useEffect(() => {
    function onFocus() {
      const raw = sessionStorage.getItem("liveAnnotations");
      if (!raw) return;
      sessionStorage.removeItem("liveAnnotations");

      try {
        const annotations = JSON.parse(raw) as {
          label: string; itemKey: string; qty: number; unit: string;
          note: string; length?: number;
        }[];

        const lineItems = annotations.map(ann => {
          const pricing = ITEM_TO_MATERIAL[ann.itemKey];
          const matCost = pricing && lib
            ? (lib.find(m => m.item_key === pricing.matKey)?.unit_cost ?? 0) * ann.qty
            : 0;
          const labourHrs = pricing ? pricing.labourHrs * ann.qty : 0;
          const lengthNote = ann.length != null ? ` (~${ann.length}m)` : "";
          return {
            description:  ann.label,
            quantity:     ann.qty,
            unit:         ann.unit,
            notes:        [ann.note, lengthNote].filter(Boolean).join(" "),
            materialsCost: Math.round(matCost),
            labourHrs,
          };
        });

        onAddLineItems(lineItems);
        setCount(annotations.length);
        setAdded(true);
      } catch {}
    }

    window.addEventListener("focus", onFocus);
    // Also check immediately in case we're returning from the camera page
    onFocus();
    return () => window.removeEventListener("focus", onFocus);
  }, [lib, onAddLineItems]);

  return (
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
            {count} annotation{count !== 1 ? "s" : ""} added to quote
          </p>
        </div>
      )}

      <button
        onClick={() => { setAdded(false); router.push(`/camera?trade=${trade}`); }}
        className="btn-primary w-full justify-center">
        <Camera size={15} /> Open camera
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
