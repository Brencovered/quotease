import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadJobDetailData(supabase: SupabaseClient, id: string, profileId: string) {
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).eq("profile_id", profileId).single();
  if (!quote) return null;

  const [{ data: variations }, { data: actuals }, { data: certs }, { data: followUps }, { data: attachments }, { data: profile }] = await Promise.all([
    supabase.from("variations").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("job_actuals").select("*").eq("quote_id", id).order("recorded_at"),
    supabase.from("compliance_certs").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("follow_up_log").select("*").eq("quote_id", id).order("followed_up_at", { ascending: false }),
    supabase.from("job_attachments").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("profiles").select("hourly_rate, materials_margin_pct").eq("id", profileId).single(),
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
    quote,
    variations: variations ?? [],
    actuals: actuals ?? [],
    certsWithUrls,
    followUps: followUps ?? [],
    attachmentsWithUrls,
    hourlyRate: (profile as { hourly_rate: number } | null)?.hourly_rate ?? 95,
    marginPct: (profile as { materials_margin_pct: number } | null)?.materials_margin_pct ?? 20,
  };
}
