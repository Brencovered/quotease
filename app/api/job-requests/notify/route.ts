import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

async function sendEmail(to: string, subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Swiftscope Leads <noreply@swiftscope.com.au>",
      to: [to],
      subject,
      html,
    }),
  });
}

export async function POST(req: NextRequest) {
  const { requestId, widerRadius } = await req.json();
  if (!requestId) return NextResponse.json({ error: "No requestId" }, { status: 400 });

  const supabase = await createClient();

  // Get the job request
  const { data: request } = await supabase
    .from("job_requests")
    .select("*, homeowner_profiles(name, suburb)")
    .eq("id", requestId)
    .single();

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // Find tradies who:
  // 1. Have directory active
  // 2. Match the trade
  // 3. Have the suburb in their service area (or wider radius)
  // 4. Want this lead temperature
  const { data: settings } = await supabase
    .from("tradie_directory_settings")
    .select("profile_id, service_suburbs, lead_temps_wanted")
    .eq("directory_active", true)
    .eq("monthly_fee_active", true)
    .contains("lead_temps_wanted", [request.lead_temperature]);

  if (!settings?.length) {
    // No tradies set up yet -- still notify team
    await sendEmail("team@swiftscope.com.au",
      `New ${request.trade} lead - ${request.suburb} (no matched tradies yet)`,
      `<p>A new lead was submitted but no tradies matched yet.</p><p><strong>Trade:</strong> ${request.trade}</p><p><strong>Suburb:</strong> ${request.suburb}</p><p><strong>Job:</strong> ${request.description}</p>`
    );
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Filter to tradies whose service suburbs include the request suburb
  // In wider radius mode we skip the suburb filter
  const eligible = widerRadius
    ? settings
    : settings.filter(s =>
        s.service_suburbs?.some((sub: string) =>
          sub.toLowerCase().includes(request.suburb.toLowerCase()) ||
          request.suburb.toLowerCase().includes(sub.toLowerCase())
        )
      );

  if (!eligible.length) return NextResponse.json({ ok: true, sent: 0 });

  // Get their profile emails
  const profileIds = eligible.map(s => s.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, business_name, contact_email")
    .in("id", profileIds);

  if (!profiles?.length) return NextResponse.json({ ok: true, sent: 0 });

  const tempLabel: Record<string,string> = {
    early: "🟡 Early stage",
    warm:  "🟠 Warm - interested in speaking soon",
    hot:   "🔴 Hot - budget approved, ready to go",
  };

  let sent = 0;
  for (const profile of profiles) {
    if (!profile.contact_email) continue;
    const html = `
      <h2>New ${request.trade} lead in ${request.suburb}</h2>
      <p><strong>Stage:</strong> ${tempLabel[request.lead_temperature] ?? request.lead_temperature}</p>
      <p><strong>Job:</strong> ${request.description}</p>
      ${request.budget ? `<p><strong>Budget:</strong> ${request.budget}</p>` : ""}
      ${request.timeline ? `<p><strong>Timeline:</strong> ${request.timeline}</p>` : ""}
      <p><strong>Suburb:</strong> ${request.suburb}${request.postcode ? ` ${request.postcode}` : ""}</p>
      <hr/>
      <p>
        <a href="${APP_URL}/electrician/leads" style="background:#ffb400;color:#0a1722;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;">
          View and claim this request →
        </a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:16px">
        You're receiving this because you have directory access on Swiftscope.
        <a href="${APP_URL}/settings">Manage your lead preferences</a>
      </p>
    `;
    await sendEmail(
      profile.contact_email,
      `New ${request.trade} lead - ${request.suburb} (${tempLabel[request.lead_temperature] ?? ""})`,
      html
    );
    sent++;
  }

  // If wider radius, mark the request
  if (widerRadius) {
    await supabase.from("job_requests")
      .update({ wider_radius_sent_at: new Date().toISOString() })
      .eq("id", requestId);
  }

  return NextResponse.json({ ok: true, sent });
}
