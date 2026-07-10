import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

// Lazy singleton - created on first actual use, not at module import time.
// Vercel evaluates route modules during the build's page-data-collection step
// even before env vars are wired up, so constructing Stripe eagerly at the
// top level crashes the build with "Neither apiKey nor config.authenticator
// provided" the moment STRIPE_SECRET_KEY is missing.
export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return stripeInstance;
}

// $45 AUD/month flat, unlimited users. Annual gets roughly 2 months free
// ($450/year vs $540 if paid monthly) as the loyalty incentive -- update the
// actual Price object in Stripe to match before setting STRIPE_PRICE_ANNUAL.
// Create these two Prices in the Stripe dashboard (or via the Stripe CLI)
// and put their IDs in env vars - never hardcode price IDs, since they
// differ between test mode and live mode.
export const STRIPE_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
} as const;

// The real "7-day free trial, no card needed" already happens before
// anyone reaches Stripe at all (gated via trial_ends_at on the profile,
// set at signup). Stripe's own trial_period_days must stay 0, or anyone
// who enters a card gets a second trial stacked on top of the first -
// 14 days free instead of 7.
export const TRIAL_DAYS = 0;
