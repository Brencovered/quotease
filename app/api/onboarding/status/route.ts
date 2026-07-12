/**
 * GET /api/onboarding/status
 * --------------------------
 * Returns the current business's 7-day trial onboarding checklist state.
 * Used by TrialOnboardingWidget for client-side refresh after a task is
 * completed elsewhere in the app (e.g. sending a quote in another tab).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { getOnboardingProgress } from "@/lib/onboarding";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const progress = await getOnboardingProgress(supabase, businessId);

  return NextResponse.json({ progress });
}
