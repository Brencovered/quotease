import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import AppHeader from "@/components/AppHeader";
import TeamPageClient, { TeamMemberRow, PendingInviteRow } from "@/components/TeamPageClient";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const ctx = await getTeamContext(supabase, user.id);
  const businessId = ctx.businessId;
  const isAdmin = ctx.isOwner || ctx.role === "admin";

  const [{ data: members }, { data: profile }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, email, name, role, status, invited_at, joined_at, hourly_rate")
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
          isOwner={ctx.isOwner}
          isAdmin={isAdmin}
          defaultHourlyRate={profile?.hourly_rate ?? 95}
          currentUserEmail={user.email ?? null}
        />
      </div>
    </>
  );
}
