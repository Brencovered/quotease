"use client";

import { useState } from "react";
import {
  Plus, X, Check, AlertTriangle, Trash2, GitBranch,
  Lightbulb, FileText, Map, Hammer, Rocket, ChevronDown, ChevronUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Status = "idea" | "scoped" | "roadmap" | "in_progress" | "in_branch" | "live";
type Category = "feature" | "bug" | "infra";

interface RoadmapItem {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  status: Status;
  prd_content: string | null;
  branch_name: string | null;
  priority_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
}

const COLUMNS: { key: Status; label: string; icon: typeof Lightbulb }[] = [
  { key: "idea", label: "Idea", icon: Lightbulb },
  { key: "scoped", label: "Scoped / PRD", icon: FileText },
  { key: "roadmap", label: "Roadmap", icon: Map },
  { key: "in_progress", label: "In Progress", icon: Hammer },
  { key: "in_branch", label: "In Branch", icon: GitBranch },
  { key: "live", label: "Live in Prod", icon: Rocket },
];

const CATEGORY_COLORS: Record<Category, string> = {
  feature: "bg-blue-50 text-blue-700 border-blue-200",
  bug: "bg-red-50 text-red-700 border-red-200",
  infra: "bg-purple-50 text-purple-700 border-purple-200",
};

const BLANK: Omit<RoadmapItem, "id" | "created_at" | "updated_at" | "shipped_at"> = {
  title: "",
  description: "",
  category: "feature",
  status: "idea",
  prd_content: "",
  branch_name: "",
  priority_order: 0,
  notes: "",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminRoadmapPanel({ items: initialItems }: { items: RoadmapItem[] }) {
  const [items, setItems] = useState<RoadmapItem[]>(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof BLANK | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");

  function toast(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }

  /* ── Create ─────────────────────────────────────────────────── */
  async function createItem() {
    if (!draft || !draft.title.trim()) { toast("Title is required", false); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to create", false); return; }
      setItems(prev => [data.item, ...prev]);
      setDraft(null);
      toast("Idea captured");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Network error", false);
    } finally {
      setCreating(false);
    }
  }

  /* ── Update (patch any subset of fields) ───────────────────────── */
  async function updateItem(id: string, patch: Partial<RoadmapItem>) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/roadmap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to save", false); return; }
      setItems(prev => prev.map(it => (it.id === id ? data.item : it)));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Network error", false);
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ─────────────────────────────────────────────────── */
  async function deleteItem(id: string) {
    if (!confirm("Delete this item permanently?")) return;
    try {
      const res = await fetch(`/api/admin/roadmap?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to delete", false); return; }
      setItems(prev => prev.filter(it => it.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast("Deleted");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Network error", false);
    }
  }

  function moveStatus(item: RoadmapItem, direction: "forward" | "back") {
    const idx = COLUMNS.findIndex(c => c.key === item.status);
    const newIdx = direction === "forward" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= COLUMNS.length) return;
    updateItem(item.id, { status: COLUMNS[newIdx].key });
  }

  const filtered = filterCategory === "all" ? items : items.filter(i => i.category === filterCategory);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl text-[var(--ink)]">Roadmap</h1>
          <p className="text-[13px] text-[var(--ink-soft)]">Ideas → Scoped/PRD → Roadmap → In Progress → In Branch → Live</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as Category | "all")}
            className="app-field text-[12.5px] py-1.5"
          >
            <option value="all">All categories</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="infra">Infra</option>
          </select>
          <button
            onClick={() => setDraft({ ...BLANK })}
            className="btn-primary text-[12.5px] py-2 px-4 flex items-center gap-1.5"
          >
            <Plus size={13} /> New idea
          </button>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {msg.text}
        </div>
      )}

      {/* New idea composer */}
      {draft && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-tag">New idea</p>
            <button onClick={() => setDraft(null)} className="border-0 bg-transparent p-1 text-[var(--ink-faint)]">
              <X size={14} />
            </button>
          </div>
          <input
            value={draft.title}
            onChange={e => setDraft(d => d && { ...d, title: e.target.value })}
            placeholder="Title..."
            className="app-field text-[14px] font-semibold"
          />
          <textarea
            value={draft.description ?? ""}
            onChange={e => setDraft(d => d && { ...d, description: e.target.value })}
            placeholder="Rough description..."
            rows={2}
            className="app-field text-[13px] resize-none"
          />
          <select
            value={draft.category}
            onChange={e => setDraft(d => d && { ...d, category: e.target.value as Category })}
            className="app-field text-[13px] w-40"
          >
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="infra">Infra</option>
          </select>
          <div className="flex justify-end">
            <button onClick={createItem} disabled={creating || !draft.title.trim()} className="btn-primary text-[12.5px] py-2 px-4">
              {creating ? "Saving..." : "Capture idea"}
            </button>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        {COLUMNS.map(col => {
          const colItems = filtered
            .filter(i => i.status === col.key)
            .sort((a, b) => a.priority_order - b.priority_order);
          const Icon = col.icon;
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <Icon size={13} className="text-[var(--ink-faint)]" />
                <span className="text-[11px] font-bold uppercase text-[var(--ink-faint)]">{col.label}</span>
                <span className="text-[10.5px] text-[var(--ink-faint)]">({colItems.length})</span>
              </div>
              <div className="space-y-2 min-h-[40px]">
                {colItems.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onUpdate={patch => updateItem(item.id, patch)}
                    onDelete={() => deleteItem(item.id)}
                    onMoveForward={() => moveStatus(item, "forward")}
                    onMoveBack={() => moveStatus(item, "back")}
                    canMoveForward={COLUMNS.findIndex(c => c.key === item.status) < COLUMNS.length - 1}
                    canMoveBack={COLUMNS.findIndex(c => c.key === item.status) > 0}
                    saving={saving}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

function ItemCard({
  item, expanded, onToggleExpand, onUpdate, onDelete, onMoveForward, onMoveBack, canMoveForward, canMoveBack, saving,
}: {
  item: RoadmapItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<RoadmapItem>) => void;
  onDelete: () => void;
  onMoveForward: () => void;
  onMoveBack: () => void;
  canMoveForward: boolean;
  canMoveBack: boolean;
  saving: boolean;
}) {
  const [localPrd, setLocalPrd] = useState(item.prd_content ?? "");
  const [localNotes, setLocalNotes] = useState(item.notes ?? "");
  const [localBranch, setLocalBranch] = useState(item.branch_name ?? "");

  return (
    <div className="card space-y-2 !p-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onToggleExpand} className="text-left flex-1 border-0 bg-transparent p-0">
          <p className="text-[13px] font-semibold text-[var(--ink)] leading-snug">{item.title}</p>
        </button>
        <button onClick={onToggleExpand} className="border-0 bg-transparent p-0.5 text-[var(--ink-faint)] shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[item.category]}`}>
          {item.category}
        </span>
        {item.status === "in_branch" && item.branch_name && (
          <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink-soft)]">
            <GitBranch size={9} /> {item.branch_name}
          </span>
        )}
        {item.status === "live" && item.shipped_at && (
          <span className="text-[10px] text-[var(--ink-faint)]">
            shipped {new Date(item.shipped_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {!expanded && item.description && (
        <p className="text-[12px] text-[var(--ink-soft)] line-clamp-2">{item.description}</p>
      )}

      {expanded && (
        <div className="space-y-2.5 pt-1">
          {item.description && <p className="text-[12.5px] text-[var(--ink-soft)]">{item.description}</p>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-[var(--ink-faint)]">PRD / scope</label>
            <textarea
              value={localPrd}
              onChange={e => setLocalPrd(e.target.value)}
              onBlur={() => { if (localPrd !== (item.prd_content ?? "")) onUpdate({ prd_content: localPrd }); }}
              placeholder="Paste or write PRD content here once scoped..."
              rows={4}
              className="app-field text-[12px] font-mono resize-y w-full"
            />
          </div>

          {(item.status === "in_progress" || item.status === "in_branch" || item.status === "live") && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-[var(--ink-faint)]">Branch name</label>
              <input
                value={localBranch}
                onChange={e => setLocalBranch(e.target.value)}
                onBlur={() => { if (localBranch !== (item.branch_name ?? "")) onUpdate({ branch_name: localBranch }); }}
                placeholder="feature/my-branch"
                className="app-field text-[12px] font-mono w-full"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-[var(--ink-faint)]">Notes</label>
            <textarea
              value={localNotes}
              onChange={e => setLocalNotes(e.target.value)}
              onBlur={() => { if (localNotes !== (item.notes ?? "")) onUpdate({ notes: localNotes }); }}
              placeholder="e.g. deliberately deferred until..."
              rows={2}
              className="app-field text-[12px] resize-none w-full"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              <button onClick={onMoveBack} disabled={!canMoveBack || saving} className="btn-secondary text-[11px] py-1 px-2">
                ← Back
              </button>
              <button onClick={onMoveForward} disabled={!canMoveForward || saving} className="btn-primary text-[11px] py-1 px-2">
                Forward →
              </button>
            </div>
            <button onClick={onDelete} className="border-0 bg-transparent p-1 text-[var(--red)]">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
