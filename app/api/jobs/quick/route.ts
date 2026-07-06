import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { createQuickJob } from "@/lib/jobs";

export async function POST(request: Request) {
  const body = await request.json();
  const { clientName, clientPhone, siteAddress, description, labourHours, materialsCost, scheduledDate, isRecurring, recurrenceFreq } = body;

  if (!clientName || !labourHours) {
    return NextResponse.json({ error: "clientName and labourHours are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const businessId = await getActiveBusinessId(supabase, userData.user.id);
  const { data: profile } = await supabase.from("profiles").select("hourly_rate, trades").eq("id", businessId).single();

  const job = await createQuickJob(supabase, {
    profileId: businessId,
    clientName,
    clientPhone,
    siteAddress,
    description,
    labourHours: Number(labourHours),
    hourlyRate: profile?.hourly_rate ?? 95,
    materialsCost: Number(materialsCost) || 0,
    scheduledDate,
    trade: profile?.trades?.[0] ?? null,
  });

  if (!job) {
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  if (isRecurring) {
    await supabase
      .from("jobs")
      .update({
        is_recurring_template: true,
        recurrence_rule: { freq: recurrenceFreq ?? "monthly", interval: 1 },
        next_occurrence_date: scheduledDate ?? new Date().toISOString().slice(0, 10),
      })
      .eq("id", job.id);
  }

  return NextResponse.json({ ok: true, job });
}
