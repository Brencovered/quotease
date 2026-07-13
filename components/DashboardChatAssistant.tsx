"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, X, MessageSquare, ArrowRight, FileText } from "lucide-react";
import type { DashboardStats, ProfitStats } from "@/lib/dashboardStats";

interface QuoteDraftAction {
  type: "open_quote_draft";
  url: string;
  title: string;
  itemCount: number;
  pricedCount: number;
  estimatedTotal: number;
}
interface NavigateAction {
  type: "navigate";
  url: string;
  label: string;
  reason?: string;
}
type AssistantAction = QuoteDraftAction | NavigateAction;

interface Message {
  role:    "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
}

const QUICK_PROMPTS = [
  "How is my conversion rate?",
  "Quote a bathroom rough-in for me",
  "How do I add a new client?",
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
  const router     = useRouter();

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

Your job is to help them understand their numbers, identify opportunities, give actionable advice, and help them get things done in the app.

You have three tools:
- search_price_book: look up real items and prices from their own price book. Always use this before create_quote_draft -- never invent a price.
- create_quote_draft: builds a real, editable draft quote from priced items. Use this whenever they ask you to quote a job (e.g. "quote a bathroom rough-in", "put together a quote for 6 downlights and 4 GPOs"). Search for each item first, include real item_keys where you find a match, and still include items you can't match (just omit item_key) so they can price those themselves -- say so plainly in your reply. The tradie still reviews everything, adds their client's details, and hits send themselves -- you're drafting, not sending.
- suggest_navigation: when walking them through a task that isn't quote creation (managing a job, checking their price book, inviting a team member, exporting to Xero, etc), offer a button to the actual page rather than just describing where to click.

Keep answers short and direct -- they're reading this on a phone. Use dollar signs and percentages where relevant. If data is missing, say so honestly rather than guessing. Speak like a straight-talking business advisor, not a corporate consultant.`;

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/business-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI error");
      setMessages(prev => [...prev, { role: "assistant", content: data.text ?? "", actions: data.actions ?? [] }]);
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
              Ask me anything about your quotes, revenue, or win rate -- or ask me to quote a job and I&apos;ll put together a draft from your price book.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start items-start gap-2"} w-full`}>
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

            {msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2 ml-8 w-full max-w-[82%]">
                {msg.actions.map((action, j) =>
                  action.type === "open_quote_draft" ? (
                    <button
                      key={j}
                      onClick={() => router.push(action.url)}
                      className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-xl px-3 py-2.5 text-left hover:bg-[#121f2b] transition-colors"
                    >
                      <FileText size={15} className="text-[var(--amber)] shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] font-bold truncate">{action.title}</span>
                        <span className="block text-[11px] text-white/70">
                          {action.itemCount} items{action.pricedCount < action.itemCount ? ` (${action.itemCount - action.pricedCount} need pricing)` : ""} · ~${action.estimatedTotal.toLocaleString()}
                        </span>
                      </span>
                      <ArrowRight size={14} className="shrink-0" />
                    </button>
                  ) : (
                    <button
                      key={j}
                      onClick={() => router.push(action.url)}
                      className="flex items-center gap-2 bg-white border border-[var(--line)] rounded-xl px-3 py-2 text-left hover:border-[var(--navy)] transition-colors"
                    >
                      <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-[var(--ink)]">{action.label}</span>
                      <ArrowRight size={13} className="text-[var(--ink-faint)] shrink-0" />
                    </button>
                  )
                )}
              </div>
            )}
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
            className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--navy)] transition-colors"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="btn-primary px-3 py-2.5 shrink-0"
            style={{ width: "auto" }}
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
