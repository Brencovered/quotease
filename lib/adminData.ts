/**
 * lib/adminData.ts
 * -----------------
 * Server-only data fetching for the /admin dashboard. Always uses the
 * service-role admin client since this needs to see every tradie account,
 * not just the caller's own row -- never import this into client components.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { computeEngagement, type EngagementResult } from "@/lib/adminEngagement";

export interface TradieRow {
  id: string;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  trades: string[];
  subscription_status: string;
  trial_ends_at: string | null;
  onboarded_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  quotesCreated: number;
  quotesSent: number;
  quotesAccepted: number;
  quotesTotalValue: number;
  hasMaterials: boolean;
  engagement: EngagementResult;
}

async function listAllAuthUsers(): Promise<Map<string, { last_sign_in_at: string | null }>> {
  const admin = createAdminClient();
  const map = new Map<string, { last_sign_in_at: string | null }>();
  let page = 1;
  const perPage = 200;

  // Capped at 5 pages (1000 users) -- plenty of headroom for current scale.
  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) map.set(u.id, { last_sign_in_at: u.last_sign_in_at ?? null });
    if (data.users.length < perPage) break;
    page++;
  }

  return map;
}

export async function getTradieRows(): Promise<TradieRow[]> {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: quotes }, { data: materials }, authUsers] = await Promise.all([
    admin
      .from("profiles")
      .select("id, business_name, contact_email, contact_phone, trades, subscription_status, trial_ends_at, onboarded_at, created_at")
      .order("created_at", { ascending: false }),
    admin.from("quotes").select("profile_id, sent_at, accepted_at, total_cost"),
    admin.from("material_items").select("profile_id"),
    listAllAuthUsers(),
  ]);

  const materialsByProfile = new Set((materials ?? []).map((m) => m.profile_id));

  const quotesByProfile = new Map<string, { created: number; sent: number; accepted: number; value: number }>();
  for (const q of quotes ?? []) {
    const row = quotesByProfile.get(q.profile_id) ?? { created: 0, sent: 0, accepted: 0, value: 0 };
    row.created += 1;
    if (q.sent_at) row.sent += 1;
    if (q.accepted_at) { row.accepted += 1; row.value += q.total_cost ?? 0; }
    quotesByProfile.set(q.profile_id, row);
  }

  return (profiles ?? []).map((p) => {
    const q = quotesByProfile.get(p.id) ?? { created: 0, sent: 0, accepted: 0, value: 0 };
    const hasMaterials = materialsByProfile.has(p.id);
    const lastSignIn = authUsers.get(p.id)?.last_sign_in_at ?? null;

    return {
      id: p.id,
      business_name: p.business_name,
      contact_email: p.contact_email,
      contact_phone: p.contact_phone,
      trades: p.trades ?? [],
      subscription_status: p.subscription_status,
      trial_ends_at: p.trial_ends_at,
      onboarded_at: p.onboarded_at,
      created_at: p.created_at,
      last_sign_in_at: lastSignIn,
      quotesCreated: q.created,
      quotesSent: q.sent,
      quotesAccepted: q.accepted,
      quotesTotalValue: q.value,
      hasMaterials,
      engagement: computeEngagement({
        onboarded: !!p.onboarded_at,
        hasMaterials,
        quotesCreated: q.created,
        quotesSent: q.sent,
        quotesAccepted: q.accepted,
        hasSignedIn: !!lastSignIn,
      }),
    };
  });
}

export async function getTradieDetail(profileId: string) {
  const admin = createAdminClient();

  const [{ data: profile }, { data: quotes }, { data: materials }, authUsers] = await Promise.all([
    admin.from("profiles").select("*").eq("id", profileId).single(),
    admin
      .from("quotes")
      .select("id, client_name, trade, job_type, total_cost, status, sent_at, accepted_at, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("material_items").select("id").eq("profile_id", profileId).limit(1),
    listAllAuthUsers(),
  ]);

  if (!profile) return null;

  const lastSignIn = authUsers.get(profile.id)?.last_sign_in_at ?? null;
  const quotesSent = (quotes ?? []).filter((q) => q.sent_at).length;
  const quotesAccepted = (quotes ?? []).filter((q) => q.accepted_at).length;

  const engagement = computeEngagement({
    onboarded: !!profile.onboarded_at,
    hasMaterials: (materials ?? []).length > 0,
    quotesCreated: (quotes ?? []).length,
    quotesSent,
    quotesAccepted,
    hasSignedIn: !!lastSignIn,
  });

  return { profile, quotes: quotes ?? [], lastSignIn, engagement };
}
