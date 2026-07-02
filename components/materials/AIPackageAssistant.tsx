"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, ChevronDown, ChevronUp, Check, Plus, AlertTriangle } from "lucide-react";

interface SuggestedItem {
  label:     string;
  qty:       number;
  unit:      string;
  unit_cost: number;
  matched?:  boolean; // true = unit_cost came from the tradie's price book, false/undefined = AI estimate
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

/** Fuzzy match an AI-suggested label against the price book.
 *  Returns the real unit_cost if a confident match is found, otherwise null. */
function lookupRealPrice(
  label: string,
  priceBook: { item_key: string; label: string; unit_cost: number }[]
): number | null {
  if (!priceBook.length) return null;
  const needle = label.toLowerCase();
  // Exact label match first
  const exact = priceBook.find(r => r.label.toLowerCase() === needle);
  if (exact) return exact.unit_cost;
  // Partial word match -- all words in the item label must appear in the price book label
  const words = needle.split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return null;
  const match = priceBook.find(r => {
    const hay = r.label.toLowerCase();
    return words.every(w => hay.includes(w));
  });
  return match?.unit_cost ?? null;
}

export default function AIPackageAssistant({
  trade,
  hourlyRate,
  priceBook = [],
  onCreatePackage,
}: {
  trade:           string;
  hourlyRate:      number;
  priceBook:       { item_key: string; label: string; unit_cost: number }[];
  onCreatePackage: (pkg: SuggestedPackage) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const SYSTEM = `You are an expert Australian trade business assistant helping a ${trade} build reusable job packages in Swiftscope.

When the tradie describes a job type, respond with:
1. A short helpful sentence
2. One or more package suggestions as a JSON code block

Each package must use this exact format:
\`\`\`json
[
  {
    "title": "Package name",
    "trade": "${trade}",
    "description": "What's included",
    "labour_hrs": 4,
    "items": [
      { "label": "Item name", "qty": 1, "unit": "each", "unit_cost": 45 }
    ]
  }
]
\`\`\`

Rules:
- Australian trade terminology and wholesale prices (not retail)
- Units: each, m, m2, hr, lot
- 3 to 8 line items per package
- Labour hours realistic for job size
- Tradie hourly rate is $${hourlyRate}/hr
${priceBook.length > 0 ? `- The tradie has ${priceBook.length} items in their price book. Your suggested item names should match real items where possible (e.g. "Downlight, standard", "Power point", "Switch"). Prices will be updated automatically from their price book after you respond.` : "- No price book connected yet, use realistic Australian trade prices."}
- After the JSON add a short note about what to customise`;

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI error");
      const text: string = data.text ?? "";

      // Extract JSON packages
      const packages: SuggestedPackage[] = [];
      const match = text.match(/```json\s*([\s\S]*?)```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) packages.push(...parsed);
        } catch {}
      }

      // Replace AI-estimated prices with real price book prices where possible,
      // and record whether each item actually matched so the UI never shows
      // a guess indistinguishably from a real supplier cost.
      const pricedPackages = packages.map(pkg => ({
        ...pkg,
        items: pkg.items.map(item => {
          const realPrice = lookupRealPrice(item.label, priceBook);
          return realPrice != null
            ? { ...item, unit_cost: realPrice, matched: true }
            : { ...item, matched: false };
        }),
      }));

      const cleanText = text.replace(/```json[\s\S]*?```/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: cleanText, packages: pricedPackages }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong. Try again." }]);
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
    "EV charger install",
    "Solar connection",
  ];

  return (
    <div className="rounded-2xl border border-[var(--line)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-[var(--navy)] text-left border-0"
      >
        <div className="w-8 h-8 bg-[var(--amber)] rounded-xl flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-[var(--navy)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[13.5px] text-white">AI package assistant</p>
          <p className="text-[11.5px] text-white/50 truncate">Describe a job type and get a ready-to-use package</p>
        </div>
        {open
          ? <ChevronUp size={16} className="text-white/40 shrink-0" />
          : <ChevronDown size={16} className="text-white/40 shrink-0" />}
      </button>

      {open && (
        <div className="flex flex-col bg-[var(--surface)]" style={{ maxHeight: 560 }}>
          {/* Starter prompts */}
          {messages.length === 0 && (
            <div className="px-4 pt-3 pb-2 shrink-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-faint)] mb-2">Try asking about</p>
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Thread */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[88%] space-y-2">
                  {msg.content && (
                    <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--navy)] text-white rounded-tr-sm"
                        : "bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink)] rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  )}

                  {msg.packages?.map((pkg, pi) => {
                    const matTotal = pkg.items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
                    const total    = matTotal + pkg.labour_hrs * hourlyRate;
                    return (
                      <div key={pi} className="bg-white border border-[var(--line)] rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-3.5 pt-3 pb-2">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-bold text-[13.5px] text-[var(--ink)] leading-tight">{pkg.title}</p>
                            <span className="text-[10px] font-bold text-[var(--amber-deep)] bg-amber-50 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                              {pkg.labour_hrs}h labour
                            </span>
                          </div>
                          {pkg.description && (
                            <p className="text-[12px] text-[var(--ink-faint)] mb-2">{pkg.description}</p>
                          )}
                          {(() => {
                            const matchedCount = pkg.items.filter(it => it.matched).length;
                            return matchedCount < pkg.items.length ? (
                              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
                                <AlertTriangle size={11} className="text-[var(--amber-deep)] shrink-0" />
                                <p className="text-[10.5px] font-semibold text-[var(--amber-deep)]">
                                  {matchedCount} of {pkg.items.length} items priced from your price book — the rest are estimates, check before sending
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-green-50 border border-green-200">
                                <Check size={11} className="text-green-700 shrink-0" />
                                <p className="text-[10.5px] font-semibold text-green-700">
                                  All items priced from your price book
                                </p>
                              </div>
                            );
                          })()}
                          <div className="space-y-0.5 mb-2">
                            {pkg.items.map((item, ii) => (
                              <div key={ii} className="flex items-center justify-between text-[12px]">
                                <span className="text-[var(--ink-soft)] truncate flex-1 flex items-center gap-1">
                                  {item.qty} {item.unit} × {item.label}
                                  {!item.matched && (
                                    <span className="text-[9px] font-bold text-[var(--amber-deep)] bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">
                                      EST.
                                    </span>
                                  )}
                                </span>
                                <span className="text-[var(--ink)] font-semibold ml-2 shrink-0">${(item.qty * item.unit_cost).toLocaleString()}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between text-[12px] pt-1 border-t border-[var(--line-subtle)] mt-1">
                              <span className="text-[var(--ink-soft)]">Labour ({pkg.labour_hrs}h)</span>
                              <span className="font-semibold">${(pkg.labour_hrs * hourlyRate).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[13px] font-bold">
                              <span className="text-[var(--ink)]">Estimate</span>
                              <span className="text-[var(--amber-deep)]">${total.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-3.5 pb-3">
                          {accepted.has(pkg.title) ? (
                            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-green-600 py-1.5">
                              <Check size={13} /> Added to packages
                            </div>
                          ) : (
                            <button onClick={() => handleAccept(pkg)} className="btn-primary w-full justify-center text-[12.5px] py-2.5">
                              <Plus size={13} /> Add this package
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-[var(--ink-faint)] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                  <span className="text-[12px] text-[var(--ink-faint)]">Building package...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input -- fixed at bottom */}
          <div className="shrink-0 border-t border-[var(--line-subtle)] bg-[var(--surface)] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="e.g. bathroom reno, new build lighting..."
                className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--navy)] transition-colors"
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="btn-primary px-3 py-2.5 shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setAccepted(new Set()); }}
                className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)] mt-1.5 hover:text-[var(--red)] border-0 bg-transparent">
                <X size={11} /> Clear chat
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
