import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateJobForQuote } from "@/lib/jobs";

/**
 * A job detail page is keyed by the job's own id now, not the quote's.
 * Quote-sourced jobs still carry a linked `quote` (for scope/PDF/markup
 * data that genuinely lives on the quote); quick jobs and recurring
 * occurrences have no quote at all and run on job fields alone.
 */
export async function loadJobDetailData(supabase: SupabaseClient, idParam: string, profileId: string) {
  // Existing links across the app (quotes list, margin dashboard, map,
  // client history) still point at the quote id. Resolve either shape so
  // nothing breaks: try it as a job id first, then fall back to treating
  // it as the quote id a job was created from.
  let job = (await supabase.from("jobs").select("*").eq("id", idParam).eq("profile_id", profileId).maybeSingle()).data;
  if (!job) {
    job = (await supabase.from("jobs").select("*").eq("quote_id", idParam).eq("profile_id", profileId).maybeSingle()).data;
  }
  // Self-heal: an accepted quote should always have a job, but if job
  // creation raced or failed at accept-time, create it now rather than
  // 404ing on a quote that's genuinely won.
  let quoteCheck: { id: string; status: string } | null = null;
  if (!job) {
    const result = await supabase.from("quotes").select("id, status").eq("id", idParam).eq("profile_id", profileId).maybeSingle();
    quoteCheck = result.data;
    if (quoteCheck && (quoteCheck.status === "accepted" || quoteCheck.status === "paid")) {
      job = await getOrCreateJobForQuote(supabase, idParam);
    }
  }

  // A quote that hasn't been won yet (draft/sent/declined) has no job at
  // all - that's normal, not an error (see app/electrician/quotes/[id]/
  // page.tsx, "exclusively pre-acceptance"). Without this, every one of
  // those quotes 404'd, since the rest of this function assumes a real
  // job row exists to key everything off. Build the same return shape
  // from quote-keyed queries instead.
  if (!job) {
    if (!quoteCheck) {
      const result = await supabase.from("quotes").select("id, status").eq("id", idParam).eq("profile_id", profileId).maybeSingle();
      quoteCheck = result.data;
    }
    if (!quoteCheck) return null;

    const [{ data: quote }, { data: followUps }, { data: attachments }, { data: profile }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", idParam).single(),
      supabase.from("follow_up_log").select("*").eq("quote_id", idParam).order("followed_up_at", { ascending: false }),
      supabase.from("job_attachments").select("*").eq("quote_id", idParam).order("created_at"),
      supabase.from("profiles").select("hourly_rate, materials_margin_pct").eq("id", profileId).single(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachmentsWithUrls: any[] = await Promise.all(
      (attachments ?? []).map(async (a: Record<string, unknown>) => {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(a.storage_path as string, 3600);
        return { ...a, signedUrl: signed?.signedUrl };
      })
    );

    return {
      job: null,
      quote: quote ?? null,
      variations: [],
      actuals: [],
      certsWithUrls: [],
      followUps: followUps ?? [],
      attachmentsWithUrls,
      payments: [],
      hourlyRate: (profile as { hourly_rate: number } | null)?.hourly_rate ?? 95,
      marginPct: (profile as { materials_margin_pct: number } | null)?.materials_margin_pct ?? 20,
    };
  }
  const jobId = job.id;

  const quotePromise = job.quote_id
    ? supabase.from("quotes").select("*").eq("id", job.quote_id).single()
    : Promise.resolve({ data: null });

  const [{ data: quote }, { data: variations }, { data: actuals }, { data: certs }, { data: followUps }, { data: attachments }, { data: profile }, { data: payments }] = await Promise.all([
    quotePromise,
    supabase.from("variations").select("*").or(`job_id.eq.${jobId}${job.quote_id ? `,quote_id.eq.${job.quote_id}` : ""}`).order("created_at"),
    supabase.from("job_actuals").select("*").or(`job_id.eq.${jobId}${job.quote_id ? `,quote_id.eq.${job.quote_id}` : ""}`).order("recorded_at"),
    supabase.from("compliance_certs").select("*").or(`job_id.eq.${jobId}${job.quote_id ? `,quote_id.eq.${job.quote_id}` : ""}`).order("created_at"),
    supabase.from("follow_up_log").select("*").or(`job_id.eq.${jobId}${job.quote_id ? `,quote_id.eq.${job.quote_id}` : ""}`).order("followed_up_at", { ascending: false }),
    supabase.from("job_attachments").select("*").or(`job_id.eq.${jobId}${job.quote_id ? `,quote_id.eq.${job.quote_id}` : ""}`).order("created_at"),
    supabase.from("profiles").select("hourly_rate, materials_margin_pct").eq("id", profileId).single(),
    supabase.from("payments").select("*").or(`job_id.eq.${jobId}${job.quote_id ? `,quote_id.eq.${job.quote_id}` : ""}`).order("recorded_at"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachmentsWithUrls: any[] = await Promise.all(
    (attachments ?? []).map(async (a: Record<string, unknown>) => {
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(a.storage_path as string, 3600);
      return { ...a, signedUrl: signed?.signedUrl };
    })
  );

  const certsWithUrls = await Promise.all(
    (certs ?? []).map(async (c: Record<string, unknown>) => {
      if (!c.storage_path) return c;
      const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(c.storage_path as string, 3600 * 24 * 365);
      return { ...c, signedUrl: signed?.signedUrl };
    })
  );

  return {
    job,
    quote: quote ?? null,
    variations: variations ?? [],
    actuals: actuals ?? [],
    certsWithUrls,
    followUps: followUps ?? [],
    attachmentsWithUrls,
    payments: payments ?? [],
    hourlyRate: (profile as { hourly_rate: number } | null)?.hourly_rate ?? 95,
    marginPct: (profile as { materials_margin_pct: number } | null)?.materials_margin_pct ?? 20,
  };
}
