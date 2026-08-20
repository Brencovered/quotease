/**
 * GET /api/team/context
 * Lightweight role/access for client nav (AppHeader).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext, canSeePricing, isFieldWorker } from "@/lib/team";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getTeamContext(supabase, userData.user.id);
  return NextResponse.json({
    isOwner: ctx.isOwner,
    role: ctx.role,
    accessScope: ctx.accessScope,
    businessName: ctx.businessName,
    canSeePricing: canSeePricing(ctx),
    isFieldWorker: isFieldWorker(ctx),
    homeHref: isFieldWorker(ctx) ? "/today" : "/dashboard",
  });
}
