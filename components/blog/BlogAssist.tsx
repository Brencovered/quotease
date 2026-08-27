"use client";

/**
 * components/blog/BlogAssist.tsx
 * -------------------------------
 * "Stuck? Get an outline" - turns a target SEO keyword into a structured
 * plan (title, slug, excerpt, category, tags, key takeaways, section
 * headings) via /api/admin/blog/assist/plan, and can optionally draft the
 * prose for individual sections via /api/admin/blog/assist/draft.
 *
 * This only ever proposes structure and, if asked, section drafts - it
 * never silently overwrites anything. "Use this outline" only fills in
 * metadata plus empty section headings. Body copy always requires an
 * explicit "Draft this" (one section) or "Draft all sections" (every
 * section not already drafted) click.
 */

import { useState } from "react";
import { Sparkles, Loader2, X, PenLine, Check, ListChecks } from "lucide-react";

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

async function parseJsonBody(res: Response): Promise<{ error?: string; plan?: Plan; text?: string }> {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { error?: string; plan?: Plan; text?: string };
  } catch {
    throw new Error(`Request failed (${res.status}). The server did not return JSON.`);
  }
}

export default function BlogAssist({ postTitle, onUseOutline, onInsertSection }: BlogAssistProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [postType, setPostType] = useState("practical");
  const [notes, setNotes] = useState("");
  const [planning, setPlanning] = useState(false);
  const [drafting, setDrafting] = useState<number | null>(null);
  const [draftingAll, setDraftingAll] = useState(false);
  const [draftedIdx, setDraftedIdx] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  const busy = drafting !== null || draftingAll;

  async function planOutline() {
    if (!keyword.trim()) { setError("Enter a target keyword first."); return; }
    setError(""); setPlanning(true); setPlan(null); setDraftedIdx(new Set());
    try {
      const res = await fetch("/api/admin/blog/assist/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), postType, notes: notes.trim() }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data.plan) throw new Error("Outline response was empty. Try again.");
      setPlan(data.plan as Plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  }

  /** Fetches the draft for one section. Throws on failure - caller decides how to handle. */
  async function fetchSectionDraft(section: PlanSection): Promise<string> {
    if (!plan) throw new Error("No outline loaded");
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
    const data = await parseJsonBody(res);
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    if (!data.text) throw new Error("Draft response was empty. Try again.");
    return data.text;
  }

  async function draftSection(i: number) {
    if (!plan) return;
    setDrafting(i); setError("");
    try {
      const text = await fetchSectionDraft(plan.sections[i]);
      onInsertSection(text);
      setDraftedIdx(prev => new Set(prev).add(i));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setDrafting(null);
    }
  }

  async function draftAllSections() {
    if (!plan) return;
    setDraftingAll(true); setError("");
    const failures: string[] = [];
    for (let i = 0; i < plan.sections.length; i++) {
      if (draftedIdx.has(i)) continue; // already drafted - don't overwrite or waste a call
      setDrafting(i);
      try {
        const text = await fetchSectionDraft(plan.sections[i]);
        onInsertSection(text);
        setDraftedIdx(prev => new Set(prev).add(i));
      } catch {
        failures.push(plan.sections[i].heading);
      }
    }
    setDrafting(null);
    setDraftingAll(false);
    if (failures.length) {
      setError(`Drafted the rest, but failed on: ${failures.join(", ")}. Try those individually.`);
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

      <div className="space-y-2">
        <button onClick={planOutline} disabled={planning} className="btn-primary text-[12.5px] py-2 px-4 flex items-center gap-1.5">
          {planning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {planning ? "Planning..." : "Plan an outline"}
        </button>
        {error && (
          <p className="text-[12.5px] font-semibold text-[var(--red)] leading-snug">{error}</p>
        )}
      </div>

      {plan && (
        <div className="pt-2 border-t border-[var(--line)] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold text-[var(--ink)]">{plan.title}</p>
              <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">{plan.excerpt}</p>
            </div>
            <button
              onClick={draftAllSections}
              disabled={busy || draftedIdx.size === plan.sections.length}
              className="btn-secondary text-[11.5px] py-1.5 px-3 flex items-center gap-1.5 shrink-0"
            >
              {draftingAll
                ? <><Loader2 size={12} className="animate-spin" /> Drafting {(drafting ?? 0) + 1} of {plan.sections.length}...</>
                : <><ListChecks size={12} /> Draft all sections</>
              }
            </button>
          </div>

          <div className="space-y-2">
            {plan.sections.map((s, i) => {
              const done = draftedIdx.has(i);
              return (
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
                    disabled={busy || done}
                    className="btn-secondary text-[11.5px] py-1.5 px-2.5 flex items-center gap-1 shrink-0"
                  >
                    {drafting === i
                      ? <Loader2 size={11} className="animate-spin" />
                      : done ? <Check size={11} className="text-green-600" /> : <PenLine size={11} />}
                    {drafting === i ? "Drafting..." : done ? "Drafted" : "Draft this"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={useOutline} className="btn-primary text-[12.5px] py-2 px-4">
              Use this outline
            </button>
            <span className="text-[11.5px] text-[var(--ink-faint)]">
              Fills in the title, slug, excerpt and headings. Draft buttons above add body copy per section -
              review and edit before publishing either way.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
