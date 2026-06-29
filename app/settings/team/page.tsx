import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import TeamSettingsPanel from "@/components/TeamSettingsPanel";
import { getTeamContext } from "@/lib/team";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/team");

  const ctx = await getTeamContext(supabase, user.id);

  if (!ctx.isOwner) {
    return (
      <>
        <AppHeader />
        <div className="page-wrap-narrow">
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors mb-5">
            <ArrowLeft size={14} /> Back to Settings
          </Link>
          <div className="card text-center py-12">
            <p className="font-semibold text-[var(--ink)] mb-1">Owner access only</p>
            <p className="text-[13.5px] text-[var(--ink-faint)] max-w-xs mx-auto">
              You&apos;re a team member on {ctx.businessName ?? "this account"} -- only the account owner can manage the team.
            </p>
          </div>
        </div>
      </>
    );
  }

  const { data: members } = await supabase
    .from("team_members")
    .select("id, email, name, role, status, invited_at, joined_at")
    .eq("owner_profile_id", user.id)
    .neq("status", "removed")
    .order("invited_at", { ascending: false });

  return (
    <>
      <AppHeader />
      <div className="page-wrap-narrow">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors mb-5">
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        <div className="mb-6">
          <h1 className="font-display text-[28px] text-[var(--ink)] mb-1">Team</h1>
          <p className="text-[14px] text-[var(--ink-faint)]">
            Invite people to log in and work on your jobs, quotes, and clients.
          </p>
        </div>

        <TeamSettingsPanel members={members ?? []} />
      </div>
    </>
  );
}
