import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { business_name, to_email, name, email, phone, jobType, budget, stage, others, message } = body;

  if (!name || !email || !jobType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const html = `
    <h2>New quote request from Swiftscope Directory</h2>
    <p><strong>Business:</strong> ${business_name}</p>
    <hr/>
    <p><strong>From:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
    <hr/>
    <p><strong>Job:</strong> ${jobType}</p>
    ${budget ? `<p><strong>Budget:</strong> ${budget}</p>` : ""}
    ${stage ? `<p><strong>Stage:</strong> ${stage}</p>` : ""}
    ${others ? `<p><strong>Other quotes:</strong> ${others}</p>` : ""}
    ${message ? `<p><strong>Additional notes:</strong> ${message}</p>` : ""}
    <hr/>
    <p style="color:#888;font-size:12px">Sent via Swiftscope Directory — swiftscope.com.au/directory</p>
  `;

  // Send to the tradie if they have an email, otherwise log it
  const toAddress = to_email ?? "hello@swiftscope.com.au";

  try {
    await resend.emails.send({
      from:    "Swiftscope Directory <noreply@swiftscope.com.au>",
      to:      toAddress,
      replyTo: email,
      subject: `Quote request from ${name} — Swiftscope`,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Enquiry email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
