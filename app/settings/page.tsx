import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";
import XeroConnectPanel from "@/components/XeroConnectPanel";
import DirectoryPanel from "@/components/DirectoryPanel";
import AccountDangerZone from "@/components/AccountDangerZone";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";

// Always fetch fresh -- Xero OAuth redirect must see updated connection state
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let profile: {
    business_name?: string;
    contact_email?: string;
    xero_connected?: boolean;
    xero_connected_at?: string | null;
    xero_tenant_id?: string | null;
    trades?: string[];
    ai_free_analyses_used?: number;
    ai_addon_status?: string;
    ai_addon_period?: string | null;
    ai_addon_analyses_used?: number;
    subscription_status?: string;
    stripe_subscription_id?: string | null;
    cancel_at_period_end?: boolean;
    current_period_end?: string | null;
    comp_access?: boolean;
    send_weekly_digest?: boolean;
  } | null = null;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase.from("profiles").select("id, business_name, contact_email, contact_phone, trades, hourly_rate, materials_margin_pct, default_deposit_pct, default_expiry_days, logo_url, abn, license_number, business_address, bank_account_name, bank_bsb, bank_account_number, accepts_cash, xero_tenant_id, xero_connected_at, xero_account_code, xero_tax_type, ai_free_analyses_used, ai_addon_status, ai_addon_period, ai_addon_analyses_used, directory_enabled, directory_suburb, directory_postcode, directory_bio, directory_website, directory_phone, directory_email, subscription_status, stripe_subscription_id, cancel_at_period_end, current_period_end, comp_access, send_weekly_digest").eq("id", userData.user.id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile = data as any;
    }
  } catch (err) {
    console.error("Settings page: continuing without profile data -", err);
  }

  const xeroConnected = !!(profile as Record<string, unknown>)?.xero_tenant_id;

  return (
    <>
      <AppHeader />
      <SettingsPanel profile={profile} />

      {/* Team */}
      <div className="page-wrap-narrow pb-0 pt-0">
        <div className="card mt-0 mb-4">
          <p className="section-tag mb-1">Team</p>
          <p className="font-semibold text-[var(--ink)] mb-1">Add people to your account</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">
            Invite team members to log in and work on your jobs, quotes, and clients.
          </p>
          <Link href="/settings/team" className="btn-secondary inline-flex">
            <Users size={14} /> Manage team
          </Link>
        </div>
      </div>

      {/* Supplier price book */}
      <div className="page-wrap-narrow pb-0 pt-0">
        <div className="card mt-0 mb-4">
          <p className="section-tag mb-1">Supplier price books</p>
          <p className="font-semibold text-[var(--ink)] mb-1">Auto-fill material prices when quoting</p>
          <p className="text-[13px] text-[var(--ink-faint)] mb-3">
            Import CSVs from Reece, Tradelink, Middy&apos;s and others.
            Prices appear as you type when building a quote.
          </p>
          <Link href="/settings/pricebook" className="btn-secondary inline-flex">
            <BookOpen size={14} /> Manage price books
          </Link>
        </div>

        {/* Xero */}
        <div className="page-wrap-narrow pb-0 pt-0">
          <DirectoryPanel profile={profile as never} />
        </div>

        <XeroConnectPanel
          connected={xeroConnected}
          connectedAt={(profile as Record<string, unknown>)?.xero_connected_at as string | null ?? null}
          tenantId={(profile as Record<string, unknown>)?.xero_tenant_id as string | null ?? null}
        />
      </div>

      {/* Danger zone: cancel subscription, delete account */}
      <div className="page-wrap-narrow pb-0 pt-0">
        <AccountDangerZone
          businessName={profile?.business_name ?? ""}
          subscriptionStatus={profile?.subscription_status ?? null}
          hasSubscription={!!profile?.stripe_subscription_id}
          cancelAtPeriodEnd={profile?.cancel_at_period_end ?? false}
          currentPeriodEnd={profile?.current_period_end ?? null}
          compAccess={profile?.comp_access ?? false}
        />
      </div>
    </>
  );
}
