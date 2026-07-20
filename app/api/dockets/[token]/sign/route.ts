import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { signedByName, signatureData } = await request.json();

  if (!signedByName?.trim() || !signatureData) {
    return NextResponse.json({ error: "Name and signature are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: docket, error } = await supabase
    .from("dockets")
    .select("id, profile_id, work_date, total_cost, status, jobs(job_number, title), profiles!dockets_profile_id_fkey(business_name, contact_email)")
    .eq("public_token", token)
    .single();

  if (error || !docket) {
    return NextResponse.json({ error: "Docket not found" }, { status: 404 });
  }
  if (docket.status === "signed" || docket.status === "invoiced") {
    return NextResponse.json({ error: "This docket has already been signed" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("dockets")
    .update({
      status: "signed",
      signed_by_name: signedByName.trim(),
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", docket.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save signature" }, { status: 500 });
  }

  // Let the tradie know the moment it happens, same pattern as quote
  // acceptance - best-effort, a notification hiccup shouldn't block the
  // signature itself from saving.
  const job = docket.jobs as unknown as { job_number: number; title: string | null } | null;
  const profile = docket.profiles as unknown as { business_name?: string; contact_email?: string } | null;
  const workDate = new Date(docket.work_date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const jobLabel = `Job #${job?.job_number ?? ""}${job?.title ? ` - ${job.title}` : ""}`;

  const { sendPushToBusiness } = await import("@/lib/push");
  await sendPushToBusiness(supabase, docket.profile_id, {
    title: "Docket signed ✓",
    body: `${signedByName.trim()} signed the ${workDate} docket on ${jobLabel} - $${(docket.total_cost ?? 0).toLocaleString()}, ready to invoice`,
    url: "/jobs",
  }).catch(() => null);

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && profile?.contact_email) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Swiftscope <${process.env.RESEND_FROM_EMAIL ?? "quotes@yourdomain.com"}>`,
          to: profile.contact_email,
          subject: `✓ Docket signed - ${workDate} - $${(docket.total_cost ?? 0).toLocaleString()}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                   <h2 style="color:#0a1722;">Docket signed ✓</h2>
                   <p><strong>${signedByName.trim()}</strong> signed the ${workDate} docket on ${jobLabel}.</p>
                   <p>Total: <strong>$${(docket.total_cost ?? 0).toLocaleString()}</strong></p>
                   <p>This docket is now ready to include in your end-of-month invoice.</p>
                 </div>`,
        }),
      });
    } catch {
      // Notification failing is not the signer's problem - swallow it.
    }
  }

  return NextResponse.json({ ok: true });
}
