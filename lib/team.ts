/**
 * lib/team.ts
 * -----------
 * Resolves which business (profile_id) the currently logged-in user should
 * act on behalf of. For the business owner that's just their own id; for an
 * invited team member it's the owner's profile_id instead.
 *
 * This is an app-level convenience on top of the real security boundary,
 * which is the accessible_business_ids() Postgres function used in RLS
 * (see supabase/migrations.sql) -- even if a route forgets to call this and
 * queries by the user's own id directly, RLS still only returns rows for
 * businesses they're actually allowed to see. This helper just makes sure
 * team members land on the right business's data instead of their own
 * (usually empty) one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamRole = "owner" | "admin" | "manager" | "site_member";
export type AccessScope = "all" | "assigned_only";

export interface TeamContext {
  businessId: string;
  isOwner: boolean;
  role: TeamRole;
  accessScope: AccessScope;
  /** True for owner, admin, and an unrestricted (access_scope='all') manager. False for site_member and a restricted manager. */
  isJobRestricted: boolean;
  /** True for everyone except site_member. The one flag every $ figure in the UI should be gated on. */
  canSeePricing: boolean;
  businessName: string | null;
}

export async function getTeamContext(supabase: SupabaseClient, userId: string): Promise<TeamContext> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("owner_profile_id, role, access_scope, profiles:owner_profile_id(business_name)")
    .eq("member_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    const ownerProfile = membership.profiles as unknown as { business_name: string | null } | null;
    const role: TeamRole = membership.role === "admin" ? "admin" : membership.role === "site_member" ? "site_member" : "manager";
    const accessScope: AccessScope = membership.access_scope === "assigned_only" ? "assigned_only" : "all";
    const isJobRestricted = role === "site_member" || (role === "manager" && accessScope === "assigned_only");
    return {
      businessId: membership.owner_profile_id,
      isOwner: false,
      role,
      accessScope,
      isJobRestricted,
      canSeePricing: role !== "site_member",
      businessName: ownerProfile?.business_name ?? null,
    };
  }

  return { businessId: userId, isOwner: true, role: "owner", accessScope: "all", isJobRestricted: false, canSeePricing: true, businessName: null };
}

export async function getActiveBusinessId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("owner_profile_id")
    .eq("member_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return membership?.owner_profile_id ?? userId;
}
