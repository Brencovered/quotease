"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, ChevronDown, ChevronUp, Check, Plus } from "lucide-react";

interface SuggestedItem {
  label:     string;
  qty:       number;
  unit:      string;
  unit_cost: number;
}

interface SuggestedPackage {
  title:       string;
  trade:       string;
  description: string;
  labour_hrs:  number;
  items:       SuggestedItem[];
}

interface Message {
  role:    "user" | "assistant";
  content: string;
  packages?: SuggestedPackage[];
}

export default function AIPackageAssistant({
  trade,
  hourlyRate,
  onCreatePackage,
}: {
  trade:           string;
  hourlyRate:      number;
  onCreatePackage: (pkg: SuggestedPackage) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const SYSTEM_PROMPT = `You are an expert Australian trade business assistant helping a ${trade} set up job packages in Swiftscope — a quoting and job management platform.

Your job is to suggest professional, well-priced package templates that the tradie can reuse for common jobs.

When the tradie describes a job type (e.g. "bathroom renovation" or "new build lighting"), respond with:
1. A short helpful message
2. One or more suggested packages as structured JSON

Each package must follow this exact format in a JSON code block:
\`\`\`json
[
  {
    "title": "Package name",
    "trade": "${trade}",
    "description": "Brief description of what's included",
    "labour_hrs": 4,
    "items": [
      { "label": "Item description", "qty": 1, "unit": "each", "unit_cost": 45 },
      { "label": "Item description", "qty": 10, "unit": "m", "unit_cost": 6 }
    ]
  }
]
\`\`\`

Rules:
- Use Australian trade terminology
- Prices should be realistic Australian wholesale/trade prices (not retail)
- Labour hours should be realistic for the job size
- Units: each, m, m2, hr, lot, point
- Keep packages focused -- 3-8 line items each
- If asked for multiple job types, return multiple packages
- The tradie's hourly rate is $${hourlyRate}/hr

After the JSON, add any notes about what the tradie might want to customise.`;

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg.content },
          ],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text ?? "Sorry, I couldn't generate a package. Please try again.";

      // Extract JSON packages from response
      const packages: SuggestedPackage[] = [];
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed)) packages.push(...parsed);
        } catch {}
      }

      // Clean text: remove the JSON block for display
      const cleanText = text.replace(/```json[\s\S]*?```/g, "").trim();

      setMessages(prev => [...prev, { role: "assistant", content: cleanText, packages }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleAccept(pkg: SuggestedPackage) {
    onCreatePackage(pkg);
    setAccepted(prev => new Set([...prev, pkg.title]));
  }

  const STARTERS = [
    "Standard bathroom reno",
    "New build lighting fit-out",
    "Switchboard upgrade",
    "EV charger installation",
    "Solar connection",
  ];

  return (
    <div className="rounded-2xl border border-[var(--line)] overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-[var(--navy)] to-[var(--navy)]/90 text-left"
      >
        <div className="w-8 h-8 bg-[var(--amber)] rounded-xl flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-[var(--navy)]" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-[13.5px] text-white">AI package assistant</p>
          <p className="text-[11.5px] text-white/50">Describe a job type and get a ready-to-use package</p>
        </div>
        {open ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
      </button>

      {open && (
        <div className="bg-[var(--surface)]">
          {/* Starter prompts (only if no messages) */}
          {messages.length === 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Try asking about</p>
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); }}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message thread */}
          {messages.length > 0 && (
            <div className="px-4 py-3 space-y-4 max-h-[420px] overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                    {/* Text bubble */}
                    {msg.content && (
                      <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[var(--navy)] text-white rounded-tr-sm"
                          : "bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink)] rounded-tl-sm"
                      }`}>
                        {msg.content}
                      </div>
                    )}

                    {/* Suggested package cards */}
                    {msg.packages && msg.packages.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.packages.map((pkg, pi) => (
                          <div key={pi} className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-3.5 pt-3 pb-2">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="font-bold text-[13.5px] text-[var(--ink)]">{pkg.title}</p>
                                <span className="text-[10px] font-bold text-[var(--amber-deep)] bg-amber-50 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                                  {pkg.labour_hrs}h labour
                                </span>
                              </div>
                              {pkg.description && (
                                <p className="text-[12px] text-[var(--ink-faint)] mb-2">{pkg.description}</p>
                              )}
                              {/* Item list */}
                              <div className="space-y-0.5 mb-3">
                                {pkg.items.map((item, ii) => (
                                  <div key={ii} className="flex items-center justify-between text-[12px]">
                                    <span className="text-[var(--ink-soft)] truncate flex-1">{item.qty} {item.unit} × {item.label}</span>
                                    <span className="text-[var(--ink)] font-semibold ml-2 shrink-0">${(item.qty * item.unit_cost).toLocaleString()}</span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between text-[12px] pt-1 border-t border-[var(--line-subtle)] mt-1">
                                  <span className="text-[var(--ink-soft)]">Labour ({pkg.labour_hrs}h @ ${hourlyRate}/hr)</span>
                                  <span className="text-[var(--ink)] font-semibold">${(pkg.labour_hrs * hourlyRate).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-[13px] font-bold pt-0.5">
                                  <span className="text-[var(--ink)]">Total estimate</span>
                                  <span className="text-[var(--amber-deep)]">
                                    ${(pkg.items.reduce((s, it) => s + it.qty * it.unit_cost, 0) + pkg.labour_hrs * hourlyRate).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {/* Accept button */}
                            <div className="px-3.5 pb-3">
                              {accepted.has(pkg.title) ? (
                                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-green-600 py-2">
                                  <Check size={14} /> Added to packages
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAccept(pkg)}
                                  className="btn-primary w-full justify-center text-[12.5px] py-2.5"
                                >
                                  <Plus size={13} /> Add this package
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-[var(--ink-faint)] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <span className="text-[12px] text-[var(--ink-faint)]">Building package...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-[var(--line-subtle)]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={`e.g. "standard bathroom reno" or "new build lighting"`}
                className="app-field flex-1 text-[13px]"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="btn-primary px-3 py-2 shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setAccepted(new Set()); }}
                className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)] mt-1.5 hover:text-[var(--red)]"
              >
                <X size={11} /> Clear chat
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
