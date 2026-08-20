import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TeamAcceptPanel from "@/components/TeamAcceptPanel";

export const dynamic = "force-dynamic";

export default async function TeamAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("team_members")
    .select(
      "id, email, name, role, status, owner_profile_id, member_user_id, profiles:owner_profile_id(business_name)"
    )
    .eq("invite_token", token)
    .single();

  if (!invite) notFound();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const businessName =
    (invite.profiles as unknown as { business_name: string | null } | null)
      ?.business_name ?? "this business";

  let alreadyHadAccount = false;
  if (invite.member_user_id) {
    const { data } = await admin.auth.admin.getUserById(invite.member_user_id);
    alreadyHadAccount = Boolean(data.user?.last_sign_in_at);
  }

  return (
    <TeamAcceptPanel
      token={token}
      invitedEmail={invite.email}
      invitedName={invite.name}
      businessName={businessName}
      status={invite.status}
      currentUserEmail={userData.user?.email ?? null}
      alreadyHadAccount={alreadyHadAccount}
    />
  );
}
