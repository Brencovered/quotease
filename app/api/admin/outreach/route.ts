import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const { recipients, subject, html, text } = body;

    if (!recipients?.length || !subject || !html) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const FROM = process.env.RESEND_FROM_EMAIL ?? "team@swiftscope.com.au";
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    // Send in batches of 10
    const BATCH = 10;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      await Promise.all(batch.map(async (to: string) => {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_KEY}`,
            },
            body: JSON.stringify({ from: `Swiftscope <${FROM}>`, to, subject, html, text }),
          });
          if (res.ok) {
            results.sent++;
          } else {
            results.failed++;
            const err = await res.json().catch(() => ({}));
            results.errors.push(`${to}: ${err.message ?? res.status}`);
          }
        } catch (e) {
          results.failed++;
          results.errors.push(`${to}: ${e instanceof Error ? e.message : "unknown"}`);
        }
      }));
      if (i + BATCH < recipients.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return NextResponse.json(results);

  } catch (e) {
    console.error("[admin/outreach] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
