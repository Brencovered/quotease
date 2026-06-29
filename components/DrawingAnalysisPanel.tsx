"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Plus, AlertTriangle, CheckCircle, Loader } from "lucide-react";

type LineItem = {
  description: string;
  quantity:    number;
  unit:        string;
  notes:       string;
};

type AnalysisResult = {
  rooms:      string[];
  items:      { name: string; count: number; notes: string }[];
  line_items: LineItem[];
  confidence: "high" | "medium" | "low";
  notes:      string;
  model:      string;
};

const CONFIDENCE_STYLE = {
  high:   { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  label: "High confidence" },
  medium: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Medium confidence" },
  low:    { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "Low confidence — review carefully" },
};

export default function DrawingAnalysisPanel({
  imageUrl,
  trade,
  onAddLineItems,
}: {
  imageUrl:        string;
  trade:           string;
  onAddLineItems?: (items: LineItem[]) => void;
}) {
  const [running,    setRunning]    = useState(false);
  const [result,     setResult]     = useState<AnalysisResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(true);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [added,      setAdded]      = useState(false);

  async function runAnalysis() {
    setRunning(true); setError(null); setResult(null); setAdded(false);

    try {
      // Fetch the image from the signed URL and convert to a File
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error("Could not fetch drawing image");
      const blob     = await imgRes.blob();
      const mimeType = blob.type || "image/jpeg";
      const file     = new File([blob], "drawing.jpg", { type: mimeType });

      const form = new FormData();
      form.append("image", file);
      form.append("trade", trade);

      const res  = await fetch("/api/ai/drawing-analysis", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setResult(data);
      // Pre-select all line items
      setSelected(new Set(data.line_items.map((_: LineItem, i: number) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  function toggleItem(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function addToQuote() {
    if (!result || !onAddLineItems) return;
    const toAdd = result.line_items.filter((_, i) => selected.has(i));
    onAddLineItems(toAdd);
    setAdded(true);
  }

  const conf = result ? CONFIDENCE_STYLE[result.confidence] : null;

  return (
    <div className="border border-[var(--line)] rounded-2xl overflow-hidden bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[var(--navy)] rounded-lg flex items-center justify-center">
            <Sparkles size={13} className="text-[var(--amber)]" />
          </div>
          <div>
            <p className="font-bold text-[13.5px] text-[var(--ink)]">AI Drawing Analysis</p>
            <p className="text-[11px] text-[var(--ink-faint)] capitalize">{trade} — powered by GPT-4o</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button onClick={() => setExpanded(e => !e)} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {!result && !running && (
            <button onClick={runAnalysis}
              className="btn-primary text-[12.5px] py-2 px-4 flex items-center gap-1.5">
              <Sparkles size={12} /> Analyse drawing
            </button>
          )}
          {running && (
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-faint)]">
              <Loader size={13} className="animate-spin" /> Analysing...
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-[var(--red-bg)] border-b border-red-100 flex items-center gap-2">
          <AlertTriangle size={14} className="text-[var(--red)] shrink-0" />
          <p className="text-[12.5px] text-[var(--red)] font-semibold">{error}</p>
          <button onClick={runAnalysis} className="ml-auto text-[12px] text-[var(--red)] underline">Retry</button>
        </div>
      )}

      {/* Results */}
      {result && expanded && (
        <div className="divide-y divide-[var(--line-subtle)]">

          {/* Confidence + notes */}
          <div className={`px-4 py-3 ${conf?.bg} border-b ${conf?.border}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle size={13} className={conf?.text} />
              <span className={`text-[12px] font-bold ${conf?.text}`}>{conf?.label} — review before saving</span>
            </div>
            <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">{result.notes}</p>
          </div>

          {/* Item counts */}
          {result.items.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">
                Items found — {result.items.length} types
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.items.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--app-bg)] border border-[var(--line)] rounded-full text-[11.5px] font-semibold text-[var(--ink)]">
                    <span className="text-[var(--amber)] font-black">{item.count}×</span> {item.name}
                    {item.notes && <span className="text-[var(--ink-faint)]">({item.notes})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Line items to add */}
          {result.line_items.length > 0 && onAddLineItems && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
                  Suggested line items — select to add
                </p>
                <button onClick={() => setSelected(
                  selected.size === result.line_items.length
                    ? new Set()
                    : new Set(result.line_items.map((_, i) => i))
                )} className="text-[11.5px] text-[var(--navy)] font-semibold">
                  {selected.size === result.line_items.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="space-y-1.5 mb-3">
                {result.line_items.map((item, i) => (
                  <button key={i} onClick={() => toggleItem(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      selected.has(i)
                        ? "border-[var(--navy)] bg-[var(--navy)]/5"
                        : "border-[var(--line)] hover:border-[var(--navy)]/40"
                    }`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected.has(i) ? "bg-[var(--navy)] border-[var(--navy)]" : "border-[var(--line)]"
                    }`}>
                      {selected.has(i) && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{item.description}</p>
                      {item.notes && <p className="text-[11.5px] text-[var(--ink-faint)] truncate">{item.notes}</p>}
                    </div>
                    <span className="shrink-0 text-[12.5px] font-bold text-[var(--ink-soft)]">
                      {item.quantity} {item.unit}
                    </span>
                  </button>
                ))}
              </div>

              {added ? (
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--green)] py-2">
                  <CheckCircle size={14} /> {selected.size} item{selected.size !== 1 ? "s" : ""} added to quote
                </div>
              ) : (
                <button onClick={addToQuote} disabled={selected.size === 0}
                  className="btn-primary w-full justify-center text-[13px] py-2.5">
                  <Plus size={13} /> Add {selected.size} item{selected.size !== 1 ? "s" : ""} to quote
                </button>
              )}
            </div>
          )}

          {/* Re-run */}
          <div className="px-4 py-2.5 flex justify-between items-center">
            <span className="text-[11px] text-[var(--ink-faint)]">Model: {result.model}</span>
            <button onClick={runAnalysis} className="text-[11.5px] text-[var(--navy)] font-semibold hover:opacity-70">
              Re-analyse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
