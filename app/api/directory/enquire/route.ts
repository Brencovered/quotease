/**
 * POST /api/directory/enquire
 * Accepts JSON or multipart so the listing form can attach photos and drawings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDirectoryEnquiryEmail,
  buildDirectoryEnquiryAdminNotifyEmail,
  buildDirectoryEnquiryCustomerConfirmationEmail,
} from "@/lib/email/templates";
import {
  ENQUIRY_PHOTO_BUCKET,
  MAX_ENQUIRY_FILES,
  enquiryFileStoragePath,
  isAllowedEnquiryFile,
  signEnquiryPhotoPaths,
} from "@/lib/directoryEnquiryPhotos";

export const maxDuration = 60;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readEnquiryBody(req: NextRequest): Promise<{
  fields: Record<string, string>;
  photos: File[];
}> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const fields: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") fields[key] = value;
    }
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    return { fields, photos };
  }

  const body = (await req.json()) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" || typeof value === "boolean") fields[key] = String(value);
  }
  return { fields, photos: [] };
}

export async function POST(req: NextRequest) {
  if (!RESEND_API_KEY) {
    console.error("[directory/enquire] RESEND_API_KEY is not set");
    return NextResponse.json(
      { error: "Email service is not configured. Please contact support." },
      { status: 500 }
    );
  }

  let fields: Record<string, string>;
  let photos: File[];
  try {
    ({ fields, photos } = await readEnquiryBody(req));
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const customerName = asTrimmed(fields.name);
  const customerEmail = asTrimmed(fields.email);
  const jobDesc = asTrimmed(fields.jobType);
  const phone = asTrimmed(fields.phone);
  const budget = asTrimmed(fields.budget);
  const urgencyStr = asTrimmed(fields.urgency) || asTrimmed(fields.stage) || null;
  const customerType = asTrimmed(fields.customerType);
  const others = asTrimmed(fields.others);
  const message = asTrimmed(fields.message);
  const siteSuburb = asTrimmed(fields.site_suburb);
  const listingId = asTrimmed(fields.listing_id);
  const businessName = asTrimmed(fields.business_name);
  const scrapedToEmail = asTrimmed(fields.to_email);
  const isClaimed = fields.is_claimed === "true";

  if (!customerName || !customerEmail || !jobDesc) {
    return NextResponse.json(
      { error: "Please fill in your name, email and job description." },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(customerEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (photos.length > MAX_ENQUIRY_FILES) {
    return NextResponse.json({ error: `Please attach at most ${MAX_ENQUIRY_FILES} files.` }, { status: 400 });
  }
  for (const photo of photos) {
    const problem = isAllowedEnquiryFile(photo);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }

  const hasListingEmail = EMAIL_RE.test(scrapedToEmail);
  const toAddress = hasListingEmail ? scrapedToEmail : "team@swiftscope.com.au";

  const admin = createAdminClient();
  let enquiryId: string | null = null;

  const { priorityFromUrgency, makeLeadCode } = await import("@/lib/directoryLeads");
  const priority = priorityFromUrgency(urgencyStr);

  let profileId: string | null = null;
  if (listingId) {
    const { data: listing } = await admin
      .from("directory_listing")
      .select("profile_id")
      .eq("id", listingId)
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
        listing_id: listingId || null,
        business_name: businessName || null,
        to_email: toAddress,
        is_claimed: isClaimed || Boolean(profileId),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: phone || null,
        job_description: jobDesc,
        budget: budget || null,
        stage: urgencyStr,
        urgency: urgencyStr,
        priority,
        customer_type: customerType || null,
        other_quotes: others || null,
        notes: message || null,
        site_suburb: siteSuburb || null,
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

  const photoPaths: string[] = [];
  if (enquiryId && photos.length > 0) {
    for (const photo of photos) {
      const path = enquiryFileStoragePath(enquiryId, photo.name);
      const { error: uploadError } = await admin.storage.from(ENQUIRY_PHOTO_BUCKET).upload(path, photo, {
        contentType: photo.type,
      });
      if (uploadError) {
        console.error("[directory/enquire] photo upload error:", uploadError.message);
        continue;
      }
      photoPaths.push(path);
    }
    if (photoPaths.length > 0) {
      await admin.from("directory_enquiries").update({ photo_paths: photoPaths }).eq("id", enquiryId);
    }
  }

  const photoLinks = enquiryId
    ? await signEnquiryPhotoPaths(admin, photoPaths)
    : [];

  const { subject, html } = buildDirectoryEnquiryEmail({
    businessName,
    isClaimed,
    customerName,
    customerEmail,
    jobDesc,
    phone: phone || undefined,
    budget: budget || undefined,
    stage: urgencyStr ?? undefined,
    others: others || undefined,
    message: message || undefined,
    siteSuburb: siteSuburb || undefined,
    photos: photoLinks,
  });

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
        if (errData?.message) errMsg = errData.message;
        else if (errData?.error) {
          errMsg = typeof errData.error === "string" ? errData.error : JSON.stringify(errData.error);
        }
      } catch {
        errMsg = `Email service returned ${res.status}`;
      }

      if (enquiryId) {
        await admin.from("directory_enquiries").update({ email_error: errMsg }).eq("id", enquiryId);
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    if (enquiryId) {
      await admin.from("directory_enquiries").update({ email_sent: true }).eq("id", enquiryId);
    }

    if (hasListingEmail) {
      const adminEmail = buildDirectoryEnquiryAdminNotifyEmail({
        businessName,
        toEmail: toAddress,
        isClaimed,
        customerName,
        customerEmail,
        jobDesc,
        budget: budget || undefined,
        others: others || undefined,
      });

      const customerEmailContent = buildDirectoryEnquiryCustomerConfirmationEmail({
        customerName,
        businessName,
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
      await admin.from("directory_enquiries").update({ email_error: errMsg }).eq("id", enquiryId);
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
