import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

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
    ${budget  ? `<p><strong>Budget:</strong> ${budget}</p>`  : ""}
    ${stage   ? `<p><strong>Stage:</strong> ${stage}</p>`   : ""}
    ${others  ? `<p><strong>Other quotes:</strong> ${others}</p>` : ""}
    ${message ? `<p><strong>Notes:</strong> ${message}</p>` : ""}
    <hr/>
    <p style="color:#888;font-size:12px">Sent via Swiftscope Directory - swiftscope.com.au/directory</p>
  `;

  const toAddress = to_email ?? "hello@swiftscope.com.au";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:     "Swiftscope Directory <noreply@swiftscope.com.au>",
        to:       [toAddress],
        reply_to: email,
        subject:  `Quote request from ${name} - Swiftscope`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Resend error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Enquiry email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
