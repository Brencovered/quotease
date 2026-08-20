/**
 * Shared helpers for team invite email + ensuring an auth user exists
 * for the invitee (without a password yet — they set it on /team/accept).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamInviteRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  owner_profile_id: string;
  member_user_id: string | null;
  invite_token: string;
};

export async function getInviteByToken(
  admin: SupabaseClient,
  token: string
): Promise<TeamInviteRow | null> {
  const { data, error } = await admin
    .from("team_members")
    .select("id, email, name, role, status, owner_profile_id, member_user_id, invite_token")
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as TeamInviteRow;
}

export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  // Prefer direct filter when available; fall back to a short page scan.
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (!error && data?.users) {
      const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (hit) return hit.id;
    }
  } catch {
    // continue
  }

  // Broader scan for larger user bases (invite path is rare).
  for (let page = 2; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function ensureInviteAuthUser(
  admin: SupabaseClient,
  opts: {
    email: string;
    name?: string | null;
    inviteToken: string;
    ownerProfileId: string;
    role: string;
  }
): Promise<{ userId: string; created: boolean; alreadyHadAccount: boolean }> {
  const existingId = await findAuthUserIdByEmail(admin, opts.email);
  if (existingId) {
    const { data: existing } = await admin.auth.admin.getUserById(existingId);
    const alreadyHadAccount = Boolean(
      existing.user?.last_sign_in_at ||
        (existing.user?.app_metadata as { providers?: string[] } | undefined)?.providers?.length
    );
    await admin.auth.admin.updateUserById(existingId, {
      user_metadata: {
        ...(existing.user?.user_metadata ?? {}),
        signup_source: "team_invite",
        invite_token: opts.inviteToken,
        company_id: opts.ownerProfileId,
        invited_role: opts.role,
        ...(opts.name ? { full_name: opts.name } : {}),
      },
    });
    return { userId: existingId, created: false, alreadyHadAccount };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email.trim().toLowerCase(),
    email_confirm: true,
    user_metadata: {
      signup_source: "team_invite",
      invite_token: opts.inviteToken,
      company_id: opts.ownerProfileId,
      invited_role: opts.role,
      ...(opts.name ? { full_name: opts.name } : {}),
    },
  });

  if (error || !data.user) {
    // Race: user created between list and create
    const again = await findAuthUserIdByEmail(admin, opts.email);
    if (again) return { userId: again, created: false, alreadyHadAccount: true };
    throw new Error(error?.message ?? "Could not create invite account");
  }

  return { userId: data.user.id, created: true, alreadyHadAccount: false };
}

export function teamInviteEmailHtml(opts: {
  name: string | null;
  businessName: string;
  acceptUrl: string;
}): string {
  return `
    <p>${opts.name ? `Hi ${opts.name},` : "Hi,"}</p>
    <p><strong>${opts.businessName}</strong> has added you to their team on Swiftscope.</p>
    <p><a href="${opts.acceptUrl}">Set your password and join the team</a>.</p>
    <p style="color:#888;font-size:12px">This adds you to their company — you don&apos;t need to create a separate Swiftscope business.</p>
  `;
}

/**
 * Base URL for invite accept links.
 *
 * Prefer the deployment that handled the invite (request origin) so preview
 * invites stay on that preview. NEXT_PUBLIC_APP_URL is usually production,
 * which would bounce preview testers onto live middleware that still
 * redirects /team/accept → /login until the fix is merged.
 *
 * On production, request origin is already swiftscope.com.au.
 */
export function teamInviteAcceptBaseUrl(request: Request): string {
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, "");
  const host = new URL(request.url).host;
  const isPreviewHost =
    host.endsWith(".vercel.app") ||
    host.includes("localhost") ||
    host.startsWith("127.0.0.1");

  if (isPreviewHost) return requestOrigin;

  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return configured || requestOrigin;
}
