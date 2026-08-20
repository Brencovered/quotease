/**
 * POST /api/directory/enquiries/[id]/convert
 * Create a draft quote from a directory lead and link them.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext, canSeePricing } from "@/lib/team";
import { pipelineFromQuoteStatus } from "@/lib/directoryLeads";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const ctx = await getTeamContext(supabase, userData.user.id);
  if (!(canSeePricing(ctx) || ctx.isOwner)) {
    return NextResponse.json({ error: "Only owners/admins can convert leads" }, { status: 403 });
  }

  const { data: lead } = await supabase
    .from("directory_enquiries")
    .select("*")
    .eq("id", id)
    .eq("profile_id", ctx.businessId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.quote_id) {
    return NextResponse.json({ quoteId: lead.quote_id, alreadyLinked: true });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("hourly_rate, materials_margin_pct, default_expiry_days, trades")
    .eq("id", ctx.businessId)
    .single();

  const trade = Array.isArray(profile?.trades) && profile.trades[0] ? profile.trades[0] : "electrician";

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      profile_id: ctx.businessId,
      trade,
      client_name: lead.customer_name,
      client_email: lead.customer_email,
      client_phone: lead.customer_phone,
      title: (lead.job_description as string)?.slice(0, 120) || "Directory lead",
      status: "draft",
      total_cost: 0,
      materials_cost: 0,
      labour_hours: 0,
      hourly_rate: profile?.hourly_rate ?? 95,
      materials_margin_pct: profile?.materials_margin_pct ?? 20,
      quote_expires_at: new Date(
        Date.now() + (profile?.default_expiry_days ?? 30) * 86400000
      ).toISOString(),
      directory_enquiry_id: lead.id,
      intake_data: {
        source: "directory_lead",
        lead_code: lead.lead_code,
        priority: lead.priority,
        urgency: lead.urgency,
        budget: lead.budget,
        customer_type: lead.customer_type,
        notes: lead.job_description,
      },
    })
    .select("id")
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: error?.message || "Couldn’t create quote" }, { status: 500 });
  }

  await supabase
    .from("directory_enquiries")
    .update({
      quote_id: quote.id,
      pipeline_status: pipelineFromQuoteStatus("draft"),
      status: "replied",
    })
    .eq("id", lead.id);

  return NextResponse.json({ quoteId: quote.id });
}
