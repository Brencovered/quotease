/**
 * Directory lead priority matrix + pipeline helpers.
 *
 * Hot  - budget in mind and looking to start ASAP
 * Warm - have an idea, checking / comparing prices
 * Cold - costing a job 6+ months out
 */

export type LeadPriority = "hot" | "warm" | "cold";
export type LeadUrgency = "asap" | "checking" | "later";
export type LeadPipelineStatus =
  | "new"
  | "quoting"
  | "quote_sent"
  | "quote_rejected"
  | "quote_won"
  | "on_job";

export const PRIORITY_LABEL: Record<LeadPriority, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const PRIORITY_HINT: Record<LeadPriority, string> = {
  hot: "Budget ready · start ASAP",
  warm: "Checking prices",
  cold: "6+ months out",
};

export const PIPELINE_LABEL: Record<LeadPipelineStatus, string> = {
  new: "New lead",
  quoting: "Quote in progress",
  quote_sent: "Quote sent",
  quote_rejected: "Quote rejected",
  quote_won: "Quote won",
  on_job: "On a job",
};

export const URGENCY_OPTIONS: { id: LeadUrgency; label: string; priority: LeadPriority }[] = [
  { id: "asap", label: "Ready to start soon - I have a budget", priority: "hot" },
  { id: "checking", label: "Have an idea - just checking prices", priority: "warm" },
  { id: "later", label: "Planning 6+ months ahead - want a sense of cost", priority: "cold" },
];

export function priorityFromUrgency(urgency: string | null | undefined): LeadPriority | null {
  const match = URGENCY_OPTIONS.find((o) => o.id === urgency);
  return match?.priority ?? null;
}

/** Map quote lifecycle → lead pipeline (won follows accept; paid stays won/on_job). */
export function pipelineFromQuoteStatus(status: string | null | undefined): LeadPipelineStatus | null {
  switch (status) {
    case "draft":
      return "quoting";
    case "sent":
      return "quote_sent";
    case "declined":
      return "quote_rejected";
    case "accepted":
    case "paid":
      return "quote_won";
    default:
      return null;
  }
}

export function makeLeadCode(id: string): string {
  return `DL-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export type DirectoryLeadSummary = {
  id: string;
  lead_code: string | null;
  priority: LeadPriority | null;
  urgency: string | null;
  pipeline_status: LeadPipelineStatus;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_description: string | null;
  budget: string | null;
  customer_type: string | null;
  other_quotes: string | null;
  notes: string | null;
  site_suburb: string | null;
  photo_paths: string[] | null;
  photo_urls?: { path: string; url: string; name: string }[];
  business_name: string | null;
  is_claimed: boolean | null;
  profile_id: string | null;
  quote_id: string | null;
  job_id: string | null;
  created_at: string;
  status: string | null;
};
