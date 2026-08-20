import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDirectoryEnquiryEmail,
  buildDirectoryEnquiryAdminNotifyEmail,
  buildDirectoryEnquiryCustomerConfirmationEmail,
} from "@/lib/email/templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    is_claimed,
    name,
    email,
    phone,
    jobType,
    budget,
    stage,
    urgency,
    customerType,
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

  if (!EMAIL_RE.test(customerEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  // Scraped business emails occasionally come through malformed (stray
  // characters, multiple addresses concatenated, etc). Rather than let a
  // bad address on file kill every quote request for that listing, fall
  // back to Swiftscope's own inbox so the enquiry still gets somewhere.
  const scrapedToEmail = typeof to_email === "string" ? to_email.trim() : "";
  const hasListingEmail = EMAIL_RE.test(scrapedToEmail);
  const toAddress = hasListingEmail ? scrapedToEmail : "team@swiftscope.com.au";

  /* ── 3. Save enquiry to database (always persist) ──────────────── */
  // Uses the admin (service-role) client rather than the session-scoped
  // client: this insert is server-validated above and comes from anonymous
  // homeowners with no session, so there's no meaningful RLS role to grant
  // here. Previously this used the regular client, which failed on every
  // submission -- Supabase's insert().select() requires a SELECT policy for
  // the RETURNING clause too, not just an INSERT policy, and anon had none.
  const admin = createAdminClient();
  let enquiryId: string | null = null;

  const { priorityFromUrgency, makeLeadCode } = await import("@/lib/directoryLeads");
  const urgencyStr = typeof urgency === "string" ? urgency : typeof stage === "string" ? stage : null;
  const priority = priorityFromUrgency(urgencyStr);

  // Resolve claimed listing → business profile so the owner sees it in /leads
  let profileId: string | null = null;
  if (typeof listing_id === "string" && listing_id) {
    const { data: listing } = await admin
      .from("directory_listing")
      .select("profile_id")
      .eq("id", listing_id)
      .maybeSingle();
    profileId = listing?.profile_id ?? null;
  }

  try {
    const tempId = crypto.randomUUID();
    const leadCode = makeLeadCode(tempId);
    const { data, error } = await admin
      .from("directory_enquiries")
      .insert({
        id: tempId,
        listing_id: typeof listing_id === "string" ? listing_id : null,
        business_name: typeof business_name === "string" ? business_name : null,
        to_email: toAddress,
        is_claimed: is_claimed === true || Boolean(profileId),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: typeof phone === "string" ? phone.trim() || null : null,
        job_description: jobDesc,
        budget: typeof budget === "string" ? budget || null : null,
        stage: urgencyStr,
        urgency: urgencyStr,
        priority,
        customer_type: typeof customerType === "string" ? customerType || null : null,
        pipeline_status: "new",
        lead_code: leadCode,
        profile_id: profileId,
        status: "new",
        email_sent: false,
      })
      .select("id, lead_code")
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
  const isClaimed = is_claimed === true;

  const { subject, html } = buildDirectoryEnquiryEmail({
    businessName: typeof business_name === "string" ? business_name : "",
    isClaimed,
    customerName,
    customerEmail,
    jobDesc,
    phone: typeof phone === "string" ? phone : undefined,
    budget: typeof budget === "string" ? budget : undefined,
    stage: typeof stage === "string" ? stage : undefined,
    others: typeof others === "string" ? others : undefined,
    message: typeof message === "string" ? message : undefined,
  });

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
        subject,
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
        await admin
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
      await admin
        .from("directory_enquiries")
        .update({ email_sent: true })
        .eq("id", enquiryId);
    }

    // The listing had a real email on file (quote actually went to the
    // tradie, not just Swiftscope's fallback inbox): also notify the team
    // and reassure the customer their request was actually sent somewhere.
    // Best-effort - failures here don't affect the main enquiry, which is
    // already saved and sent.
    if (hasListingEmail) {
      const businessNameStr = typeof business_name === "string" ? business_name : "";

      const adminEmail = buildDirectoryEnquiryAdminNotifyEmail({
        businessName: businessNameStr,
        toEmail: toAddress,
        isClaimed,
        customerName,
        customerEmail,
        jobDesc,
      });

      const customerEmailContent = buildDirectoryEnquiryCustomerConfirmationEmail({
        customerName,
        businessName: businessNameStr,
      });

      const [adminResult, customerResult] = await Promise.allSettled([
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Swiftscope Directory <directory@swiftscope.com.au>",
            to: ["team@swiftscope.com.au"],
            subject: adminEmail.subject,
            html: adminEmail.html,
          }),
        }),
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Swiftscope Directory <directory@swiftscope.com.au>",
            to: [customerEmail],
            reply_to: "team@swiftscope.com.au",
            subject: customerEmailContent.subject,
            html: customerEmailContent.html,
          }),
        }),
      ]);

      const adminOk = adminResult.status === "fulfilled" && adminResult.value.ok;
      const customerOk = customerResult.status === "fulfilled" && customerResult.value.ok;

      if (adminResult.status === "rejected") {
        console.error("[directory/enquire] admin notify exception:", adminResult.reason);
      } else if (!adminResult.value.ok) {
        console.error("[directory/enquire] admin notify failed:", adminResult.value.status);
      }

      if (customerResult.status === "rejected") {
        console.error("[directory/enquire] customer confirmation exception:", customerResult.reason);
      } else if (!customerResult.value.ok) {
        console.error("[directory/enquire] customer confirmation failed:", customerResult.value.status);
      }

      if (enquiryId) {
        await admin
          .from("directory_enquiries")
          .update({ admin_notified: adminOk, customer_notified: customerOk })
          .eq("id", enquiryId);
      }
    }

    return NextResponse.json({ ok: true, id: enquiryId });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Network error contacting email service";
    console.error("[directory/enquire] Exception:", err);

    if (enquiryId) {
      await admin
        .from("directory_enquiries")
        .update({ email_error: errMsg })
        .eq("id", enquiryId);
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

