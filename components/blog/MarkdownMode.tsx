"use client";

/**
 * components/blog/MarkdownMode.tsx
 * --------------------------------
 * A raw-markdown alternative to the block editor. Same underlying data:
 * text in, text out, converted with the existing parseBlocks and
 * serializeBlocks so both modes stay in sync and neither is authoritative.
 *
 * Why this exists: the block editor is better for fiddly, structured
 * content (tables, graphs, reordering), and considerably worse for
 * writing prose from a blank page. Adding a heading, then a paragraph,
 * then a table is several clicks per section when the author already
 * knows exactly what they want to type. This gives that author a
 * textarea, and keeps the block editor for the cases it's good at.
 *
 * The text is deliberately NOT re-synced from `blocks` while the user is
 * typing. parseBlocks assigns fresh ids on every call, so echoing the
 * parsed result back into the textarea would fight the cursor. Local
 * text is the source of truth for as long as this component is mounted,
 * and blocks flow one way, outward.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Copy } from "lucide-react";
import type { ContentBlock } from "./BlogEditor";
import { parseBlocks } from "./parseBlocks";
import { serializeBlocks } from "./serializeBlocks";

interface Props {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  /** Optional: lets the checks warn on a missing title without owning the field. */
  title?: string;
}

const SNIPPETS: { label: string; text: string }[] = [
  { label: "H2", text: "\n## Heading\n\n" },
  { label: "H3", text: "\n### Subheading\n\n" },
  { label: "Key Takeaways", text: "Key Takeaways\n- First point, a real claim not a tease\n- Second point\n- Third point\n\n" },
  { label: "List", text: "\n- First item\n- Second item\n\n" },
  { label: "Table", text: "\n| Column | Column |\n|---|---|\n| Value | Value |\n\n" },
  { label: "Bar chart", text: "\n[graph]\ntitle: Chart title\nFirst label: 149 AUD\nSecond label: 45 AUD\n[/graph]\n\n" },
  { label: "Pull quote", text: "\n> The line worth pulling out.\n\n" },
  { label: "Link", text: "[link text](/features)" },
  { label: "Sources", text: "\nSources\n- [Source name](https://example.com)\n" },
];

export default function MarkdownMode({ blocks, onChange, title = "" }: Props) {
  // Initialised once. See the note above about not syncing back in.
  const [text, setText] = useState(() => serializeBlocks(blocks));
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const push = useCallback(
    (next: string) => {
      setText(next);
      onChange(parseBlocks(next));
    },
    [onChange]
  );

  const insert = useCallback(
    (snippet: string) => {
      const ta = ref.current;
      if (!ta) return push(text + snippet);
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = text.slice(0, start) + snippet + text.slice(end);
      push(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + snippet.length;
      });
    },
    [push, text]
  );

  const stripDashes = useCallback(() => {
    push(text.replace(/\s*[\u2014\u2013]\s*/g, ", "));
  }, [push, text]);

  const checks = useMemo(() => {
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      words,
      list: [
        { label: "Title set", ok: title.trim().length > 0 },
        { label: "No long dashes", ok: !/[\u2014\u2013]/.test(text + title) },
        { label: "At least one H2", ok: /^##\s/m.test(text) },
        { label: "Three or more internal links", ok: (text.match(/\]\(\//g) || []).length >= 3 },
        { label: "800 words or more", ok: words >= 800 },
        { label: "No unverified placeholders", ok: !/\[VERIFY:/i.test(text) },
      ],
    };
  }, [text, title]);

  const passing = checks.list.filter((c) => c.ok).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SNIPPETS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => insert(s.text)}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--line)] text-[12px] font-semibold text-[var(--ink-soft)] hover:border-[var(--amber)] hover:bg-[var(--amber-light)]/20 transition-colors"
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={stripDashes}
          className="px-2.5 py-1.5 rounded-lg border border-[var(--line)] text-[12px] font-semibold text-[var(--ink-soft)] hover:border-[var(--amber)] hover:bg-[var(--amber-light)]/20 transition-colors"
        >
          Strip long dashes
        </button>
      </div>

      <textarea
        ref={ref}
        value={text}
        onChange={(e) => push(e.target.value)}
        spellCheck
        rows={26}
        placeholder="Write the post. Headings with ##, lists with -, tables with pipes. Use the buttons above for the fiddly bits."
        className="w-full rounded-xl border border-[var(--line)] p-4 font-mono text-[13px] leading-[1.65] focus:outline-none focus:border-[var(--amber)] resize-y"
      />

      <div className="rounded-xl border border-[var(--line)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
            Before you publish
          </p>
          <p className="text-[12px] text-[var(--ink-faint)]">
            {passing} of {checks.list.length} passing, {checks.words} words
          </p>
        </div>

        <div className="flex gap-1 mb-3">
          {checks.list.map((c) => (
            <span
              key={c.label}
              className={`h-1.5 flex-1 rounded-full ${c.ok ? "bg-emerald-500" : "bg-orange-300"}`}
            />
          ))}
        </div>

        {checks.list.filter((c) => !c.ok).length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-emerald-700">
            <Check size={14} /> Format checks pass. They don&apos;t judge whether it&apos;s any good.
          </p>
        ) : (
          <ul className="space-y-1">
            {checks.list
              .filter((c) => !c.ok)
              .map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-[13px] text-orange-700">
                  <AlertCircle size={14} /> {c.label}
                </li>
              ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] text-[12px] font-semibold text-[var(--ink-soft)] hover:border-[var(--amber)] transition-colors"
      >
        <Copy size={13} /> {copied ? "Copied" : "Copy markdown"}
      </button>
    </div>
  );
}
