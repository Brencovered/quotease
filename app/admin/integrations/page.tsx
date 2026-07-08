import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import ReeceIntegrationPanel from "@/components/ReeceIntegrationPanel";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?next=/admin/integrations");
  if (!isAdminEmail(userData.user.email)) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-[var(--ink)]">Integrations</h1>
        <p className="text-[13px] text-[var(--ink-soft)] mt-0.5">
          Third-party supplier and service integrations
        </p>
      </div>

      <ReeceIntegrationPanel />
    </div>
  );
}
