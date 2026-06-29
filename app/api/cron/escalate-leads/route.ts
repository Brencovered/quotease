import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Runs hourly via Vercel cron -- escalates stale requests to wider radius

export async function GET() {
  const supabase = await createClient();
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  const { data: requests } = await supabase
    .from("job_requests")
    .select("id, num_quotes_wanted, job_claims(status)")
    .in("status", ["open","partially_claimed"])
    .lt("created_at", fiveHoursAgo)
    .is("wider_radius_sent_at", null);

  if (!requests?.length) return NextResponse.json({ ok: true, escalated: 0 });

  let escalated = 0;
  for (const request of requests) {
    const active = request.job_claims?.filter((c: {status:string}) => c.status === "claimed").length ?? 0;
    if (active < request.num_quotes_wanted) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/job-requests/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, widerRadius: true }),
      });
      escalated++;
    }
  }

  return NextResponse.json({ ok: true, escalated });
}
