"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart } from "lucide-react";

type ChecklistItem = { label: string; checked: boolean };

export default function MaterialsChecklistPanel({
  quoteId,
  initialChecklist,
  scopeLines,
}: {
  quoteId: string;
  initialChecklist: ChecklistItem[];
  scopeLines: string[];
}) {
  const [items, setItems] = useState<ChecklistItem[]>(
    initialChecklist.length > 0 ? initialChecklist : scopeLines.map((label) => ({ label, checked: false }))
  );
  const [saving, setSaving] = useState(false);

  async function persist(next: ChecklistItem[]) {
    setItems(next);
    setSaving(true);
    const supabase = createClient();
    await supabase.from("quotes").update({ materials_checklist: next }).eq("id", quoteId);
    setSaving(false);
  }

  function toggle(index: number) {
    persist(items.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)));
  }

  function remove(index: number) {
    persist(items.filter((_, i) => i !== index));
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="card">
      <p className="section-tag mb-1">Materials</p>
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-[var(--ink)]">What to buy before you go</p>
        {items.length > 0 && (
          <span className="text-[12px] text-[var(--ink-faint)] font-semibold">
            {checkedCount}/{items.length} sorted
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)] flex items-center gap-2 mt-2">
          <ShoppingCart size={14} /> Nothing on the list yet.
        </p>
      ) : (
        <div className="space-y-1.5 mt-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 group">
              <input type="checkbox" checked={item.checked} onChange={() => toggle(i)} disabled={saving} className="shrink-0" />
              <span className={`text-[13.5px] flex-1 ${item.checked ? "text-[var(--ink-faint)] line-through" : "text-[var(--ink)]"}`}>
                {item.label}
              </span>
              <button onClick={() => remove(i)} className="text-[11px] text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 transition-opacity">
                remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
