"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check, ChevronDown, ChevronUp, X, Circle,
  Sparkles, Clock,
} from "lucide-react";
import type { OnboardingProgress } from "@/lib/onboarding";

interface Props {
  initialProgress: OnboardingProgress;
}

export default function TrialOnboardingWidget({ initialProgress }: Props) {
  const [progress, setProgress] = useState(initialProgress);
  const [hidden, setHidden] = useState(initialProgress.dismissed);
  const [expandedDay, setExpandedDay] = useState<number | null>(initialProgress.trialDay);
  const [dismissing, setDismissing] = useState(false);

  if (hidden || !progress.trialActive) return null;

  async function dismiss() {
    setDismissing(true);
    setHidden(true); // optimistic -- don't make them wait on the network
    try {
      await fetch("/api/onboarding/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
    } catch {
      // best-effort; worst case it reappears next load and they dismiss again
    } finally {
      setDismissing(false);
    }
  }

  const totalTasks = progress.days.reduce((n, d) => n + d.tasks.length, 0);
  const doneTasks = progress.days.reduce((n, d) => n + d.tasks.filter((t) => t.done).length, 0);
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] mb-6 overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--navy)] px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-[var(--amber)]" />
          </div>
          <div>
            <p className="font-display text-[16px] text-white leading-tight">
              Trial checklist &mdash; Day {progress.trialDay} of 7
            </p>
            <p className="text-[12px] text-[var(--steel-3)] flex items-center gap-1 mt-0.5">
              <Clock size={11} />
              {progress.daysRemaining > 0
                ? `${progress.daysRemaining} day${progress.daysRemaining !== 1 ? "s" : ""} left in your trial`
                : "Trial ending today"}
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          disabled={dismissing}
          aria-label="Dismiss trial checklist"
          className="text-white/50 hover:text-white transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="h-1.5 rounded-full bg-[var(--line-subtle)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--amber)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-[var(--ink-faint)] mt-1.5 font-semibold">
          {doneTasks} of {totalTasks} steps done
        </p>
      </div>

      {/* Days */}
      <div className="px-3 py-2">
        {progress.days.map((d) => {
          const isExpanded = expandedDay === d.day;
          const isCurrent = d.day === progress.trialDay;
          return (
            <div key={d.day} className="border-b border-[var(--line-subtle)] last:border-b-0">
              <button
                onClick={() => setExpandedDay(isExpanded ? null : d.day)}
                className="w-full flex items-center gap-3 py-3 px-2 text-left hover:bg-[var(--amber-light)]/20 rounded-lg transition-colors"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    d.complete
                      ? "bg-[var(--amber)] border-[var(--amber)]"
                      : isCurrent
                      ? "border-[var(--navy)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  {d.complete ? (
                    <Check size={13} className="text-[var(--amber-deep)]" strokeWidth={3} />
                  ) : (
                    <span className={`text-[10px] font-bold ${isCurrent ? "text-[var(--navy)]" : "text-[var(--ink-faint)]"}`}>
                      {d.day}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13.5px] font-bold ${d.complete ? "text-[var(--ink-faint)] line-through" : "text-[var(--ink)]"}`}>
                    Day {d.day}: {d.title}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp size={15} className="text-[var(--ink-faint)] shrink-0" />
                ) : (
                  <ChevronDown size={15} className="text-[var(--ink-faint)] shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="pb-3 pl-11 pr-2 space-y-1.5">
                  {d.tasks.map((t) => (
                    <Link
                      key={t.key}
                      href={t.href}
                      className="flex items-center gap-2 py-1.5 group"
                    >
                      {t.done ? (
                        <Check size={14} className="text-[var(--amber-deep)] shrink-0" strokeWidth={3} />
                      ) : (
                        <Circle size={14} className="text-[var(--ink-faint)] shrink-0" />
                      )}
                      <span
                        className={`text-[13px] ${
                          t.done
                            ? "text-[var(--ink-faint)] line-through"
                            : "text-[var(--ink-soft)] group-hover:text-[var(--navy)] group-hover:underline"
                        }`}
                      >
                        {t.label}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {progress.overallComplete && (
        <div className="mx-3 mb-3 rounded-xl bg-[var(--amber)]/10 border border-[var(--amber)]/25 px-4 py-3 text-[13px] text-[var(--ink-soft)] font-semibold">
          You&apos;ve worked through the whole checklist &mdash; nice work. Ready to lock in a plan? <Link href="/billing" className="text-[var(--navy)] underline">Head to billing</Link>.
        </div>
      )}
    </div>
  );
}
