"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { RotateCcw, Send, Sparkles, Trash2 } from "lucide-react";

type TradeKey = "electrician" | "carpenter" | "plumber" | "roofer";
type ToolMode = "pin" | "run";

type Tool = {
  id: string;
  label: string;
  mode: ToolMode;
  /** unit sell before margin for a pin, or per-metre for a run */
  unitPrice: number;
  unit: string;
  colour: string;
  labourMins: number;
};

type MarkupItem = {
  id: string;
  toolId: string;
  label: string;
  mode: ToolMode;
  colour: string;
  qty: number;
  unit: string;
  unitPrice: number;
  labourMins: number;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
};

type TradeConfig = {
  key: TradeKey;
  label: string;
  labourRate: number;
  hint: string;
  tools: Tool[];
  defaultTool: string;
};

const JOB_TYPES = ["Renovation", "New build", "Maintenance"] as const;

const MARGIN_TIERS = [
  { id: "residential", label: "Residential", pct: 6 },
  { id: "commercial", label: "Commercial", pct: 12 },
  { id: "subbie", label: "Subcontracting", pct: 15 },
] as const;

const JOB_SIZES = [
  { id: "small", label: "Small job", pct: 3 },
  { id: "medium", label: "Medium job", pct: 8 },
  { id: "large", label: "Large job", pct: 0 },
] as const;

const TRADES: TradeConfig[] = [
  {
    key: "electrician",
    label: "Electrician",
    labourRate: 110,
    hint: "Place fittings, or draw cable runs across the plan",
    defaultTool: "cable",
    tools: [
      { id: "cable", label: "Cable run", mode: "run", unitPrice: 14, unit: "m", colour: "#ef4444", labourMins: 8 },
      { id: "downlight", label: "Downlight", mode: "pin", unitPrice: 95, unit: "ea", colour: "#ffb400", labourMins: 18 },
      { id: "gpo", label: "GPO / outlet", mode: "pin", unitPrice: 65, unit: "ea", colour: "#f59e0b", labourMins: 22 },
      { id: "switchboard", label: "Switchboard", mode: "pin", unitPrice: 1450, unit: "ea", colour: "#1d4ed8", labourMins: 180 },
    ],
  },
  {
    key: "carpenter",
    label: "Carpenter",
    labourRate: 95,
    hint: "Pin joinery and doors, or draw skirting / deck runs",
    defaultTool: "skirting",
    tools: [
      { id: "skirting", label: "Skirting run", mode: "run", unitPrice: 28, unit: "m", colour: "#92400e", labourMins: 12 },
      { id: "door", label: "Door", mode: "pin", unitPrice: 320, unit: "ea", colour: "#ffb400", labourMins: 55 },
      { id: "robe", label: "Robe fitout", mode: "pin", unitPrice: 1800, unit: "ea", colour: "#b45309", labourMins: 210 },
      { id: "joinery", label: "Kitchen joinery", mode: "pin", unitPrice: 4200, unit: "lot", colour: "#071018", labourMins: 480 },
    ],
  },
  {
    key: "plumber",
    label: "Plumber",
    labourRate: 120,
    hint: "Place fixtures, or draw pipe runs between wet areas",
    defaultTool: "pipe",
    tools: [
      { id: "pipe", label: "Pipe run", mode: "run", unitPrice: 42, unit: "m", colour: "#2563eb", labourMins: 14 },
      { id: "basin", label: "Basin set", mode: "pin", unitPrice: 480, unit: "ea", colour: "#ffb400", labourMins: 70 },
      { id: "toilet", label: "Toilet suite", mode: "pin", unitPrice: 620, unit: "ea", colour: "#0f766e", labourMins: 80 },
      { id: "hwc", label: "Hot water unit", mode: "pin", unitPrice: 1650, unit: "ea", colour: "#dc2626", labourMins: 150 },
    ],
  },
  {
    key: "roofer",
    label: "Roofer",
    labourRate: 105,
    hint: "Pin roof zones and skylights, or draw gutter runs",
    defaultTool: "gutter",
    tools: [
      { id: "gutter", label: "Gutter run", mode: "run", unitPrice: 38, unit: "m", colour: "#64748b", labourMins: 10 },
      { id: "sheet", label: "Roof sheet bay", mode: "pin", unitPrice: 860, unit: "bay", colour: "#ffb400", labourMins: 90 },
      { id: "flashing", label: "Flashing set", mode: "pin", unitPrice: 240, unit: "ea", colour: "#475569", labourMins: 40 },
      { id: "skylight", label: "Skylight", mode: "pin", unitPrice: 980, unit: "ea", colour: "#0284c7", labourMins: 120 },
    ],
  },
];

/** Rough plan scale: 1% of the shorter plan axis ≈ 0.35 m for demo purposes */
function runMetres(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const pct = Math.sqrt(dx * dx + dy * dy);
  return Math.max(1, Math.round(pct * 0.35 * 10) / 10);
}

/**
 * Interactive floor-plan markup demo: pick a trade, place/draw materials,
 * set job type and margins, watch the quote total update.
 */
export default function QuoteTapDemo() {
  const [tradeKey, setTradeKey] = useState<TradeKey>("electrician");
  const [toolId, setToolId] = useState(TRADES[0].defaultTool);
  const [items, setItems] = useState<MarkupItem[]>([]);
  const [runStart, setRunStart] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>("Renovation");
  const [marginId, setMarginId] = useState<(typeof MARGIN_TIERS)[number]["id"]>("residential");
  const [sizeId, setSizeId] = useState<(typeof JOB_SIZES)[number]["id"]>("medium");
  const [sent, setSent] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);

  const trade = TRADES.find((t) => t.key === tradeKey) ?? TRADES[0];
  const tool = trade.tools.find((t) => t.id === toolId) ?? trade.tools[0];
  const marginTier = MARGIN_TIERS.find((t) => t.id === marginId) ?? MARGIN_TIERS[0];
  const sizeTier = JOB_SIZES.find((t) => t.id === sizeId) ?? JOB_SIZES[1];
  const marginPct = marginTier.pct + sizeTier.pct;

  useEffect(() => {
    setItems([]);
    setRunStart(null);
    setHover(null);
    setSent(false);
    setToolId(trade.defaultTool);
  }, [tradeKey, trade.defaultTool]);

  const materialsCost = useMemo(
    () => items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0),
    [items],
  );
  const materialsSell = Math.round(materialsCost * (1 + marginPct / 100));
  const labourMins = items.reduce((sum, item) => sum + item.labourMins * (item.mode === "run" ? item.qty : 1), 0);
  const labourHrs = Math.round((labourMins / 60) * 10) / 10;
  const labourCost = Math.round(labourHrs * trade.labourRate);
  const total = materialsSell + labourCost;

  function localPoint(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(98, Math.max(2, x)),
      y: Math.min(98, Math.max(2, y)),
    };
  }

  function addPin(x: number, y: number) {
    if (!tool || tool.mode !== "pin") return;
    const item: MarkupItem = {
      id: `${tool.id}-${Date.now()}`,
      toolId: tool.id,
      label: tool.label,
      mode: "pin",
      colour: tool.colour,
      qty: 1,
      unit: tool.unit,
      unitPrice: tool.unitPrice,
      labourMins: tool.labourMins,
      x,
      y,
    };
    startTransition(() => setItems((prev) => [...prev, item]));
  }

  function completeRun(x: number, y: number) {
    if (!tool || tool.mode !== "run" || !runStart) return;
    const metres = runMetres(runStart.x, runStart.y, x, y);
    const item: MarkupItem = {
      id: `${tool.id}-${Date.now()}`,
      toolId: tool.id,
      label: `${tool.label}, ${metres}m`,
      mode: "run",
      colour: tool.colour,
      qty: metres,
      unit: tool.unit,
      unitPrice: tool.unitPrice,
      labourMins: tool.labourMins,
      x: runStart.x,
      y: runStart.y,
      x2: x,
      y2: y,
    };
    startTransition(() => {
      setItems((prev) => [...prev, item]);
      setRunStart(null);
      setHover(null);
    });
  }

  function onPlanPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (sent) return;
    e.preventDefault();
    const pt = localPoint(e);
    if (tool.mode === "pin") {
      addPin(pt.x, pt.y);
      return;
    }
    if (!runStart) {
      setRunStart(pt);
      setHover(pt);
      return;
    }
    completeRun(pt.x, pt.y);
  }

  function onPlanPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!runStart || tool.mode !== "run" || sent) return;
    setHover(localPoint(e));
  }

  function removeItem(id: string) {
    if (sent) return;
    startTransition(() => setItems((prev) => prev.filter((i) => i.id !== id)));
  }

  function reset() {
    setItems([]);
    setRunStart(null);
    setHover(null);
    setSent(false);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#ffb400] mb-3">
          Feel it
        </p>
        <h2 className="text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold tracking-[-0.025em] leading-[1.08] text-[#071018] mb-4">
          Pick your trade.
          <br />
          Draw it. Margin it. Send it.
        </h2>
        <p className="text-[15.5px] text-[#4a5560] leading-[1.65] max-w-[44ch] mb-5">
          Choose a trade tool, tap fittings onto the plan or drag a run for cable, pipe, skirting or gutter. Set job type and margins the same way you would on a real quote.
        </p>

        <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Choose a trade">
          {TRADES.map((t) => {
            const on = t.key === tradeKey;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTradeKey(t.key)}
                className={[
                  "px-3.5 py-2 rounded-lg text-[13px] font-extrabold border transition-colors",
                  on
                    ? "bg-[#071018] border-[#071018] text-white"
                    : "bg-white border-[#d5dbe0] text-[#5a6a78] hover:border-[#071018] hover:text-[#071018]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8b96a1] mb-1.5">
              Job type
            </span>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as (typeof JOB_TYPES)[number])}
              className="w-full rounded-lg border border-[#d5dbe0] bg-white px-3 py-2.5 text-[13px] font-bold text-[#071018]"
            >
              {JOB_TYPES.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8b96a1] mb-1.5">
              Customer margin
            </span>
            <select
              value={marginId}
              onChange={(e) => setMarginId(e.target.value as typeof marginId)}
              className="w-full rounded-lg border border-[#d5dbe0] bg-white px-3 py-2.5 text-[13px] font-bold text-[#071018]"
            >
              {MARGIN_TIERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} (+{m.pct}%)
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8b96a1] mb-1.5">
              Job size
            </span>
            <select
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value as typeof sizeId)}
              className="w-full rounded-lg border border-[#d5dbe0] bg-white px-3 py-2.5 text-[13px] font-bold text-[#071018]"
            >
              {JOB_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.pct >= 0 ? "+" : ""}
                  {s.pct}%)
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-[#e2e5ea] bg-white p-4 mb-6">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b96a1]">Quote snapshot</p>
              <p className="text-[13px] font-semibold text-[#5a6a78]">
                {jobType} · {marginTier.label} · effective margin {marginPct}%
              </p>
            </div>
            <p className="text-[1.6rem] font-black text-[#071018] tabular-nums leading-none">
              ${total.toLocaleString("en-AU")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[12px]">
            <div className="rounded-lg bg-[#f4f6f8] px-2.5 py-2">
              <p className="text-[#8b96a1] font-bold uppercase tracking-wider text-[9px]">Materials</p>
              <p className="font-extrabold text-[#071018] tabular-nums">${materialsSell.toLocaleString("en-AU")}</p>
            </div>
            <div className="rounded-lg bg-[#f4f6f8] px-2.5 py-2">
              <p className="text-[#8b96a1] font-bold uppercase tracking-wider text-[9px]">Labour</p>
              <p className="font-extrabold text-[#071018] tabular-nums">
                {labourHrs}h · ${labourCost.toLocaleString("en-AU")}
              </p>
            </div>
            <div className="rounded-lg bg-[#fff6db] px-2.5 py-2">
              <p className="text-[#a67c00] font-bold uppercase tracking-wider text-[9px]">Items</p>
              <p className="font-extrabold text-[#071018] tabular-nums">{items.length}</p>
            </div>
          </div>
        </div>

        <ul className="space-y-2 mb-6 max-h-[220px] overflow-y-auto pr-1">
          {items.length === 0 ? (
            <li className="text-[13.5px] text-[#8b96a1]">
              Nothing on the plan yet. Select a tool, then tap or draw.
            </li>
          ) : (
            items.map((item, idx) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 text-[13.5px] home-line-in"
              >
                <span
                  className="w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 text-[#071018]"
                  style={{ background: item.colour }}
                >
                  {idx + 1}
                </span>
                <span className="flex-1 font-bold text-[#071018] min-w-0 truncate">
                  {item.label}
                  <span className="text-[#8b96a1] font-semibold">
                    {" "}
                    · {item.qty}
                    {item.unit !== "ea" && item.unit !== "lot" && item.unit !== "bay" ? item.unit : ""}
                  </span>
                </span>
                <span className="font-extrabold tabular-nums text-[#071018]">
                  ${Math.round(item.qty * item.unitPrice * (1 + marginPct / 100)).toLocaleString("en-AU")}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => removeItem(item.id)}
                  className="text-[#a8b4bd] hover:text-[#071018]"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))
          )}
        </ul>

        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#071018] hover:text-[#c48a00] transition-colors"
        >
          Start free trial <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="max-w-[440px] w-full mx-auto lg:sticky lg:top-24">
        <div className="rounded-[28px] bg-[#0a121a] p-2.5 shadow-[0_28px_60px_rgba(7,16,24,0.28)] border border-black/40">
          <div className="rounded-[22px] overflow-hidden bg-[#f2f4f6]">
            <div className="bg-[#071018] px-4 pt-3 pb-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-[13px] tracking-wide text-white">SWIFTSCOPE</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#ffb400]">
                  <Sparkles size={11} aria-hidden /> {trade.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Labour</p>
                  <p className="text-[13px] font-bold text-white tabular-nums">{labourHrs}h</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Materials</p>
                  <p className="text-[13px] font-bold text-white tabular-nums">
                    ${materialsSell.toLocaleString("en-AU")}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Total</p>
                  <p className="text-[15px] font-black text-[#ffb400] tabular-nums">
                    ${total.toLocaleString("en-AU")}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-3 pt-3 flex flex-wrap gap-1.5">
              {trade.tools.map((t) => {
                const on = t.id === tool.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={sent}
                    onClick={() => {
                      setToolId(t.id);
                      setRunStart(null);
                      setHover(null);
                    }}
                    className={[
                      "text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors",
                      on
                        ? "bg-[#ffb400] border-[#ffb400] text-[#071018]"
                        : "bg-white border-[#d5dbe0] text-[#5a6a78] hover:border-[#071018]",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="px-3 pt-2 text-[11px] font-semibold text-[#8b96a1]">
              {tool.mode === "run"
                ? runStart
                  ? "Click the end point to finish the run"
                  : `Click start, then end, to draw a ${tool.label.toLowerCase()}`
                : trade.hint}
            </p>

            <div
              ref={planRef}
              className={[
                "relative mx-3 mt-2 mb-3 aspect-[16/11] rounded-xl overflow-hidden border border-[#d5dbe0] bg-white touch-none",
                sent ? "cursor-default" : tool.mode === "run" ? "cursor-crosshair" : "cursor-cell",
              ].join(" ")}
              onPointerDown={onPlanPointerDown}
              onPointerMove={onPlanPointerMove}
              onPointerLeave={() => tool.mode === "run" && !runStart && setHover(null)}
            >
              <Image
                src="/marketing/v2/demo-floorplan.png"
                alt="Residential floor plan for live markup demo"
                fill
                sizes="440px"
                quality={90}
                className="object-cover object-center pointer-events-none select-none"
                draggable={false}
              />

              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {items
                  .filter((i) => i.mode === "run" && i.x2 != null && i.y2 != null)
                  .map((i) => (
                    <g key={i.id}>
                      <line
                        x1={i.x}
                        y1={i.y}
                        x2={i.x2}
                        y2={i.y2}
                        stroke={i.colour}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle cx={i.x} cy={i.y} r="1.4" fill={i.colour} />
                      <circle cx={i.x2} cy={i.y2} r="1.4" fill={i.colour} />
                    </g>
                  ))}
                {runStart && hover && (
                  <line
                    x1={runStart.x}
                    y1={runStart.y}
                    x2={hover.x}
                    y2={hover.y}
                    stroke={tool.colour}
                    strokeWidth="1.6"
                    strokeDasharray="2 2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {items
                .filter((i) => i.mode === "pin")
                .map((item, idx) => (
                  <span
                    key={item.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center text-[#071018] shadow-[0_6px_14px_rgba(0,0,0,0.28)] pointer-events-none"
                    style={{ left: `${item.x}%`, top: `${item.y}%`, background: item.colour }}
                  >
                    {idx + 1}
                  </span>
                ))}

              {runStart && (
                <span
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-white pointer-events-none"
                  style={{ left: `${runStart.x}%`, top: `${runStart.y}%`, background: tool.colour }}
                />
              )}
            </div>

            <div className="px-3 pb-3 space-y-2">
              {sent ? (
                <div className="flex items-center justify-center gap-2 bg-[#e8f5ec] text-[#1c7a3a] font-extrabold text-[13.5px] py-3.5 rounded-xl">
                  Quote sent. Client notified.
                </div>
              ) : (
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => items.length > 0 && setSent(true)}
                  className={[
                    "w-full flex items-center justify-center gap-2 font-extrabold text-[14px] py-3.5 rounded-xl transition-colors",
                    items.length === 0
                      ? "bg-[#e2e5ea] text-[#a8b4bd]"
                      : "bg-[#ffb400] text-[#071018] hover:bg-[#e89e00]",
                  ].join(" ")}
                >
                  <Send size={14} aria-hidden /> Send {trade.label.toLowerCase()} quote
                </button>
              )}
              {(items.length > 0 || sent || runStart) && (
                <button
                  type="button"
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#8b96a1] hover:text-[#071018]"
                >
                  <RotateCcw size={11} aria-hidden /> Reset plan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
