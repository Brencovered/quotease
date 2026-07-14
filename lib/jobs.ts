/**
 * lib/jobs.ts
 * -----------
 * A "job" is now a real row in the `jobs` table, not just
 * `quotes.status = 'accepted'`. Everything downstream (actuals, tasks,
 * attachments, variations, payments, comms, schedule) should link to a
 * job via job_id.
 *
 * Quote-sourced jobs are created the moment a quote is accepted (see
 * app/api/quotes/update-status). getOrCreateJobForQuote() is called from
 * more than one place (the accept API, and the quote detail page's
 * self-healing redirect), which can race - a unique index on
 * jobs.quote_id (see supabase/migrations/20260714_jobs_quote_id_unique.sql)
 * is what actually makes repeat calls safe: if two calls race, the DB
 * rejects the second INSERT and this function fetches the winning row
 * instead of erroring. That makes it safe to also use as a lazy backfill
 * for any quote accepted before this table existed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface JobRow {
  id: string;
  profile_id: string;
  quote_id: string | null;
  client_id: string | null;
  job_number: number;
  title: string | null;
  trade: string | null;
  status: string;
  source: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  site_address: string | null;
  site_notes: string | null;
  site_lat: number | null;
  site_lng: number | null;
  labour_hours: number | null;
  materials_cost: number | null;
  total_cost: number | null;
  scheduled_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_to_member_id: string | null;
  is_recurring_template: boolean;
  recurrence_rule: Record<string, unknown> | null;
  parent_job_id: string | null;
  next_occurrence_date: string | null;
  created_at: string;
  completed_at: string | null;
  invoiced_at: string | null;
  archived_at: string | null;
  cancelled_at: string | null;
}

/** Look up the job for a quote, if one already exists. */
export async function getJobByQuoteId(supabase: SupabaseClient, quoteId: string): Promise<JobRow | null> {
  const { data } = await supabase.from("jobs").select("*").eq("quote_id", quoteId).maybeSingle();
  return (data as JobRow) ?? null;
}

/**
 * Ensure a job exists for an accepted quote. Safe to call more than once -
 * returns the existing job if one is already there.
 */
export async function getOrCreateJobForQuote(supabase: SupabaseClient, quoteId: string): Promise<JobRow | null> {
  const existing = await getJobByQuoteId(supabase, quoteId);
  if (existing) return existing;

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (!quote) return null;

  const { data: created, error } = await supabase
    .from("jobs")
    .insert({
      profile_id: quote.profile_id,
      quote_id: quote.id,
      client_id: quote.client_id,
      title: quote.job_type ?? quote.trade,
      trade: quote.trade,
      status: "scheduled",
      source: "quote",
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_phone: quote.client_phone,
      site_address: quote.site_address,
      site_notes: quote.site_notes,
      site_lat: quote.site_lat,
      site_lng: quote.site_lng,
      labour_hours: quote.labour_hours,
      materials_cost: quote.materials_cost,
      total_cost: quote.total_cost,
      scheduled_date: quote.scheduled_date,
      scheduled_start: quote.scheduled_start,
      scheduled_end: quote.scheduled_end,
      assigned_to_member_id: quote.assigned_to_member_id,
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation. A concurrent call (the accept API and the
    // quote detail page's self-healing redirect both call this function,
    // and can race) already won and created the job a moment before this
    // insert ran - the DB-level unique index on quote_id is what's
    // stopping this from becoming a duplicate. Fetch and return that row
    // rather than treating it as a real failure.
    if (error.code === "23505") {
      return await getJobByQuoteId(supabase, quoteId);
    }
    console.error("getOrCreateJobForQuote: failed to create job -", error);
    return null;
  }

  // Attach any child rows already written against the quote (variations,
  // actuals, attachments, etc. logged before this job existed) so nothing
  // gets orphaned from the new job record.
  const childTables = ["job_actuals", "job_attachments", "job_tasks", "variations", "compliance_certs", "follow_up_log", "payments", "communication_log"];
  await Promise.all(
    childTables.map((table) => supabase.from(table).update({ job_id: created.id }).eq("quote_id", quoteId).is("job_id", null))
  );

  return created as JobRow;
}

export type QuickJobInput = {
  profileId: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  siteAddress?: string | null;
  trade?: string | null;
  description?: string | null;
  labourHours: number;
  hourlyRate: number;
  materialsCost?: number;
  scheduledDate?: string | null;
  assignedToMemberId?: string | null;
};

/** Create a job directly, bypassing the quote/quote-builder entirely. */
export async function createQuickJob(supabase: SupabaseClient, input: QuickJobInput): Promise<JobRow | null> {
  const totalCost = input.labourHours * input.hourlyRate + (input.materialsCost ?? 0);

  const { data: created, error } = await supabase
    .from("jobs")
    .insert({
      profile_id: input.profileId,
      title: input.description ?? "Quick job",
      trade: input.trade ?? null,
      status: "scheduled",
      source: "quick",
      client_name: input.clientName,
      client_email: input.clientEmail ?? null,
      client_phone: input.clientPhone ?? null,
      site_address: input.siteAddress ?? null,
      site_notes: input.description ?? null,
      labour_hours: input.labourHours,
      materials_cost: input.materialsCost ?? 0,
      total_cost: totalCost,
      scheduled_date: input.scheduledDate ?? null,
      assigned_to_member_id: input.assignedToMemberId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createQuickJob: failed -", error);
    return null;
  }
  return created as JobRow;
}

/**
 * Generate the next dated occurrence of a recurring job template. Advances
 * the template's next_occurrence_date by its recurrence_rule interval and
 * inserts a fresh job row (status reset to 'scheduled') for the new date.
 */
export async function generateNextOccurrence(supabase: SupabaseClient, templateJobId: string): Promise<JobRow | null> {
  const { data: template } = await supabase.from("jobs").select("*").eq("id", templateJobId).single();
  if (!template || !template.is_recurring_template) return null;

  const rule = (template.recurrence_rule ?? {}) as { freq?: "weekly" | "monthly"; interval?: number };
  const freq = rule.freq ?? "monthly";
  const interval = rule.interval ?? 1;
  const baseDate = template.next_occurrence_date ? new Date(template.next_occurrence_date) : new Date();

  const { data: occurrence, error } = await supabase
    .from("jobs")
    .insert({
      profile_id: template.profile_id,
      client_id: template.client_id,
      title: template.title,
      trade: template.trade,
      status: "scheduled",
      source: "recurring",
      client_name: template.client_name,
      client_email: template.client_email,
      client_phone: template.client_phone,
      site_address: template.site_address,
      site_notes: template.site_notes,
      labour_hours: template.labour_hours,
      materials_cost: template.materials_cost,
      total_cost: template.total_cost,
      scheduled_date: baseDate.toISOString().slice(0, 10),
      assigned_to_member_id: template.assigned_to_member_id,
      parent_job_id: template.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("generateNextOccurrence: failed -", error);
    return null;
  }

  const next = new Date(baseDate);
  if (freq === "weekly") next.setDate(next.getDate() + 7 * interval);
  else next.setMonth(next.getMonth() + interval);

  await supabase.from("jobs").update({ next_occurrence_date: next.toISOString().slice(0, 10) }).eq("id", template.id);

  return occurrence as JobRow;
}
