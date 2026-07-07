/**
 * GET /api/cron/generate-recurring-jobs
 * --------------------------------------
 * Daily automation (see vercel.json for schedule). The recurring-jobs
 * schema (is_recurring_template, recurrence_rule, next_occurrence_date,
 * parent_job_id) has existed for a while, but until this route nothing
 * ever advanced a template automatically -- generateNextOccurrence()
 * in lib/jobs.ts was only reachable via a manual "generate next" button
 * in QuickJobsPanel. A tradie who set up a recurring job and didn't
 * remember to click that button simply never got the follow-up job.
 *
 * This finds every recurring template whose next_occurrence_date has
 * arrived (or passed) and spawns occurrences for it, looping per
 * template in case the cron missed one or more prior days (e.g. an
 * outage) so occurrences aren't silently skipped -- capped so a bad
 * or ancient row can't spin forever.
 *
 * AUTH: protected by CRON_SECRET, same pattern as the other cron routes
 * (see /api/cron/purge-deleted-accounts) -- Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically once that env var
 * is set in the Vercel project and referenced in vercel.json.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNextOccurrence } from "@/lib/jobs";

const MAX_OCCURRENCES_PER_TEMPLATE = 24; // safety cap per run, not a product limit

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[generate-recurring-jobs] CRON_SECRET is not set -- rejecting all requests, including Vercel's own cron trigger.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueTemplates, error } = await admin
    .from("jobs")
    .select("id, profile_id, next_occurrence_date")
    .eq("is_recurring_template", true)
    .lte("next_occurrence_date", today)
    .is("cancelled_at", null)
    .is("archived_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { templateId: string; profileId: string; spawned: number; ok: boolean; error?: string }[] = [];

  for (const template of dueTemplates ?? []) {
    let spawned = 0;
    let ok = true;
    let lastError: string | undefined;

    try {
      // Loop in case next_occurrence_date is more than one period behind
      // today (e.g. the cron didn't run for a while) - keep spawning
      // occurrences until the template is caught up to today.
      for (let i = 0; i < MAX_OCCURRENCES_PER_TEMPLATE; i++) {
        const { data: current } = await admin
          .from("jobs")
          .select("next_occurrence_date")
          .eq("id", template.id)
          .single();

        if (!current?.next_occurrence_date || current.next_occurrence_date > today) break;

        const occurrence = await generateNextOccurrence(admin, template.id);
        if (!occurrence) {
          ok = false;
          lastError = "generateNextOccurrence returned null";
          break;
        }
        spawned++;
      }
    } catch (err) {
      ok = false;
      lastError = err instanceof Error ? err.message : String(err);
    }

    results.push({ templateId: template.id, profileId: template.profile_id, spawned, ok, error: lastError });
  }

  const totalSpawned = results.reduce((sum, r) => sum + r.spawned, 0);
  const failedCount = results.filter((r) => !r.ok).length;
  if (failedCount > 0) {
    console.error("[generate-recurring-jobs] failures:", results.filter((r) => !r.ok));
  }

  return NextResponse.json({
    checked: dueTemplates?.length ?? 0,
    spawned: totalSpawned,
    failed: failedCount,
    results,
  });
}
