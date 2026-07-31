"use client";

/**
 * components/blog/BlogAssist.tsx
 * -------------------------------
 * "Stuck? Get an outline" -- turns a target SEO keyword into a structured
 * plan (title, slug, excerpt, category, tags, key takeaways, section
 * headings) via /api/admin/blog/assist/plan, and can optionally draft the
 * prose for individual sections via /api/admin/blog/assist/draft.
 *
 * This only ever proposes structure and, if asked, section drafts -- it
 * never silently overwrites anything. "Use this outline" and "Draft this"
 * are both explicit clicks, and using the outline only fills in metadata
 * plus empty section headings, never invented body copy the author didn't
 * ask for.
 */

import { useState } from "react";
import { Sparkles, Loader2, X, PenLine } from "lucide-react";

const KEYWORD_SUGGESTIONS = [
  "ServiceM8 alternative", "Tradify alternative", "Fergus alternative", "SimPro alternative",
  "quoting software for electricians", "quoting software for plumbers",
  "quoting software for roofers", "quoting software for carpenters",
  "job management software for tradies", "job management software australia",
  "best quoting app for tradies", "flat rate quoting software",
  "quoting software no per user fee", "ai quoting software tradies",
  "quote from photo app tradies", "trade business software australia",
];

const POST_TYPES = [
  { value: "comparison", label: "Comparison against a named competitor" },
  { value: "practical",  label: "Practical guide for one trade" },
  { value: "explainer",  label: "Explainer on pricing or how something works" },
  { value: "data",       label: "Piece built on your own directory data" },
];

interface PlanSection { heading: string; brief: string; }
interface Plan {
  title: string; slug: string; excerpt: string; category: string;
  tags: string[]; takeaways: string[]; sections: PlanSection[];
}

export interface BlogAssistProps {
  postTitle: string;
  onUseOutline: (plan: Plan) => void;
  onInsertSection: (markdown: string) => void;
}

export default function BlogAssist({ postTitle, onUseOutline, onInsertSection }: BlogAssistProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [postType, setPostType] = useState("practical");
  const [notes, setNotes] = useState("");
  const [planning, setPlanning] = useState(false);
  const [drafting, setDrafting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  async function planOutline() {
    if (!keyword.trim()) { setError("Enter a target keyword first."); return; }
    setError(""); setPlanning(true); setPlan(null);
    try {
      const res = await fetch("/api/admin/blog/assist/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), postType, notes: notes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setPlan(data.plan as Plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  }

  async function draftSection(i: number) {
    if (!plan) return;
    const section = plan.sections[i];
    setDrafting(i); setError("");
    try {
      const res = await fetch("/api/admin/blog/assist/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postTitle: postTitle || plan.title,
          keyword: keyword.trim(),
          heading: section.heading,
          brief: section.brief,
          otherHeadings: plan.sections.map(s => s.heading),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      onInsertSection(data.text as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setDrafting(null);
    }
  }

  function useOutline() {
    if (!plan) return;
    onUseOutline(plan);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[var(--line)] text-[12.5px] font-bold text-[var(--ink-soft)] hover:border-[var(--amber)] hover:bg-[var(--amber-light)]/20 transition-colors"
      >
        <Sparkles size={13} className="text-[var(--amber-deep)]" /> Stuck? Get an outline
      </button>
    );
  }

  return (
    <div className="card space-y-3 border-[var(--amber)]/40">
      <div className="flex items-center justify-between">
        <p className="section-tag flex items-center gap-1.5">
          <Sparkles size={12} /> Get an outline
        </p>
        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--app-bg)] text-[var(--ink-faint)]">
          <X size={14} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)] block mb-1">Target keyword</label>
          <input
            list="blog-assist-keywords"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="quoting software for electricians"
            className="app-field text-[13px]"
          />
          <datalist id="blog-assist-keywords">
            {KEYWORD_SUGGESTIONS.map(k => <option key={k} value={k} />)}
          </datalist>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)] block mb-1">Post type</label>
          <select value={postType} onChange={e => setPostType(e.target.value)} className="app-field text-[13px]">
            {POST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold uppercase text-[var(--ink-faint)] block mb-1">
          What do you know that a competitor doesn&apos;t?
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Real numbers, a customer story, a pattern in your data. This is the part nobody can copy."
          className="app-field text-[13px] resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={planOutline} disabled={planning} className="btn-primary text-[12.5px] py-2 px-4 flex items-center gap-1.5">
          {planning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {planning ? "Planning..." : "Plan an outline"}
        </button>
        {error && <span className="text-[12px] font-semibold text-[var(--red)]">{error}</span>}
      </div>

      {plan && (
        <div className="pt-2 border-t border-[var(--line)] space-y-3">
          <div>
            <p className="text-[15px] font-bold text-[var(--ink)]">{plan.title}</p>
            <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">{plan.excerpt}</p>
          </div>

          <div className="space-y-2">
            {plan.sections.map((s, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-t border-[var(--line-subtle)] first:border-t-0">
                <span className="text-[16px] font-bold text-[var(--amber-deep)] font-mono min-w-[22px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--ink)]">{s.heading}</p>
                  <p className="text-[12px] text-[var(--ink-faint)]">{s.brief}</p>
                </div>
                <button
                  onClick={() => draftSection(i)}
                  disabled={drafting !== null}
                  className="btn-secondary text-[11.5px] py-1.5 px-2.5 flex items-center gap-1 shrink-0"
                >
                  {drafting === i ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />}
                  {drafting === i ? "Drafting..." : "Draft this"}
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={useOutline} className="btn-primary text-[12.5px] py-2 px-4">
              Use this outline
            </button>
            <span className="text-[11.5px] text-[var(--ink-faint)]">
              Fills in the title, slug, excerpt and headings only. The words stay yours.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
