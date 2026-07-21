import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import { requireActiveAccess } from "@/lib/requireActiveAccess";
import AppHeader from "@/components/AppHeader";
import TeamPageClient, { TeamMemberRow, PendingInviteRow } from "@/components/TeamPageClient";

export default async function TeamPage() {
  // This page used to be under app/quote's layout, which applied
  // this check to every route under it. Now that it lives at /team
  // (merged alongside the pre-existing /team/accept/[token] invite-accept
  // route, which must NOT be gated - someone accepting an invite may not
  // have active access yet), the check has to happen here directly
  // instead of via a shared layout.
  await requireActiveAccess();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const ctx = await getTeamContext(supabase, user.id);
  const businessId = ctx.businessId;
  const isAdmin = ctx.isOwner || ctx.role === "admin";
  const canManageTeam = ctx.isOwner || ctx.role === "admin" || ctx.role === "manager";

  const [{ data: members }, { data: profile }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, email, name, role, access_scope, status, invited_at, joined_at, hourly_rate")
      .eq("owner_profile_id", businessId)
      .neq("status", "removed")
      .order("joined_at", { ascending: false }),
    supabase.from("profiles").select("hourly_rate").eq("id", businessId).single(),
  ]);

  const activeMembers: TeamMemberRow[] = (members ?? [])
    .filter((m) => m.status === "active")
    .map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      access_scope: m.access_scope,
      status: m.status,
      invited_at: m.invited_at,
      joined_at: m.joined_at,
      hourly_rate: m.hourly_rate,
    }));

  const pendingInvites: PendingInviteRow[] = (members ?? [])
    .filter((m) => m.status === "invited")
    .map((m) => ({
      id: m.id,
      invite_token: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      access_scope: m.access_scope,
      status: m.status,
      invited_at: m.invited_at,
      owner_business_name: null,
    }));

  return (
    <>
      <AppHeader />
      <div className="page-wrap">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-[28px] text-[var(--ink)]">Team</h1>
            <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
              Manage your crew. Invite members, assign roles, and collaborate.
            </p>
          </div>
        </div>
        <TeamPageClient
          members={activeMembers}
          pendingInvites={pendingInvites}
          isAdmin={isAdmin}
          canManageTeam={canManageTeam}
          defaultHourlyRate={profile?.hourly_rate ?? 95}
          currentUserEmail={user.email ?? null}
        />
      </div>
    </>
  );
}
