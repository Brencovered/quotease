import { EMAIL_TEMPLATES } from "@/lib/email/templates";
import EmailTemplatesViewer from "@/components/admin/EmailTemplatesViewer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminEmailsPage() {
  const templates = EMAIL_TEMPLATES.map((t) => {
    const { subject, html } = t.preview();
    return {
      id: t.id,
      name: t.name,
      trigger: t.trigger,
      from: t.from,
      routeFile: t.routeFile,
      subject,
      html,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)] mb-1">Automated emails</h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] max-w-2xl">
          Every automated / system-triggered email Swiftscope sends, rendered with sample data so you can see
          exactly what goes out without digging through code. These come from a shared template file
          (<code className="text-[12px] bg-[var(--line-subtle)] px-1 py-0.5 rounded">lib/email/templates.ts</code>) —
          editing that file changes both the real send and what you see here, so this view can never drift out of
          sync with production.
        </p>
        <p className="text-[12.5px] text-[var(--ink-faint)] mt-2 max-w-2xl">
          Not included: quotes, invoices, and dayworks docket emails — those are built per-record from live pricing
          and line items rather than a fixed template. The Outreach tool&apos;s emails aren&apos;t here either, since
          you write those live each time on the{" "}
          <Link href="/admin/outreach" className="underline hover:text-[var(--ink-soft)]">Outreach page</Link> itself.
        </p>
      </div>
      <EmailTemplatesViewer templates={templates} />
    </div>
  );
}
