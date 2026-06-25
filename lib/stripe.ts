import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

// Lazy singleton — created on first actual use, not at module import time.
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

// $40 AUD/month flat, unlimited users. Annual gets roughly 2 months free
// ($400/year vs $480 if paid monthly) as the loyalty incentive.
// Create these two Prices in the Stripe dashboard (or via the Stripe CLI)
// and put their IDs in env vars — never hardcode price IDs, since they
// differ between test mode and live mode.
export const STRIPE_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
} as const;

export const TRIAL_DAYS = 7;
