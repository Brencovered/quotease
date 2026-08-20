/**
 * Central registry of automated (non-user-composed) email templates.
 *
 * Each entry's `build()` function is the ONE place the real subject/HTML
 * for that email is generated - the sending route imports and calls it
 * with real data, and the admin preview page (/admin/emails) calls it
 * with representative sample data. There's no separate "preview copy" to
 * drift out of sync with what's actually sent.
 *
 * Deliberately scoped to automated/system email only - quotes, invoices,
 * dayworks dockets, and team invites are triggered by a tradie clicking
 * "send" on a specific real record (line items, prices, business name),
 * not a fixed template, so they're not included here yet.
 */

export function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ────────────────────────────────────────────────────────────────────
 * 1. Signup welcome email
 * ──────────────────────────────────────────────────────────────────── */
export function buildWelcomeEmail(vars: { businessName: string }) {
  const businessName = vars.businessName?.trim() || "there";
  return {
    subject: "Welcome to Swiftscope - your 7-day free trial has started",
    html: `
      <h2>Welcome to Swiftscope, ${htmlEscape(businessName)}!</h2>
      <p>Your 7-day free trial just started - no card needed until it ends.</p>
      <p>A few things worth doing first:</p>
      <ul>
        <li>Finish setting up your pricing so quotes come out accurate from day one</li>
        <li>Try building your first quote - even a test one, to get a feel for it</li>
        <li>Add your team if you're not working solo</li>
      </ul>
      <p><a href="https://swiftscope.com.au/onboarding">Continue setting up your account</a></p>
      <hr/>
      <p style="color:#888;font-size:12px">Questions? Just reply to this email.</p>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 2. Admin "new signup" notification
 * ──────────────────────────────────────────────────────────────────── */
export function buildAdminNewSignupEmail(vars: {
  businessName: string;
  trade: string;
  suburb: string;
  userEmail: string;
}) {
  return {
    subject: `New signup: ${vars.businessName} (${vars.trade})`,
    html: `
      <h2>New Swiftscope signup</h2>
      <p><strong>Business:</strong> ${htmlEscape(vars.businessName)}</p>
      <p><strong>Trade:</strong> ${htmlEscape(vars.trade)}</p>
      <p><strong>Suburb:</strong> ${htmlEscape(vars.suburb || "Not set")}</p>
      <p><strong>Email:</strong> ${htmlEscape(vars.userEmail)}</p>
      <hr/>
      <p style="color:#888;font-size:12px">Sent automatically on first onboarding visit.</p>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 3. Weekly schedule digest (per team member)
 * ──────────────────────────────────────────────────────────────────── */
export type WeeklyScheduleJob = {
  id: string;
  clientName: string;
  siteAddress: string | null;
  title: string | null;
  status: string;
  dateRange: string;
};

export function buildWeeklyScheduleEmail(vars: {
  businessName: string;
  weekLabel: string;
  memberName: string | null;
  jobs: WeeklyScheduleJob[];
  appUrl: string;
}) {
  const greeting = vars.memberName ? `Hi ${htmlEscape(vars.memberName)},` : "Hi,";
  const totalJobs = vars.jobs.length;

  const statusMeta: Record<string, { color: string; label: string }> = {
    scheduled: { color: "#334155", label: "Scheduled" },
    in_progress: { color: "#d97706", label: "In progress" },
    on_hold: { color: "#dc2626", label: "On hold" },
    awaiting_sign_off: { color: "#334155", label: "Awaiting sign-off" },
    complete: { color: "#16a34a", label: "Complete" },
  };

  const jobRows = vars.jobs
    .map((job) => {
      const jobUrl = `${vars.appUrl}/jobs/${job.id}`;
      const meta = statusMeta[job.status] ?? { color: "#334155", label: job.status };
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">
              <a href="${jobUrl}" style="color:#0f172a;text-decoration:none;">${htmlEscape(job.clientName || "Unnamed client")}</a>
            </p>
            ${job.siteAddress ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;">${htmlEscape(job.siteAddress)}</p>` : ""}
            ${job.title ? `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${htmlEscape(job.title)}</p>` : ""}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">${htmlEscape(job.dateRange)}</p>
            <p style="margin:4px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${meta.color};">${meta.label}</p>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap;">
            <a href="${jobUrl}" style="display:inline-block;padding:6px 14px;background:#0f172a;color:#fff;font-size:12px;font-weight:700;text-decoration:none;border-radius:8px;">Open job</a>
          </td>
        </tr>
      `;
    })
    .join("");

  return {
    subject: `${vars.businessName} - Your schedule ${vars.weekLabel} (${totalJobs} job${totalJobs === 1 ? "" : "s"})`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 20px;background:#0f172a;">
              <p style="margin:0;font-size:20px;font-weight:800;color:#fbbf24;letter-spacing:-0.02em;">${htmlEscape(vars.businessName)}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Weekly schedule - ${htmlEscape(vars.weekLabel)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0;">
              <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${greeting}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#334155;line-height:1.6;">You have <strong>${totalJobs} job${totalJobs === 1 ? "" : "s"}</strong> scheduled. Tap any job to open it in Swiftscope.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">${jobRows}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;text-align:center;">
              <a href="${vars.appUrl}/schedule" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fbbf24;font-size:14px;font-weight:800;text-decoration:none;border-radius:10px;">View full schedule in Swiftscope</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">Sent from Swiftscope • <a href="${vars.appUrl}" style="color:#64748b;">Open Swiftscope</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 4. Trial day nudge (cron)
 * ──────────────────────────────────────────────────────────────────── */
export function buildTrialNudgeEmail(vars: {
  businessName: string;
  day: number;
  dayTitle: string;
  tasks: { label: string; href: string }[];
  daysRemaining: number;
  appUrl: string;
}) {
  const taskRows = vars.tasks
    .map(
      (t) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <a href="${vars.appUrl}${t.href}" style="color:#0f172a;text-decoration:none;font-size:14px;font-weight:700;">${htmlEscape(t.label)} &rarr;</a>
        </td>
      </tr>`
    )
    .join("");

  return {
    subject: `Day ${vars.day}: ${vars.dayTitle}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#d97706;">Day ${vars.day} of your trial</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${htmlEscape(vars.dayTitle)}</h1>
        <p style="font-size:14px;color:#334155;line-height:1.5;margin:0 0 20px;">Hi ${htmlEscape(vars.businessName)}, here's today's focus in Swiftscope:</p>
        <table width="100%" cellpadding="0" cellspacing="0">${taskRows}</table>
        <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;">
          ${vars.daysRemaining} day${vars.daysRemaining === 1 ? "" : "s"} left in your trial.
        </p>
      </div>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 5. Directory "claim your free listing" invite
 * ──────────────────────────────────────────────────────────────────── */
export function buildDirectoryClaimInviteEmail(vars: {
  businessName: string;
  claimUrl: string;
  listingUrl: string;
}) {
  return {
    subject: `${vars.businessName} - your free Swiftscope directory page is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #0a1722;">
        <p>Hi,</p>
        <p>We've set up a free directory page for <strong>${htmlEscape(vars.businessName)}</strong> on Swiftscope, an Australian directory for trade businesses, built for homeowners searching for a tradie in your area.</p>
        <p>You can see it here: <a href="${vars.listingUrl}">${vars.listingUrl}</a></p>
        <p>It's free to claim, no credit card, no catch. Once you claim it you can add photos, your licence details, services you offer, and start receiving quote requests directly.</p>
        <p><a href="${vars.claimUrl}" style="display:inline-block;background:#ffb400;color:#0a1722;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">Claim your free listing</a></p>
        <p style="color:#5a6b78;font-size:13px;">If this isn't your business, you can ignore this email.</p>
      </div>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 6. Directory enquiry notification (to the tradie / listing owner)
 * ──────────────────────────────────────────────────────────────────── */
export function buildDirectoryEnquiryEmail(vars: {
  businessName: string;
  isClaimed: boolean;
  customerName: string;
  customerEmail: string;
  jobDesc: string;
  phone?: string;
  budget?: string;
  stage?: string;
  others?: string;
  message?: string;
}) {
  const extraFields: string[] = [];
  if (vars.phone?.trim()) extraFields.push(`<p><strong>Phone:</strong> ${htmlEscape(vars.phone.trim())}</p>`);
  if (vars.budget?.trim()) extraFields.push(`<p><strong>Budget:</strong> ${htmlEscape(vars.budget)}</p>`);
  if (vars.stage?.trim()) extraFields.push(`<p><strong>Stage:</strong> ${htmlEscape(vars.stage)}</p>`);
  if (vars.others?.trim()) extraFields.push(`<p><strong>Other quotes:</strong> ${htmlEscape(vars.others)}</p>`);
  if (vars.message?.trim()) extraFields.push(`<p><strong>Notes:</strong> ${htmlEscape(vars.message)}</p>`);

  const claimNudge = vars.isClaimed
    ? ""
    : `
    <hr/>
    <p style="background:#fffbeb;border:1px solid #ffe58f;border-radius:8px;padding:12px 16px;font-size:13px;color:#5a4a00;">
      This lead came through your free, unclaimed Swiftscope directory page. Claim it to receive enquiries like
      this straight to your own account, manage your photos and services, and get a verified badge -
      <a href="https://swiftscope.com.au/directory/claim" style="color:#c98600;font-weight:600;">claim your listing free</a>.
    </p>
  `;

  return {
    subject: `Quote request from ${vars.customerName} - Swiftscope`,
    html: `
      <h2>${vars.isClaimed ? "New quote request via your Swiftscope page" : "New quote request from Swiftscope Directory"}</h2>
      <p><strong>Business:</strong> ${htmlEscape(vars.businessName)}</p>
      <hr/>
      <p><strong>From:</strong> ${htmlEscape(vars.customerName)}</p>
      <p><strong>Email:</strong> ${htmlEscape(vars.customerEmail)}</p>
      ${extraFields.join("")}
      <hr/>
      <p><strong>Job:</strong> ${htmlEscape(vars.jobDesc)}</p>
      ${claimNudge}
      <hr/>
      <p style="color:#888;font-size:12px">Sent via Swiftscope Directory - swiftscope.com.au/directory</p>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 6b. Directory enquiry - admin copy (to Swiftscope team)
 *
 * Sent alongside the tradie's copy whenever the listing has a real email
 * on file. Previously the team only ever saw these enquiries when the
 * listing email was missing/malformed (the fallback case) - this gives
 * visibility into every quote request that goes out, not just the ones
 * that had nowhere else to go.
 * ──────────────────────────────────────────────────────────────────── */
export function buildDirectoryEnquiryAdminNotifyEmail(vars: {
  businessName: string;
  toEmail: string;
  isClaimed: boolean;
  customerName: string;
  customerEmail: string;
  jobDesc: string;
}) {
  return {
    subject: `[Directory] Quote request forwarded: ${vars.businessName}`,
    html: `
      <h2>Quote request forwarded to listing</h2>
      <p><strong>Business:</strong> ${htmlEscape(vars.businessName)} (${vars.isClaimed ? "claimed" : "unclaimed"})</p>
      <p><strong>Sent to:</strong> ${htmlEscape(vars.toEmail)}</p>
      <hr/>
      <p><strong>Customer:</strong> ${htmlEscape(vars.customerName)} (${htmlEscape(vars.customerEmail)})</p>
      <p><strong>Job:</strong> ${htmlEscape(vars.jobDesc)}</p>
      <hr/>
      <p style="color:#888;font-size:12px">Automated copy - the tradie's copy was sent separately to the address above.</p>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 6c. Directory enquiry - customer confirmation
 *
 * Sent to the homeowner only when the listing had a real email on file
 * (i.e. their request actually went to the tradie, not just Swiftscope's
 * fallback inbox), so the reassurance is honest about what happened.
 * ──────────────────────────────────────────────────────────────────── */
export function buildDirectoryEnquiryCustomerConfirmationEmail(vars: {
  customerName: string;
  businessName: string;
}) {
  const firstName = vars.customerName.trim().split(/\s+/)[0] || "there";
  return {
    subject: `Your quote request to ${vars.businessName} has been sent`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #0a1722;">
        <p>Hi ${htmlEscape(firstName)},</p>
        <p>Your quote request has been sent to <strong>${htmlEscape(vars.businessName)}</strong>.</p>
        <p>We'll do everything we can to make sure your request gets seen to as soon as possible.</p>
        <p style="color:#5a6b78;font-size:13px;">If you don't hear back within a couple of days, feel free to reply to this email and our team will follow up.</p>
        <hr/>
        <p style="color:#888;font-size:12px">Sent via Swiftscope Directory - swiftscope.com.au/directory</p>
      </div>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 7. New lead match notification (to matched tradies)
 * ──────────────────────────────────────────────────────────────────── */
export function buildLeadMatchEmail(vars: {
  trade: string;
  suburb: string;
  postcode?: string;
  leadTemperature: "early" | "warm" | "hot" | string;
  description: string;
  additionalDetails?: string;
  budget?: string;
  timeline?: string;
  photoCount?: number;
  appUrl: string;
}) {
  const tempLabel: Record<string, string> = {
    early: "Early stage",
    warm: "Warm - interested in speaking soon",
    hot: "Hot - budget approved, ready to go",
  };
  const tempColor: Record<string, string> = {
    hot: "#dc2626",
    warm: "#ea580c",
    early: "#ca8a04",
  };

  return {
    subject: `New ${vars.trade} lead - ${vars.suburb} (${tempLabel[vars.leadTemperature] ?? ""})`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #0a1722; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 18px; color: #ffb400;">New ${htmlEscape(vars.trade)} lead in ${htmlEscape(vars.suburb)}</h1>
        </div>
        <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 8px;"><strong style="color: #0a1722;">Stage:</strong> <span style="color: ${tempColor[vars.leadTemperature] ?? "#ca8a04"}">${tempLabel[vars.leadTemperature] ?? vars.leadTemperature}</span></p>
          <p style="margin: 0 0 8px;"><strong style="color: #0a1722;">Job:</strong> ${htmlEscape(vars.description)}</p>
          ${vars.additionalDetails ? `<p style="margin: 0 0 8px;"><strong style="color: #0a1722;">Details:</strong> ${htmlEscape(vars.additionalDetails)}</p>` : ""}
          ${vars.budget ? `<p style="margin: 0 0 8px;"><strong style="color: #0a1722;">Budget:</strong> ${htmlEscape(vars.budget)}</p>` : ""}
          ${vars.timeline ? `<p style="margin: 0 0 8px;"><strong style="color: #0a1722;">Timeline:</strong> ${htmlEscape(vars.timeline)}</p>` : ""}
          ${vars.photoCount ? `<p style="margin: 0 0 16px;"><strong style="color: #0a1722;">Photos:</strong> ${vars.photoCount} attached - view and claim to see them</p>` : ""}
          <p style="margin: 0 0 24px;"><strong style="color: #0a1722;">Suburb:</strong> ${htmlEscape(vars.suburb)}${vars.postcode ? ` ${htmlEscape(vars.postcode)}` : ""}</p>
          <a href="${vars.appUrl}/leads" style="display: inline-block; background: #ffb400; color: #0a1722; padding: 14px 28px; border-radius: 10px; font-weight: bold; text-decoration: none; font-size: 15px;">
            View and claim this lead →
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; line-height: 1.5;">
            You're receiving this because you're subscribed to ${htmlEscape(vars.trade)} leads in ${htmlEscape(vars.suburb)} on Swiftscope.
            Every tradie is auto-subscribed by default. <a href="${vars.appUrl}/settings" style="color: #0a1722; text-decoration: underline;">Manage your lead preferences</a> to opt out.
          </p>
        </div>
      </div>
    `,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 8. "No tradies matched" internal notification (to Swiftscope team)
 * ──────────────────────────────────────────────────────────────────── */
export function buildNoMatchLeadEmail(vars: { trade: string; suburb: string; description: string }) {
  return {
    subject: `New ${vars.trade} lead - ${vars.suburb} (no matched tradies)`,
    html: `<p>A new lead was submitted but no tradies matched yet.</p>
       <p><strong>Trade:</strong> ${htmlEscape(vars.trade)}</p>
       <p><strong>Suburb:</strong> ${htmlEscape(vars.suburb)}</p>
       <p><strong>Job:</strong> ${htmlEscape(vars.description)}</p>
       <p><strong>Tips:</strong> Check if the suburb needs normalizing, or if tradies need to be added for this area.</p>`,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Registry - metadata + sample data for the admin preview page.
 * The `build` here always calls the same functions the routes call.
 * ──────────────────────────────────────────────────────────────────── */
export type EmailTemplateMeta = {
  id: string;
  name: string;
  trigger: string;
  from: string;
  routeFile: string;
  preview: () => { subject: string; html: string };
};

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  {
    id: "welcome",
    name: "Signup welcome",
    trigger: "Sent once, first time a new user reaches /onboarding after signing up",
    from: "Swiftscope <noreply@swiftscope.com.au>",
    routeFile: "app/api/onboarding/welcome/route.ts",
    preview: () => buildWelcomeEmail({ businessName: "Spark Ease Electrical" }),
  },
  {
    id: "admin-new-signup",
    name: "Admin: new signup notification",
    trigger: "Sent to ADMIN_EMAILS alongside the welcome email above",
    from: "Swiftscope <noreply@swiftscope.com.au>",
    routeFile: "app/api/onboarding/welcome/route.ts",
    preview: () =>
      buildAdminNewSignupEmail({
        businessName: "Spark Ease Electrical",
        trade: "electrician",
        suburb: "Frankston",
        userEmail: "brendan@example.com",
      }),
  },
  {
    id: "weekly-schedule",
    name: "Weekly schedule digest",
    trigger: "Business owner triggers a send (manual button) to their active team members",
    from: "Swiftscope <noreply@swiftscope.com.au>",
    routeFile: "app/api/schedule/send-weekly/route.ts",
    preview: () =>
      buildWeeklyScheduleEmail({
        businessName: "Spark Ease Electrical",
        weekLabel: "this week",
        memberName: "Cael",
        appUrl: "https://swiftscope.com.au",
        jobs: [
          { id: "sample-1", clientName: "Jane Smith", siteAddress: "12 Rosslyn Ave, Seaford", title: "Downlight upgrade", status: "scheduled", dateRange: "Mon 3 Aug" },
          { id: "sample-2", clientName: "Rory Bread", siteAddress: "8 Coventry St", title: "Switchboard upgrade", status: "in_progress", dateRange: "Wed 5 Aug - Thu 6 Aug" },
        ],
      }),
  },
  {
    id: "trial-nudge",
    name: "Trial day nudge",
    trigger: "Daily cron - one email per trialing business, matching their current trial day (2-7)",
    from: "Swiftscope <noreply@swiftscope.com.au>",
    routeFile: "app/api/cron/trial-onboarding-nudge/route.ts",
    preview: () =>
      buildTrialNudgeEmail({
        businessName: "Spark Ease Electrical",
        day: 3,
        dayTitle: "Add your team",
        daysRemaining: 4,
        appUrl: "https://swiftscope.com.au",
        tasks: [
          { label: "Invite a team member", href: "/team" },
          { label: "Assign your first job", href: "/jobs" },
        ],
      }),
  },
  {
    id: "directory-claim-invite",
    name: "Directory: claim your listing invite",
    trigger: "Admin manually triggers per-listing from /admin/directory",
    from: "Swiftscope <team@swiftscope.com.au> (or RESEND_FROM_EMAIL if set)",
    routeFile: "app/api/admin/directory/send-claim-invite/route.ts",
    preview: () =>
      buildDirectoryClaimInviteEmail({
        businessName: "Spark Ease Electrical",
        claimUrl: "https://swiftscope.com.au/directory/claim?name=Spark+Ease+Electrical",
        listingUrl: "https://swiftscope.com.au/directory/spark-ease-electrical-frankston",
      }),
  },
  {
    id: "directory-enquiry",
    name: "Directory: quote request notification",
    trigger: "Homeowner submits an enquiry form on a directory listing page",
    from: "Swiftscope Directory <directory@swiftscope.com.au>",
    routeFile: "app/api/directory/enquire/route.ts",
    preview: () =>
      buildDirectoryEnquiryEmail({
        businessName: "Spark Ease Electrical",
        isClaimed: false,
        customerName: "Jane Smith",
        customerEmail: "jane@example.com",
        jobDesc: "Need 8 downlights installed in the living room",
        phone: "0412 345 678",
        budget: "$1,000 - $2,000",
        stage: "Ready to book",
      }),
  },
  {
    id: "lead-match",
    name: "Matched lead notification",
    trigger: "Homeowner submits Get Quotes form - sent to every matching, opted-in tradie",
    from: "Swiftscope Leads <noreply@swiftscope.com.au>",
    routeFile: "app/api/job-requests/notify/route.ts",
    preview: () =>
      buildLeadMatchEmail({
        trade: "electrician",
        suburb: "Frankston",
        postcode: "3199",
        leadTemperature: "hot",
        description: "Rewire a 3-bedroom house, quote needed within the week",
        budget: "$5,000 - $10,000",
        timeline: "Within 2 weeks",
        photoCount: 3,
        appUrl: "https://swiftscope.com.au",
      }),
  },
  {
    id: "lead-no-match",
    name: "Internal: no tradies matched a lead",
    trigger: "Same trigger as above, when zero tradies match - sent to team@swiftscope.com.au",
    from: "Swiftscope Leads <noreply@swiftscope.com.au>",
    routeFile: "app/api/job-requests/notify/route.ts",
    preview: () =>
      buildNoMatchLeadEmail({
        trade: "electrician",
        suburb: "Frankston",
        description: "Rewire a 3-bedroom house, quote needed within the week",
      }),
  },
];
