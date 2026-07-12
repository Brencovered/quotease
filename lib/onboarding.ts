/**
 * lib/onboarding.ts
 * -----------------
 * Computes the 7-day trial onboarding checklist for a business.
 *
 * Design: milestones are derived live from real tables wherever a clean
 * signal exists (a quote was actually sent, a job actually exists) rather
 * than manually toggled -- a business that jumps straight to Day 5 stuff
 * on Day 1 should see Day 1-4 already ticked off, not be nagged about
 * steps they've effectively completed. The only two milestones with no
 * queryable signal (AI assistant usage, viewing the productivity report)
 * are tracked in `onboarding_state`, written by the routes/pages that
 * fire them (see app/api/ai/business-assistant/route.ts and
 * app/electrician/reports/page.tsx).
 *
 * Trial day is computed from profiles.created_at, not login count or
 * wall-clock "days since first visit" -- someone who signs up and comes
 * back after a week away is still on Day 7, not Day 1.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const TRIAL_LENGTH_DAYS = 7;

export interface DayTask {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export interface OnboardingDay {
  day: number;
  title: string;
  tasks: DayTask[];
  complete: boolean;
}

export interface OnboardingProgress {
  trialDay: number; // 1-7, clamped
  trialEndsAt: string | null;
  trialActive: boolean;
  daysRemaining: number;
  dismissed: boolean;
  days: OnboardingDay[];
  overallComplete: boolean;
}

/** Which calendar day of the trial (1-7, clamped) a business is on. */
export function computeTrialDay(createdAt: string, now: Date = new Date()): number {
  const start = new Date(createdAt);
  const msPerDay = 1000 * 60 * 60 * 24;
  const elapsed = Math.floor((now.getTime() - start.getTime()) / msPerDay);
  return Math.min(Math.max(elapsed + 1, 1), TRIAL_LENGTH_DAYS);
}

export async function getOnboardingProgress(
  supabase: SupabaseClient,
  businessId: string
): Promise<OnboardingProgress> {
  const [
    { data: profile },
    { data: onboardingState },
    { count: priceBookCount },
    { count: teamCount },
    { count: attachmentCount },
    { count: quoteCount },
    { count: sentQuoteCount },
    { count: jobCount },
    { count: assignedJobCount },
    { count: movedJobCount },
    { count: invoicedCount },
    { count: pushCount },
  ] = await Promise.all([
    supabase.from("profiles").select("created_at, trial_ends_at").eq("id", businessId).single(),
    supabase.from("onboarding_state").select("dismissed, ai_assistant_used_at, report_viewed_at").eq("profile_id", businessId).maybeSingle(),
    supabase.from("price_book_items").select("id", { count: "exact", head: true }).eq("profile_id", businessId),
    supabase.from("team_members").select("id", { count: "exact", head: true }).eq("owner_profile_id", businessId),
    supabase.from("job_attachments").select("id", { count: "exact", head: true }).eq("profile_id", businessId),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("profile_id", businessId),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("profile_id", businessId).in("status", ["sent", "accepted", "paid"]),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("profile_id", businessId),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("profile_id", businessId).not("assigned_to_member_id", "is", null),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("profile_id", businessId).neq("status", "scheduled"),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("profile_id", businessId).not("invoice_number", "is", null),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("business_id", businessId),
  ]);

  const createdAt = profile?.created_at ?? new Date().toISOString();
  const trialEndsAt = profile?.trial_ends_at ?? null;
  const trialDay = computeTrialDay(createdAt);
  const trialActive = !!trialEndsAt && new Date(trialEndsAt) > new Date();
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const hasPriceBook = (priceBookCount ?? 0) > 0;
  const hasTeam = (teamCount ?? 0) > 0;
  const hasDrawing = (attachmentCount ?? 0) > 0;
  const hasQuote = (quoteCount ?? 0) > 0;
  const hasSentQuote = (sentQuoteCount ?? 0) > 0;
  const hasJob = (jobCount ?? 0) > 0;
  const hasAssignedJob = (assignedJobCount ?? 0) > 0;
  const hasMovedJob = (movedJobCount ?? 0) > 0;
  const hasInvoice = (invoicedCount ?? 0) > 0;
  const hasAiAssistant = !!onboardingState?.ai_assistant_used_at;
  const hasPush = (pushCount ?? 0) > 0;
  const hasReportView = !!onboardingState?.report_viewed_at;

  const days: OnboardingDay[] = [
    {
      day: 1,
      title: "Set the foundations",
      tasks: [
        { key: "price_book", label: "Upload or import your pricing", href: "/electrician/materials", done: hasPriceBook },
        { key: "team", label: "Invite your team", href: "/electrician/team", done: hasTeam },
      ],
      complete: hasPriceBook && hasTeam,
    },
    {
      day: 2,
      title: "Get your first quote out",
      tasks: [
        { key: "drawing", label: "Upload a drawing and try AI takeoff or markup", href: "/electrician/plans", done: hasDrawing },
        { key: "quote", label: "Build a quote", href: "/electrician/quotes", done: hasQuote },
      ],
      complete: hasDrawing && hasQuote,
    },
    {
      day: 3,
      title: "Win it and turn it into a job",
      tasks: [
        { key: "sent_quote", label: "Send a quote to a client", href: "/electrician/quotes", done: hasSentQuote },
        { key: "job", label: "See it land on the jobs board", href: "/electrician/jobs", done: hasJob },
      ],
      complete: hasSentQuote && hasJob,
    },
    {
      day: 4,
      title: "Run the job",
      tasks: [
        { key: "assigned_job", label: "Assign a job to a team member", href: "/electrician/jobs", done: hasAssignedJob },
        { key: "moved_job", label: "Move a job through its stages (or add a Quick Job)", href: "/electrician/jobs", done: hasMovedJob },
      ],
      complete: hasAssignedJob && hasMovedJob,
    },
    {
      day: 5,
      title: "Get paid",
      tasks: [
        { key: "invoice", label: "Generate an invoice from a completed job", href: "/electrician/jobs", done: hasInvoice },
      ],
      complete: hasInvoice,
    },
    {
      day: 6,
      title: "Work smarter",
      tasks: [
        { key: "ai_assistant", label: "Ask the business AI assistant something", href: "/electrician/dashboard", done: hasAiAssistant },
        { key: "push", label: "Turn on push notifications", href: "/settings", done: hasPush },
      ],
      complete: hasAiAssistant && hasPush,
    },
    {
      day: 7,
      title: "See the payoff",
      tasks: [
        { key: "report", label: "Check your team productivity report", href: "/electrician/reports", done: hasReportView },
      ],
      complete: hasReportView,
    },
  ];

  return {
    trialDay,
    trialEndsAt,
    trialActive,
    daysRemaining,
    dismissed: onboardingState?.dismissed ?? false,
    days,
    overallComplete: days.every((d) => d.complete),
  };
}

/** Mark a milestone with no clean DB signal. Upserts onboarding_state. */
export async function markOnboardingMilestone(
  supabase: SupabaseClient,
  businessId: string,
  field: "ai_assistant_used_at" | "report_viewed_at"
): Promise<void> {
  await supabase
    .from("onboarding_state")
    .upsert({ profile_id: businessId, [field]: new Date().toISOString() }, { onConflict: "profile_id" });
}
