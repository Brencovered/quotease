import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";

const DEFAULT_TEMPLATES = [
  {
    type: "overdue_invoice",
    subject: "Payment reminder for {{business_name}} invoice",
    body: `Hi {{client_name}},

This is a friendly reminder that payment of ${{amount}} is outstanding for work completed at {{site_address}}.

Please contact us to arrange payment.

Thanks,
{{business_name}}`,
    is_default: true,
  },
  {
    type: "expiring_quote",
    subject: "Your quote from {{business_name}} expires soon",
    body: `Hi {{client_name}},

Just a reminder that your quote of ${{amount}} for work at {{site_address}} will expire soon.

To accept, visit: {{quote_url}}

Thanks,
{{business_name}}`,
    is_default: true,
  },
  {
    type: "quote_follow_up",
    subject: "Following up on your quote from {{business_name}}",
    body: `Hi {{client_name}},

I wanted to follow up on the quote I sent for work at {{site_address}}. 

The total was ${{amount}}. If you have any questions or would like to proceed, just reply to this email or call me.

Thanks,
{{business_name}}`,
    is_default: true,
  },
  {
    type: "job_update",
    subject: "Update on your job from {{business_name}}",
    body: `Hi {{client_name}},

I wanted to give you a quick update on the work at {{site_address}}.

Everything is on track. I will let you know if anything changes.

Thanks,
{{business_name}}`,
    is_default: true,
  },
];

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  // Check if any templates exist for this business
  const { data: existing } = await supabase
    .from("communication_templates")
    .select("id")
    .eq("profile_id", businessId)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, message: "Templates already exist" });
  }

  const { error } = await supabase.from("communication_templates").insert(
    DEFAULT_TEMPLATES.map((t) => ({ ...t, profile_id: businessId }))
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: DEFAULT_TEMPLATES.length });
}
