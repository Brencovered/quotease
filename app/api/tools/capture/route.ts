import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Lightweight email capture for free tools (quote PDF, etc.).
 * Notifies the team when Resend is configured; always returns ok so the
 * user can still download their PDF if mail fails.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const tool = typeof body?.tool === "string" ? body.tool.trim() : "unknown";
  const businessName =
    typeof body?.businessName === "string" ? body.businessName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  const notifyTo = process.env.TOOLS_CAPTURE_EMAIL || "team@swiftscope.com.au";
  const from = process.env.RESEND_FROM_EMAIL || "Swiftscope <team@swiftscope.com.au>";

  if (key) {
    try {
      const resend = new Resend(key);
      await resend.emails.send({
        from,
        to: notifyTo,
        subject: `Tool lead: ${tool} - ${businessName || email}`,
        html: `
          <h2>Free tool capture</h2>
          <p><strong>Tool:</strong> ${escapeHtml(tool)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Business:</strong> ${escapeHtml(businessName || "-")}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone || "-")}</p>
        `,
      });
    } catch {
      // Capture should not block the tool UX
    }
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
