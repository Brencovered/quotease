"use client";

import { useState } from "react";
import { Code2, Eye, Mail } from "lucide-react";

type Template = {
  id: string;
  name: string;
  trigger: string;
  from: string;
  routeFile: string;
  subject: string;
  html: string;
};

export default function EmailTemplatesViewer({ templates }: { templates: Template[] }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id);
  const [view, setView] = useState<"preview" | "source">("preview");

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-6">
      {/* Template list */}
      <div className="space-y-1.5">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`w-full text-left px-3.5 py-3 rounded-xl border transition-colors ${
              t.id === selected?.id
                ? "bg-[var(--navy)] border-[var(--navy)] text-white"
                : "bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink-faint)]"
            }`}
          >
            <p className="text-[13.5px] font-bold leading-tight">{t.name}</p>
            <p className={`text-[11.5px] mt-1 leading-snug ${t.id === selected?.id ? "text-[#8aa4b4]" : "text-[var(--ink-faint)]"}`}>
              {t.trigger}
            </p>
          </button>
        ))}
      </div>

      {/* Selected template detail */}
      {selected && (
        <div className="min-w-0">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--line)] flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[var(--ink)]">{selected.name}</p>
                <p className="text-[12.5px] text-[var(--ink-soft)] mt-1">
                  <span className="font-semibold">From:</span> {selected.from}
                </p>
                <p className="text-[12.5px] text-[var(--ink-soft)] mt-0.5">
                  <span className="font-semibold">Subject:</span> {selected.subject}
                </p>
                <p className="text-[11.5px] text-[var(--ink-faint)] mt-1.5 font-mono">{selected.routeFile}</p>
              </div>
              <div className="flex gap-1 shrink-0 bg-[var(--line-subtle)] rounded-lg p-1">
                <button
                  onClick={() => setView("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-bold transition-colors ${
                    view === "preview" ? "bg-white shadow-sm text-[var(--ink)]" : "text-[var(--ink-soft)]"
                  }`}
                >
                  <Eye size={13} /> Preview
                </button>
                <button
                  onClick={() => setView("source")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-bold transition-colors ${
                    view === "source" ? "bg-white shadow-sm text-[var(--ink)]" : "text-[var(--ink-soft)]"
                  }`}
                >
                  <Code2 size={13} /> HTML source
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--ink-faint)] bg-[var(--line-subtle)] rounded-lg px-3 py-2">
                <Mail size={13} />
                Rendered with sample data — real sends use the actual business name, job details, etc.
              </div>

              {view === "preview" ? (
                <iframe
                  key={selected.id}
                  title={`${selected.name} preview`}
                  srcDoc={selected.html}
                  sandbox=""
                  className="w-full rounded-xl border border-[var(--line)] bg-white"
                  style={{ height: "640px" }}
                />
              ) : (
                <pre className="w-full max-h-[640px] overflow-auto text-[11.5px] leading-relaxed bg-[var(--navy)] text-[#c8d8e4] rounded-xl p-4 font-mono whitespace-pre-wrap break-words">
                  {selected.html}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
