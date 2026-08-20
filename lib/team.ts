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

export interface TeamContext {
  businessId: string;
  isOwner: boolean;
  role: "owner" | "admin" | "manager" | "site_member";
  // Only meaningful when role is "manager" -- whether they see every job for
  // the business or only ones they're assigned to via job_crew. Null for
  // every other role: site_member is always job-scoped regardless, admin
  // and owner are always unrestricted regardless.
  accessScope: "all" | "assigned_only" | null;
  businessName: string | null;
}

function normalizeRole(raw: string | null | undefined): "admin" | "manager" | "site_member" {
  if (raw === "admin") return "admin";
  if (raw === "manager") return "manager";
  return "site_member";
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
    const role = normalizeRole(membership.role);
    return {
      businessId: membership.owner_profile_id,
      isOwner: false,
      role,
      accessScope: role === "manager" ? (membership.access_scope === "assigned_only" ? "assigned_only" : "all") : null,
      businessName: ownerProfile?.business_name ?? null,
    };
  }

  return { businessId: userId, isOwner: true, role: "owner", accessScope: null, businessName: null };
}

/** Owner and admin always see pricing; manager sees it too (that's the point
 *  of the tier); site_member never does. This is the one function that
 *  should decide $-visibility everywhere -- don't reimplement the check
 *  inline, since "manager" was missed for exactly that reason before. */
export function canSeePricing(ctx: Pick<TeamContext, "isOwner" | "role">): boolean {
  return ctx.isOwner || ctx.role === "admin" || ctx.role === "manager";
}

/** Site members only work assigned jobs — hide owner tooling (dashboard, quoting, etc.). */
export function isFieldWorker(ctx: Pick<TeamContext, "isOwner" | "role">): boolean {
  return !ctx.isOwner && ctx.role === "site_member";
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
