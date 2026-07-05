import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountDeletedPanel from "@/components/AccountDeletedPanel";

// Always fetch fresh -- deleted_at can change (restore) between visits.
export const dynamic = "force-dynamic";

const GRACE_PERIOD_DAYS = 30;

export default async function AccountDeletedPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, deleted_at")
    .eq("id", userData.user.id)
    .single();

  // Not actually deleted (e.g. already restored in another tab) -- nothing
  // for this page to do, send them back into the app.
  if (!profile?.deleted_at) redirect("/electrician");

  const deletedAt = new Date(profile.deleted_at);
  const purgeDate = new Date(deletedAt.getTime() + GRACE_PERIOD_DAYS * 86400000);

  return (
    <AccountDeletedPanel
      businessName={profile.business_name ?? "your account"}
      deletedAtIso={profile.deleted_at}
      purgeDateIso={purgeDate.toISOString()}
    />
  );
}
