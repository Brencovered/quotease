import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

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
