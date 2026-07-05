import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  /* ── 1. Validate API key is configured ─────────────────────────── */
  if (!RESEND_API_KEY) {
    console.error("[directory/enquire] RESEND_API_KEY is not set");
    return NextResponse.json(
      { error: "Email service is not configured. Please contact support." },
      { status: 500 }
    );
  }

  /* ── 2. Parse & validate body ──────────────────────────────────── */
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    listing_id,
    business_name,
    to_email,
    name,
    email,
    phone,
    jobType,
    budget,
    stage,
    others,
    message,
  } = body;

  const customerName = typeof name === "string" ? name.trim() : "";
  const customerEmail = typeof email === "string" ? email.trim() : "";
  const jobDesc = typeof jobType === "string" ? jobType.trim() : "";

  if (!customerName || !customerEmail || !jobDesc) {
    return NextResponse.json(
      { error: "Please fill in your name, email and job description." },
      { status: 400 }
    );
  }

  const toAddress = typeof to_email === "string" && to_email.trim()
    ? to_email.trim()
    : "hello@swiftscope.com.au";

  /* ── 3. Save enquiry to database (always persist) ──────────────── */
  const supabase = await createClient();
  let enquiryId: string | null = null;

  try {
    const { data, error } = await supabase
      .from("directory_enquiries")
      .insert({
        listing_id: typeof listing_id === "string" ? listing_id : null,
        business_name: typeof business_name === "string" ? business_name : null,
        to_email: toAddress,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: typeof phone === "string" ? phone.trim() || null : null,
        job_description: jobDesc,
        budget: typeof budget === "string" ? budget || null : null,
        stage: typeof stage === "string" ? stage || null : null,
        status: "new",
        email_sent: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[directory/enquire] DB insert error:", error.message);
    } else if (data) {
      enquiryId = data.id;
    }
  } catch (dbErr) {
    console.error("[directory/enquire] DB exception:", dbErr);
  }

  /* ── 4. Build email HTML ───────────────────────────────────────── */
  const extraFields: string[] = [];
  if (typeof phone === "string" && phone.trim()) {
    extraFields.push(`<p><strong>Phone:</strong> ${escapeHtml(phone.trim())}</p>`);
  }
  if (typeof budget === "string" && budget.trim()) {
    extraFields.push(`<p><strong>Budget:</strong> ${escapeHtml(budget)}</p>`);
  }
  if (typeof stage === "string" && stage.trim()) {
    extraFields.push(`<p><strong>Stage:</strong> ${escapeHtml(stage)}</p>`);
  }
  if (typeof others === "string" && others.trim()) {
    extraFields.push(`<p><strong>Other quotes:</strong> ${escapeHtml(others)}</p>`);
  }
  if (typeof message === "string" && message.trim()) {
    extraFields.push(`<p><strong>Notes:</strong> ${escapeHtml(message)}</p>`);
  }

  const html = `
    <h2>New quote request from Swiftscope Directory</h2>
    <p><strong>Business:</strong> ${escapeHtml(typeof business_name === "string" ? business_name : "")}</p>
    <hr/>
    <p><strong>From:</strong> ${escapeHtml(customerName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
    ${extraFields.join("")}
    <hr/>
    <p><strong>Job:</strong> ${escapeHtml(jobDesc)}</p>
    <hr/>
    <p style="color:#888;font-size:12px">Sent via Swiftscope Directory - swiftscope.com.au/directory</p>
  `;

  /* ── 5. Send via Resend ────────────────────────────────────────── */
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Swiftscope Directory <directory@swiftscope.com.au>",
        to: [toAddress],
        reply_to: customerEmail,
        subject: `Quote request from ${customerName} - Swiftscope`,
        html,
      }),
    });

    if (!res.ok) {
      let errMsg = "Failed to send email";
      try {
        const errData = await res.json();
        console.error("[directory/enquire] Resend error:", errData);
        // Surface the actual Resend error message
        if (errData?.message) {
          errMsg = errData.message;
        } else if (errData?.error) {
          errMsg = typeof errData.error === "string" ? errData.error : JSON.stringify(errData.error);
        }
      } catch {
        errMsg = `Email service returned ${res.status}`;
      }

      // Update DB with error
      if (enquiryId) {
        await supabase
          .from("directory_enquiries")
          .update({ email_error: errMsg })
          .eq("id", enquiryId);
      }

      return NextResponse.json(
        { error: errMsg },
        { status: 500 }
      );
    }

    /* ── Success ─────────────────────────────────────────────────── */
    if (enquiryId) {
      await supabase
        .from("directory_enquiries")
        .update({ email_sent: true })
        .eq("id", enquiryId);
    }

    return NextResponse.json({ ok: true, id: enquiryId });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Network error contacting email service";
    console.error("[directory/enquire] Exception:", err);

    if (enquiryId) {
      await supabase
        .from("directory_enquiries")
        .update({ email_error: errMsg })
        .eq("id", enquiryId);
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
