/**
 * POST /api/admin/account-controls
 * --------------------------------
 * Admin-only. Updates account-level controls on a tradie profile:
 *
 *   - trial_ends_at: set/extend the trial end date (ISO string or null)
 *   - comp_access: grant/revoke complimentary access (bypasses billing)
 *   - ai_analyses_limit_override: per-account free AI drawing analyses
 *     limit (integer, or null to restore the app default)
 *
 * Body: {
 *   profileId: string,
 *   trialEndsAt?: string | null,       // ISO date, only applied if key present
 *   compAccess?: boolean,              // only applied if key present
 *   aiLimitOverride?: number | null,   // only applied if key present
 * }
 *
 * Only keys present in the body are updated, so the UI can change one
 * control at a time without clobbering the others.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const body = (await request.json()) as {
    profileId?: string;
    trialEndsAt?: string | null;
    compAccess?: boolean;
    aiLimitOverride?: number | null;
  };

  if (!body.profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("trialEndsAt" in body) {
    if (body.trialEndsAt !== null && isNaN(Date.parse(body.trialEndsAt ?? ""))) {
      return NextResponse.json({ error: "trialEndsAt must be a valid ISO date or null" }, { status: 400 });
    }
    updates.trial_ends_at = body.trialEndsAt;
  }

  if ("compAccess" in body) {
    if (typeof body.compAccess !== "boolean") {
      return NextResponse.json({ error: "compAccess must be a boolean" }, { status: 400 });
    }
    updates.comp_access = body.compAccess;
  }

  if ("aiLimitOverride" in body) {
    if (
      body.aiLimitOverride !== null &&
      (!Number.isInteger(body.aiLimitOverride) || (body.aiLimitOverride as number) < 0 || (body.aiLimitOverride as number) > 10000)
    ) {
      return NextResponse.json({ error: "aiLimitOverride must be an integer 0-10000 or null" }, { status: 400 });
    }
    updates.ai_analyses_limit_override = body.aiLimitOverride;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No controls provided" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", body.profileId)
    .select("id, trial_ends_at, comp_access, ai_analyses_limit_override, ai_free_analyses_used")
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
