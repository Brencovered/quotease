/**
 * lib/adminEngagement.ts
 * ----------------------
 * Computes a single 0-100 "engagement / onboarding progress" score for a
 * tradie account, used as the progress bar on the admin dashboard.
 *
 * Milestones are weighted by how deep into actually using the product they
 * represent -- signing up is worth less than a client accepting a quote.
 */

export interface TradieEngagementInputs {
  onboarded: boolean;       // picked their trade(s) -- profiles.onboarded_at
  hasMaterials: boolean;    // set up at least one material/price item
  quotesCreated: number;
  quotesSent: number;
  quotesAccepted: number;
  hasSignedIn: boolean;     // auth.users.last_sign_in_at is not null
}

export interface EngagementMilestone {
  key: string;
  label: string;
  weight: number;
  done: boolean;
}

export interface EngagementResult {
  pct: number; // 0-100
  milestones: EngagementMilestone[];
  furthestLabel: string;
}

export function computeEngagement(inputs: TradieEngagementInputs): EngagementResult {
  const milestones: EngagementMilestone[] = [
    { key: "signed_up",   label: "Signed up",           weight: 10, done: true },
    { key: "signed_in",   label: "Logged in",           weight: 10, done: inputs.hasSignedIn },
    { key: "onboarded",   label: "Picked trade(s)",     weight: 15, done: inputs.onboarded },
    { key: "materials",   label: "Set up pricing",      weight: 15, done: inputs.hasMaterials },
    { key: "quote_created", label: "Created a quote",   weight: 20, done: inputs.quotesCreated > 0 },
    { key: "quote_sent",  label: "Sent a quote",         weight: 20, done: inputs.quotesSent > 0 },
    { key: "quote_won",   label: "Had a quote accepted", weight: 10, done: inputs.quotesAccepted > 0 },
  ];

  const totalWeight = milestones.reduce((s, m) => s + m.weight, 0);
  const earned = milestones.reduce((s, m) => s + (m.done ? m.weight : 0), 0);
  const pct = Math.round((earned / totalWeight) * 100);

  const furthest = [...milestones].reverse().find((m) => m.done);

  return { pct, milestones, furthestLabel: furthest?.label ?? "Signed up" };
}
