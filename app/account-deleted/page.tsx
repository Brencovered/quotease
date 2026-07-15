import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountDeletedPanel from "@/components/AccountDeletedPanel";
import { getTeamContext } from "@/lib/team";

// Always fetch fresh -- deleted_at can change (restore) between visits.
export const dynamic = "force-dynamic";

const GRACE_PERIOD_DAYS = 30;

export default async function AccountDeletedPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Deletion is a business-level action (see middleware.ts) - checking
  // the individual's own profile here would create a redirect loop for
  // a team member: middleware sends them here because the BUSINESS is
  // deleted, but their own individual profile was never touched, so
  // this page would immediately bounce them back to /quote.
  const ctx = await getTeamContext(supabase, userData.user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, deleted_at")
    .eq("id", ctx.businessId)
    .single();

  // Not actually deleted (e.g. already restored in another tab) -- nothing
  // for this page to do, send them back into the app.
  if (!profile?.deleted_at) redirect("/quote");

  const deletedAt = new Date(profile.deleted_at);
  const purgeDate = new Date(deletedAt.getTime() + GRACE_PERIOD_DAYS * 86400000);

  return (
    <AccountDeletedPanel
      businessName={profile.business_name ?? "your account"}
      deletedAtIso={profile.deleted_at}
      purgeDateIso={purgeDate.toISOString()}
      canRestore={ctx.isOwner || ctx.role === "admin"}
    />
  );
}
