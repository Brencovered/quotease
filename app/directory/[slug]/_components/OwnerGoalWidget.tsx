"use client";

import { useState, useEffect } from "react";
import { Target, Loader2, Check } from "lucide-react";

export default function OwnerGoalWidget() {
  const [loading, setLoading] = useState(true);
  const [targetQuotes, setTargetQuotes] = useState<number | null>(null);
  const [quoteCount, setQuoteCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/directory/goal")
      .then((r) => r.json())
      .then((data) => {
        setTargetQuotes(data.targetQuotes ?? null);
        setQuoteCount(data.quoteCount ?? 0);
        setEditing(data.targetQuotes == null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    const value = parseInt(inputValue, 10);
    if (!Number.isInteger(value) || value <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/directory/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetQuotes: value }),
      });
      if (res.ok) {
        setTargetQuotes(value);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#5a6b78]">
        <Loader2 size={14} className="animate-spin" /> Loading your goal...
      </div>
    );
  }

  const pct = targetQuotes ? Math.min(100, Math.round((quoteCount / targetQuotes) * 100)) : 0;
  const hitGoal = targetQuotes != null && quoteCount >= targetQuotes;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0a1722] shrink-0">
        <Target size={15} className="text-[#ffb400]" />
        This month&apos;s goal (only visible to you)
      </div>

      {editing ? (
        <form onSubmit={saveGoal} className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. 10"
            className="app-field w-24 !py-1.5"
          />
          <span className="text-[13px] text-[#5a6b78]">quote requests this month</span>
          <button type="submit" disabled={saving} className="btn-primary !py-1.5 !px-3 text-[13px]">
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Set goal"}
          </button>
        </form>
      ) : (
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[#eee] overflow-hidden max-w-xs">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: hitGoal ? "#10b981" : "#ffb400" }}
            />
          </div>
          <span className="text-[13px] font-semibold text-[#0a1722] whitespace-nowrap">
            {hitGoal && <Check size={13} className="inline text-emerald-500 mr-1" />}
            {quoteCount} of {targetQuotes} this month
          </span>
          <button
            onClick={() => { setInputValue(String(targetQuotes ?? "")); setEditing(true); }}
            className="text-[12.5px] text-[#5a6b78] underline underline-offset-2 whitespace-nowrap"
          >
            Change goal
          </button>
        </div>
      )}
    </div>
  );
}
