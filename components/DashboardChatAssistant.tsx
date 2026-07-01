"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, MessageSquare } from "lucide-react";
import type { DashboardStats, ProfitStats } from "@/lib/dashboardStats";

interface Message {
  role:    "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "How is my conversion rate?",
  "What's my average quote value?",
  "How fast am I quoting?",
  "Where am I losing jobs?",
  "Tips to improve my win rate",
];

export default function DashboardChatAssistant({
  stats,
  profit,
}: {
  stats:  DashboardStats;
  profit: ProfitStats;
}) {
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Build a stats summary string for the system prompt
  const statsSummary = `
Current business stats:
- Total quotes sent: ${stats.byStatus?.sent ?? 0}
- Accepted: ${stats.byStatus?.accepted ?? 0}
- Paid: ${stats.byStatus?.paid ?? 0}
- Draft: ${stats.byStatus?.draft ?? 0}
- Declined: ${stats.byStatus?.declined ?? 0}
- Total quoted value: $${Math.round(stats.totalQuotedValue ?? 0).toLocaleString()}
- Total collected: $${Math.round(stats.totalCollected ?? 0).toLocaleString()}
- Win rate: ${stats.winRate != null ? (stats.winRate * 100).toFixed(1) + "%" : "not enough data"}
- Average job value: $${Math.round(stats.avgJobValue ?? 0).toLocaleString()}
- Expired quotes: ${stats.expiredQuotes ?? 0}
- Follow-ups overdue: ${stats.overdueFollowUps ?? 0}
- Avg time to send quote: ${stats.avgQuoteTimeMinutes != null ? stats.avgQuoteTimeMinutes.toFixed(0) + " minutes" : "not tracked"}
- Time saved vs manual: ${stats.timeSavedMinutes != null ? stats.timeSavedMinutes + " minutes total" : "not tracked"}
${profit.jobsTracked > 0 ? `- Jobs with profit tracked: ${profit.jobsTracked}
- Total profit: $${Math.round(profit.totalProfit).toLocaleString()}
- Average margin: ${profit.avgMarginPct != null ? profit.avgMarginPct.toFixed(1) + "%" : "N/A"}` : "- No profit data tracked yet"}
`.trim();

  const SYSTEM = `You are a practical business assistant for an Australian tradie using Swiftscope, a quoting and job management platform.

Here are their current business stats:
${statsSummary}

Your job is to help them understand their numbers, identify opportunities, and give actionable advice to grow their trade business. Keep answers short and direct -- they're reading this on a phone. Use dollar signs and percentages where relevant. If data is missing, say so honestly rather than guessing. Speak like a straight-talking business advisor, not a corporate consultant.`;

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
      setMessages(prev => [...prev, { role: "assistant", content: data.text ?? "" }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: e instanceof Error ? e.message : "Something went wrong. Try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 bg-[var(--navy)] text-white font-bold text-[13px] px-4 py-3 rounded-full shadow-lg border-0"
        style={{ boxShadow: "0 4px 20px rgba(10,23,34,0.25)" }}
      >
        <Sparkles size={15} className="text-[var(--amber)]" />
        Ask about your numbers
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-20 right-4 left-4 z-40 bg-[var(--surface)] rounded-2xl border border-[var(--line)] flex flex-col"
      style={{ maxHeight: "60vh", boxShadow: "0 8px 40px rgba(10,23,34,0.18)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--navy)] rounded-t-2xl shrink-0">
        <Sparkles size={14} className="text-[var(--amber)]" />
        <p className="font-bold text-[13.5px] text-white flex-1">Business assistant</p>
        <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white border-0 bg-transparent p-1">
          <X size={16} />
        </button>
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => setInput(p)}
                className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--navy)] hover:text-[var(--navy)] transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-[var(--amber)] rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare size={11} className="text-[var(--navy)]" />
            </div>
            <p className="text-[13px] text-[var(--ink-soft)] bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl rounded-tl-sm px-3 py-2.5 leading-relaxed">
              Ask me anything about your quotes, revenue, win rate, or what to focus on next.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start items-start gap-2"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 bg-[var(--amber)] rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare size={11} className="text-[var(--navy)]" />
              </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "bg-[var(--navy)] text-white rounded-tr-sm"
                : "bg-[var(--app-bg)] border border-[var(--line)] text-[var(--ink)] rounded-tl-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start items-start gap-2">
            <div className="w-6 h-6 bg-[var(--amber)] rounded-full flex items-center justify-center shrink-0">
              <MessageSquare size={11} className="text-[var(--navy)]" />
            </div>
            <div className="bg-[var(--app-bg)] border border-[var(--line)] rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-[var(--ink-faint)] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--line-subtle)] px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about your business..."
            className="app-field flex-1 text-[13px]"
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
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-[11px] text-[var(--ink-faint)] mt-1.5 hover:text-[var(--red)] border-0 bg-transparent">
            <X size={11} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
