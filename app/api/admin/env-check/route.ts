/**
 * GET /api/admin/env-check
 * -------------------------
 * Admin-only diagnostic for "is this env var actually set in this
 * environment", without ever returning a secret's value.
 *
 * Built to close a specific gap: RESEND_API_KEY and RESEND_FROM_EMAIL have
 * been on the pre-launch checklist as "confirm this is set" for a while,
 * with no way to verify it except trusting the Vercel dashboard was
 * clicked through correctly. This gives a one-glance answer for every var
 * the app depends on, grouped by what breaks if it's missing.
 *
 * Two response shapes per var:
 *  - secret vars: { set: boolean } only - the value never leaves the server
 *  - non-secret config vars (sender email, price IDs, public keys, URLs):
 *    the actual value is returned, since these are either already public
 *    (NEXT_PUBLIC_*) or meant to be visible (a sender address, a Stripe
 *    price ID) - showing them is what makes a misconfigured placeholder
 *    (e.g. RESEND_FROM_EMAIL still being "quotes@yourdomain.com") visible
 *    at a glance instead of just "set: true".
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

type SecretCheck = { set: boolean };
type ConfigCheck = { set: boolean; value: string | null; warning?: string };

function secret(name: string): SecretCheck {
  const v = process.env[name];
  return { set: !!v && v.trim().length > 0 };
}

function config(name: string, placeholderCheck?: (v: string) => string | undefined): ConfigCheck {
  const v = process.env[name];
  const set = !!v && v.trim().length > 0;
  const warning = set && placeholderCheck ? placeholderCheck(v as string) : undefined;
  return { set, value: set ? (v as string) : null, warning };
}

export async function GET() {
  const authClient = await createClient();
  const { data: userData } = await authClient.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const result = {
    email_sending: {
      RESEND_API_KEY: secret("RESEND_API_KEY"),
      RESEND_FROM_EMAIL: config("RESEND_FROM_EMAIL", (v) =>
        v === "quotes@yourdomain.com"
          ? "This is the code's hardcoded fallback, not a real configured address - Resend will reject it (unverified domain). Set a real RESEND_FROM_EMAIL on a domain you've verified in Resend."
          : undefined
      ),
    },
    billing: {
      STRIPE_SECRET_KEY: secret("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: secret("STRIPE_WEBHOOK_SECRET"),
      STRIPE_PRICE_MONTHLY: config("STRIPE_PRICE_MONTHLY"),
      STRIPE_PRICE_ANNUAL: config("STRIPE_PRICE_ANNUAL"),
      STRIPE_PRICE_AI_ADDON: config("STRIPE_PRICE_AI_ADDON"),
    },
    ai: {
      AI_GATEWAY_API_KEY: secret("AI_GATEWAY_API_KEY"),
    },
    supabase: {
      NEXT_PUBLIC_SUPABASE_URL: config("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: secret("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: secret("SUPABASE_SERVICE_ROLE_KEY"),
    },
    push_notifications: {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: config("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
      VAPID_PRIVATE_KEY: secret("VAPID_PRIVATE_KEY"),
    },
    rate_limiting: {
      UPSTASH_REDIS_REST_URL: config("UPSTASH_REDIS_REST_URL"),
      UPSTASH_REDIS_REST_TOKEN: secret("UPSTASH_REDIS_REST_TOKEN"),
    },
    xero: {
      XERO_CLIENT_ID: config("XERO_CLIENT_ID"),
      XERO_CLIENT_SECRET: secret("XERO_CLIENT_SECRET"),
    },
    reece_supplier_integration: {
      REECE_ACCOUNT_NUMBER: config("REECE_ACCOUNT_NUMBER"),
      REECE_COMPANY_ID: config("REECE_COMPANY_ID"),
      REECE_USER_ID: config("REECE_USER_ID"),
      REECE_JWT_TOKEN: secret("REECE_JWT_TOKEN"),
    },
    directory_scraper: {
      GOOGLE_PLACES_API_KEY: secret("GOOGLE_PLACES_API_KEY"),
      GOOGLE_SERVICE_ACCOUNT_KEY: secret("GOOGLE_SERVICE_ACCOUNT_KEY"),
    },
    admin_and_cron: {
      ADMIN_EMAILS: config("ADMIN_EMAILS"),
      CRON_SECRET: secret("CRON_SECRET"),
    },
    app_url: {
      NEXT_PUBLIC_APP_URL: config("NEXT_PUBLIC_APP_URL"),
    },
  };

  return NextResponse.json(result);
}
