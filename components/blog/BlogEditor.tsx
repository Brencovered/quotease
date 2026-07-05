"use client";

import { useState, useCallback, useRef } from "react";
import {
  Plus, GripVertical, Trash2, ChevronUp, ChevronDown,
  Type, Image, Quote, List, BarChart3, Table2, Heading1,
  Heading2, Heading3, SeparatorHorizontal, CheckCircle,
  BookOpen, Bold, Italic, Link2, X,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   TYPES — every content block in a blog post
   ════════════════════════════════════════════════════════════════ */

export type BlockType =
  | "h1" | "h2" | "h3"           // headings
  | "paragraph"                     // body text
  | "image"                         // image with optional caption
  | "blockquote"                    // pull quote
  | "bullet_list"                   // bullet list
  | "numbered_list"                 // numbered list
  | "table"                         // data table
  | "graph"                         // horizontal bar chart
  | "key_takeaways"                 // key takeaways box
  | "sources"                       // references / sources
  | "hr";                           // section divider

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;                  // main text (varies by block type)
  items?: string[];                 // for lists, takeaways, sources
  src?: string;                     // for images
  alt?: string;                     // for images
  caption?: string;                 // for images
  headers?: string[];               // for tables
  rows?: string[][];                // for tables
  bars?: { label: string; value: number; unit?: string }[];  // for graphs
  graphTitle?: string;              // for graphs
}

export interface BlogPostData {
  title: string;
  slug: string;
  excerpt: string;
  cover_url: string | null;
  category: string;
  tags: string[];
  author_name: string;
  author_avatar: string | null;
  published: boolean;
  featured: boolean;
  blocks: ContentBlock[];
}

/* ════════════════════════════════════════════════════════════════
   BLOCK DEFINITIONS — metadata about each block type
   ════════════════════════════════════════════════════════════════ */

export interface BlockDef {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  category: "text" | "visual" | "data" | "layout";
}

const BLOCK_DEFS: BlockDef[] = [
  { type: "h1",            label: "Main Heading",    description: "Page title — use once at the top",         icon: Heading1,        category: "text" },
  { type: "h2",            label: "Section Heading", description: "Major section divider",                    icon: Heading2,        category: "text" },
  { type: "h3",            label: "Sub Heading",     description: "Subsection within a section",              icon: Heading3,        category: "text" },
  { type: "paragraph",     label: "Paragraph",       description: "Body text with optional formatting",       icon: Type,            category: "text" },
  { type: "blockquote",    label: "Quote",           description: "Pull quote or testimonial",                icon: Quote,           category: "text" },
  { type: "bullet_list",   label: "Bullet List",     description: "List with bullet points",                  icon: List,            category: "text" },
  { type: "numbered_list", label: "Numbered List",   description: "Ordered step-by-step list",                icon: List,            category: "text" },
  { type: "image",         label: "Image",           description: "Photo with optional caption",              icon: Image,           category: "visual" },
  { type: "table",         label: "Data Table",      description: "Rows and columns of data",                 icon: Table2,          category: "data" },
  { type: "graph",         label: "Bar Chart",       description: "Horizontal bar chart comparison",          icon: BarChart3,       category: "data" },
  { type: "key_takeaways", label: "Key Takeaways",   description: "Highlighted summary box with checkmarks",  icon: CheckCircle,     category: "layout" },
  { type: "sources",       label: "Sources",         description: "References and citations section",         icon: BookOpen,        category: "layout" },
  { type: "hr",            label: "Divider",         description: "Visual separator between sections",        icon: SeparatorHorizontal, category: "layout" },
];

const BLOCK_CATEGORIES = [
  { key: "text",   label: "Text" },
  { key: "visual", label: "Visual" },
  { key: "data",   label: "Data" },
  { key: "layout", label: "Layout" },
] as const;

/* ════════════════════════════════════════════════════════════════
   UTILS
   ════════════════════════════════════════════════════════════════ */

let _id = 0;
function uid() { return `blk_${++_id}_${Math.random().toString(36).slice(2, 6)}`; }

export function createBlock(type: BlockType): ContentBlock {
  const base: ContentBlock = { id: uid(), type, content: "" };
  switch (type) {
    case "h1": case "h2": case "h3":
      return { ...base, content: "" };
    case "paragraph":
      return { ...base, content: "" };
    case "blockquote":
      return { ...base, content: "" };
    case "bullet_list": case "numbered_list":
      return { ...base, content: "", items: ["", ""] };
    case "image":
      return { ...base, content: "", src: "", alt: "", caption: "" };
    case "table":
      return { ...base, content: "", headers: ["Column 1", "Column 2", "Column 3"], rows: [["", "", ""], ["", "", ""]] };
    case "graph":
      return { ...base, content: "", graphTitle: "", bars: [{ label: "Item A", value: 50 }, { label: "Item B", value: 75 }] };
    case "key_takeaways":
      return { ...base, content: "Key Takeaways", items: ["", ""] };
    case "sources":
      return { ...base, content: "Sources", items: ["", ""] };
    case "hr":
      return base;
    default:
      return base;
  }
}

/* ════════════════════════════════════════════════════════════════
   FORMATTING TOOLBAR — bold, italic, link insertion
   ════════════════════════════════════════════════════════════════ */

function FormattingToolbar({
  content,
  onChange,
  textareaRef,
}: {
  content: string;
  onChange: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  function getSelection() {
    const el = textareaRef.current;
    if (!el) return { start: 0, end: 0, text: "" };
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    return { start, end, text: content.slice(start, end) };
  }

  function wrapSelection(before: string, after: string) {
    const el = textareaRef.current;
    const { start, end, text } = getSelection();
    const replacement = before + (text || "") + after;
    const next = content.slice(0, start) + replacement + content.slice(end);
    onChange(next);
    // Restore focus and selection after React re-render
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const cursorPos = start + before.length + (text ? text.length : 0);
        el.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  function insertLink() {
    const { start, end, text } = getSelection();
    const label = text || "link text";
    const url = linkUrl || "https://";
    const linkMarkdown = `[${label}](${url})`;
    const next = content.slice(0, start) + linkMarkdown + content.slice(end);
    onChange(next);
    setLinkOpen(false);
    setLinkUrl("");
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.focus();
    });
  }

  return (
    <div className="flex items-center gap-1 mb-1.5 relative">
      <button
        onClick={() => wrapSelection("**", "**")}
        title="Bold"
        className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
      >
        <Bold size={13} />
      </button>
      <button
        onClick={() => wrapSelection("*", "*")}
        title="Italic"
        className="p-1.5 rounded-lg hover:bg-[var(--app-bg)] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
      >
        <Italic size={13} />
      </button>
      <div className="w-px h-4 bg-[var(--line)] mx-0.5" />
      <div className="relative">
        <button
          onClick={() => setLinkOpen(!linkOpen)}
          title="Insert link"
          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
            linkOpen
              ? "bg-[var(--navy)] text-white"
              : "hover:bg-[var(--app-bg)] text-[var(--ink-faint)] hover:text-[var(--ink)]"
          }`}
        >
          <Link2 size={13} />
          <span className="text-[11px] font-semibold">Link</span>
        </button>
        {linkOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLinkOpen(false)} />
            <div className="absolute left-0 top-full mt-1.5 bg-white border border-[var(--line)] rounded-xl shadow-xl z-50 p-3 w-72 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[var(--ink)]">Insert link</span>
                <button onClick={() => setLinkOpen(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                  <X size={12} />
                </button>
              </div>
              <input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } }}
                placeholder="https://example.com"
                className="app-field text-[12px] py-1.5"
                autoFocus
              />
              <button
                onClick={insertLink}
                disabled={!linkUrl}
                className="btn-primary text-[11px] py-1.5 w-full disabled:opacity-40"
              >
                Insert link
              </button>
              <p className="text-[10px] text-[var(--ink-faint)]">
                {getSelection().text
                  ? `Will link: "${getSelection().text.slice(0, 40)}${getSelection().text.length > 40 ? "..." : ""}"`
                  : "Tip: select text first, then click Link"
                }
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   BLOCK EDITOR COMPONENTS — one per block type
   ════════════════════════════════════════════════════════════════ */

function HeadingEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const labels = { h1: "Main heading (H1) — the big title for this section", h2: "Section heading (H2)", h3: "Sub heading (H3)" };
  const placeholders = { h1: "e.g. How to Quote Faster On Site", h2: "e.g. The Problem with Paper Quotes", h3: "e.g. Step 1: Upload Your Price List" };
  return (
    <div className="space-y-2">
      <label className="block-tag">{labels[block.type as "h1" | "h2" | "h3"]}</label>
      <input
        value={block.content}
        onChange={e => onChange({ ...block, content: e.target.value })}
        placeholder={placeholders[block.type as "h1" | "h2" | "h3"]}
        className={`w-full bg-transparent border-0 focus:outline-none placeholder:text-[var(--ink-faint)] placeholder:font-normal ${
          block.type === "h1" ? "text-[1.6rem] font-bold" : block.type === "h2" ? "text-[1.3rem] font-bold" : "text-[1.1rem] font-bold"
        } text-[var(--ink)]`}
      />
    </div>
  );
}

function ParagraphEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block-tag">Paragraph</label>
      </div>
      <FormattingToolbar
        content={block.content}
        onChange={(val) => onChange({ ...block, content: val })}
        textareaRef={textareaRef}
      />
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={e => onChange({ ...block, content: e.target.value })}
        rows={5}
        placeholder="Write your paragraph here..."
        className="app-field text-[13.5px] resize-y"
      />
    </div>
  );
}

function BlockquoteEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-2">
      <label className="block-tag">Pull Quote</label>
      <FormattingToolbar
        content={block.content}
        onChange={(val) => onChange({ ...block, content: val })}
        textareaRef={textareaRef}
      />
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={e => onChange({ ...block, content: e.target.value })}
        rows={3}
        placeholder='e.g. "Since switching to Swiftscope, we quote 3x faster and win more jobs." — John Smith, Electrician'
        className="app-field text-[13.5px] italic resize-y"
      />
    </div>
  );
}

function ListEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const items = block.items ?? [];
  const isNumbered = block.type === "numbered_list";
  const updateItem = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onChange({ ...block, items: next });
  };
  const addItem = () => onChange({ ...block, items: [...items, ""] });
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, i) => i !== idx);
    onChange({ ...block, items: next });
  };
  return (
    <div className="space-y-2">
      <label className="block-tag">{isNumbered ? "Numbered List" : "Bullet List"}</label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`flex-shrink-0 w-6 text-center text-[12px] font-bold ${isNumbered ? "text-[var(--ink)]" : "text-[var(--amber)]"}`}>
              {isNumbered ? `${i + 1}.` : "•"}
            </span>
            <input
              value={item}
              onChange={e => updateItem(i, e.target.value)}
              placeholder={`Item ${i + 1}`}
              className="app-field flex-1 text-[13px] py-1.5"
            />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addItem} className="text-[12px] font-semibold text-[var(--navy)] hover:underline flex items-center gap-1 mt-1">
        <Plus size={12} /> Add item
      </button>
    </div>
  );
}

function ImageEditor({ block, onChange, onUpload }: { block: ContentBlock; onChange: (b: ContentBlock) => void; onUpload: () => void }) {
  return (
    <div className="space-y-3">
      <label className="block-tag">Image</label>
      {block.src ? (
        <div className="relative rounded-xl overflow-hidden aspect-[16/7] bg-[var(--app-bg)]">
          <img src={block.src} alt={block.alt || ""} className="w-full h-full object-cover" />
          <button
            onClick={() => onChange({ ...block, src: "" })}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <button onClick={onUpload}
          className="w-full border-2 border-dashed border-[var(--line)] rounded-xl py-8 flex flex-col items-center gap-2 hover:border-[var(--amber)] transition-colors bg-[var(--app-bg)]">
          <Image size={20} className="text-[var(--ink-faint)]" />
          <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Upload image</span>
          <span className="text-[11.5px] text-[var(--ink-faint)]">JPG, PNG, WebP — recommended 1200x630</span>
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input value={block.alt ?? ""} onChange={e => onChange({ ...block, alt: e.target.value })}
          placeholder="Alt text (for accessibility)" className="app-field text-[12px] py-1.5" />
        <input value={block.caption ?? ""} onChange={e => onChange({ ...block, caption: e.target.value })}
          placeholder="Caption (optional)" className="app-field text-[12px] py-1.5" />
      </div>
    </div>
  );
}

function TableEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const headers = block.headers ?? ["", ""];
  const rows = block.rows ?? [[""]];

  const updateHeader = (idx: number, val: string) => {
    const next = [...headers];
    next[idx] = val;
    onChange({ ...block, headers: next });
  };
  const addCol = () => {
    onChange({ ...block, headers: [...headers, `Column ${headers.length + 1}`], rows: rows.map(r => [...r, ""]) });
  };
  const removeCol = () => {
    if (headers.length <= 2) return;
    onChange({ ...block, headers: headers.slice(0, -1), rows: rows.map(r => r.slice(0, -1)) });
  };
  const addRow = () => onChange({ ...block, rows: [...rows, Array(headers.length).fill("")] });
  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    onChange({ ...block, rows: rows.filter((_, i) => i !== idx) });
  };
  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const next = rows.map((r, i) => i === rowIdx ? r.map((c, j) => j === colIdx ? val : c) : r);
    onChange({ ...block, rows: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block-tag">Data Table</label>
        <div className="flex gap-1.5">
          <button onClick={addCol} className="text-[11px] font-semibold text-[var(--navy)] hover:underline px-2 py-1">+ Col</button>
          <button onClick={removeCol} className="text-[11px] font-semibold text-[var(--red)] hover:underline px-2 py-1">- Col</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[var(--navy)]">
              {headers.map((h, i) => (
                <th key={i} className="p-2 min-w-[100px]">
                  <input value={h} onChange={e => updateHeader(i, e.target.value)}
                    className="w-full bg-transparent text-white font-bold text-center placeholder:text-white/40 border-0 focus:outline-none text-[12px]" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[var(--app-bg)]"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-2 border-t border-[var(--line)]">
                    <input value={cell} onChange={e => updateCell(ri, ci, e.target.value)}
                      className="w-full bg-transparent border-0 focus:outline-none text-[12px] text-[var(--ink)]" />
                  </td>
                ))}
                <td className="p-1 border-t border-[var(--line)] w-8">
                  <button onClick={() => removeRow(ri)} className="text-[var(--ink-faint)] hover:text-[var(--red)]">
                    <Trash2 size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="text-[12px] font-semibold text-[var(--navy)] hover:underline flex items-center gap-1">
        <Plus size={12} /> Add row
      </button>
    </div>
  );
}

function GraphEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const bars = block.bars ?? [];
  const updateBar = (idx: number, field: "label" | "value" | "unit", val: string) => {
    const next = bars.map((b, i) => i === idx ? { ...b, [field]: field === "value" ? parseFloat(val) || 0 : val } : b);
    onChange({ ...block, bars: next });
  };
  const addBar = () => onChange({ ...block, bars: [...bars, { label: "", value: 0 }] });
  const removeBar = (idx: number) => {
    if (bars.length <= 1) return;
    onChange({ ...block, bars: bars.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <label className="block-tag">Bar Chart</label>
      <input value={block.graphTitle ?? ""} onChange={e => onChange({ ...block, graphTitle: e.target.value })}
        placeholder="Chart title (e.g. Cost Comparison by Tool)" className="app-field text-[13px]" />
      <div className="space-y-2">
        {bars.map((bar, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--ink-faint)] w-5">{i + 1}</span>
            <input value={bar.label} onChange={e => updateBar(i, "label", e.target.value)}
              placeholder="Label" className="app-field flex-1 text-[12px] py-1.5" />
            <input type="number" value={bar.value} onChange={e => updateBar(i, "value", e.target.value)}
              placeholder="Value" className="app-field w-20 text-[12px] py-1.5 text-right" />
            <input value={bar.unit ?? ""} onChange={e => updateBar(i, "unit", e.target.value)}
              placeholder="$" className="app-field w-14 text-[12px] py-1.5 text-center" />
            {bars.length > 1 && (
              <button onClick={() => removeBar(i)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addBar} className="text-[12px] font-semibold text-[var(--navy)] hover:underline flex items-center gap-1">
        <Plus size={12} /> Add bar
      </button>
    </div>
  );
}

function KeyTakeawaysEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const items = block.items ?? [];
  const updateItem = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onChange({ ...block, items: next });
  };
  const addItem = () => onChange({ ...block, items: [...items, ""] });
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    onChange({ ...block, items: items.filter((_, i) => i !== idx) });
  };
  return (
    <div className="space-y-3">
      <label className="block-tag">Key Takeaways Box</label>
      <p className="text-[11.5px] text-[var(--ink-faint)]">This renders as a highlighted box with checkmarks. Each item can have a <strong>bold label:</strong> followed by description.</p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckCircle size={14} className="text-[var(--amber)] flex-shrink-0" />
            <input value={item} onChange={e => updateItem(i, e.target.value)}
              placeholder={`e.g. Use flat-rate pricing: Simpler for clients and faster to quote`}
              className="app-field flex-1 text-[12px] py-1.5" />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addItem} className="text-[12px] font-semibold text-[var(--navy)] hover:underline flex items-center gap-1">
        <Plus size={12} /> Add takeaway
      </button>
    </div>
  );
}

function SourcesEditor({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  const items = block.items ?? [];
  const updateItem = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onChange({ ...block, items: next });
  };
  const addItem = () => onChange({ ...block, items: [...items, ""] });
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    onChange({ ...block, items: items.filter((_, i) => i !== idx) });
  };
  return (
    <div className="space-y-3">
      <label className="block-tag">Sources / References</label>
      <p className="text-[11.5px] text-[var(--ink-faint)]">Each line renders with a left border. Use <strong>Label:</strong> Description format.</p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--ink-faint)] w-5 text-right">{i + 1}.</span>
            <input value={item} onChange={e => updateItem(i, e.target.value)}
              placeholder={`e.g. ABS Labour Account: 1.2M Australians employed in trades (2024)`}
              className="app-field flex-1 text-[12px] py-1.5" />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} className="text-[var(--ink-faint)] hover:text-[var(--red)] p-1">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addItem} className="text-[12px] font-semibold text-[var(--navy)] hover:underline flex items-center gap-1">
        <Plus size={12} /> Add source
      </button>
    </div>
  );
}

function HrEditor() {
  return (
    <div className="flex items-center gap-3 py-2">
      <SeparatorHorizontal size={16} className="text-[var(--ink-faint)]" />
      <span className="text-[12px] text-[var(--ink-faint)]">Visual divider between sections</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SINGLE BLOCK CARD — wraps any block editor with controls
   ════════════════════════════════════════════════════════════════ */

function BlockCard({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onUploadImage,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  onChange: (b: ContentBlock) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
  onUploadImage: (blockId: string) => void;
}) {
  const def = BLOCK_DEFS.find(d => d.type === block.type);
  const Icon = def?.icon ?? Type;

  const renderEditor = () => {
    switch (block.type) {
      case "h1": case "h2": case "h3":
        return <HeadingEditor block={block} onChange={onChange} />;
      case "paragraph":
        return <ParagraphEditor block={block} onChange={onChange} />;
      case "blockquote":
        return <BlockquoteEditor block={block} onChange={onChange} />;
      case "bullet_list": case "numbered_list":
        return <ListEditor block={block} onChange={onChange} />;
      case "image":
        return <ImageEditor block={block} onChange={onChange} onUpload={() => onUploadImage(block.id)} />;
      case "table":
        return <TableEditor block={block} onChange={onChange} />;
      case "graph":
        return <GraphEditor block={block} onChange={onChange} />;
      case "key_takeaways":
        return <KeyTakeawaysEditor block={block} onChange={onChange} />;
      case "sources":
        return <SourcesEditor block={block} onChange={onChange} />;
      case "hr":
        return <HrEditor />;
      default:
        return <ParagraphEditor block={block} onChange={onChange} />;
    }
  };

  return (
    <div className="group/card border border-[var(--line)] rounded-2xl bg-white hover:border-[var(--navy)]/30 transition-colors">
      {/* Block header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--line)]/50 bg-[var(--app-bg)] rounded-t-2xl">
        <GripVertical size={14} className="text-[var(--ink-faint)]" />
        <Icon size={13} className="text-[var(amber)]" />
        <span className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wide flex-1">{def?.label ?? block.type}</span>
        <span className="text-[10px] text-[var(--ink-faint)] mr-1">{index + 1} / {total}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <button onClick={() => onMove("up")} disabled={index === 0} className="p-1 rounded hover:bg-white disabled:opacity-30 text-[var(--ink-faint)]">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => onMove("down")} disabled={index === total - 1} className="p-1 rounded hover:bg-white disabled:opacity-30 text-[var(--ink-faint)]">
            <ChevronDown size={13} />
          </button>
          <button onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-[var(--ink-faint)] hover:text-[var(--red)]">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {/* Block editor */}
      <div className="p-4">
        {renderEditor()}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ADD BLOCK MENU — categorized dropdown
   ════════════════════════════════════════════════════════════════ */

function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("text");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full border-2 border-dashed border-[var(--line)] rounded-xl py-3 flex items-center justify-center gap-2 hover:border-[var(--amber)] hover:bg-[var(--amber-light)]/20 transition-colors text-[13px] font-semibold text-[var(--ink-soft)]"
      >
        <Plus size={16} /> Add content block
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 bg-white border border-[var(--line)] rounded-2xl shadow-xl z-50 overflow-hidden">
            {/* Category tabs */}
            <div className="flex border-b border-[var(--line)]">
              {BLOCK_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex-1 text-[11px] font-bold uppercase tracking-wide py-2.5 transition-colors ${
                    activeCategory === cat.key
                      ? "text-[var(--navy)] bg-[var(--amber-light)]/30 border-b-2 border-[var(--amber)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)] hover:bg-[var(--app-bg)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Block options */}
            <div className="p-2 grid grid-cols-2 gap-1 max-h-[280px] overflow-y-auto">
              {BLOCK_DEFS.filter(d => d.category === activeCategory).map(def => (
                <button
                  key={def.type}
                  onClick={() => { onAdd(def.type); setOpen(false); }}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[var(--app-bg)] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--navy)]/10 flex items-center justify-center flex-shrink-0">
                    <def.icon size={14} className="text-[var(--navy)]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[var(--ink)]">{def.label}</p>
                    <p className="text-[10.5px] text-[var(--ink-faint)] leading-tight">{def.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN BLOG EDITOR EXPORT
   ════════════════════════════════════════════════════════════════ */

export interface BlogEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  onImageUploadRequest: (blockId: string) => void;
}

export function BlogEditor({ blocks, onChange, onImageUploadRequest }: BlogEditorProps) {
  const updateBlock = useCallback((index: number, updated: ContentBlock) => {
    const next = [...blocks];
    next[index] = updated;
    onChange(next);
  }, [blocks, onChange]);

  const removeBlock = useCallback((index: number) => {
    const next = [...blocks];
    next.splice(index, 1);
    onChange(next);
  }, [blocks, onChange]);

  const moveBlock = useCallback((index: number, dir: "up" | "down") => {
    if (dir === "up" && index === 0) return;
    if (dir === "down" && index === blocks.length - 1) return;
    const next = [...blocks];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    onChange(next);
  }, [blocks, onChange]);

  const addBlock = useCallback((type: BlockType) => {
    onChange([...blocks, createBlock(type)]);
  }, [blocks, onChange]);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockCard
          key={block.id}
          block={block}
          index={i}
          total={blocks.length}
          onChange={(b) => updateBlock(i, b)}
          onRemove={() => removeBlock(i)}
          onMove={(dir) => moveBlock(i, dir)}
          onUploadImage={onImageUploadRequest}
        />
      ))}
      <AddBlockMenu onAdd={addBlock} />
    </div>
  );
}

/* Re-export */
export { BLOCK_DEFS, BLOCK_CATEGORIES };
