# Swiftscope (quotease)

AU trade quoting SaaS: build a live quote on site, send it, win the job, run the crew day, push a draft invoice to Xero.

## Architecture

- **Next.js App Router** - UI and API routes in one deploy
- **Supabase** - auth, Postgres, RLS (each business only sees its own data)
- **Resend** - quote and notification email
- **Xero** - OAuth2 per business; accepted quotes push as **draft** invoices
- **Stripe** - $45/mo flat (or annual), 7-day no-card trial, unlimited users

## Database setup

Do **not** treat `supabase/schema.sql` as the full live schema. Production evolves through dated files in `supabase/migrations/` (apply in order on new environments).

`schema.sql` is a historical bootstrap snapshot only. Prefer:

1. Link the project with the Supabase CLI, or
2. Run the migrations folder against a fresh database in chronological filename order

If you must bootstrap from SQL editor, run migrations after any base schema, then verify with the latest migration timestamps.

## Setup

1. Create a Supabase project and apply `supabase/migrations/` (see above)
2. Copy `.env.example` to `.env.local` and fill in Supabase keys
3. `npm install && npm run dev`
4. Sign up and complete onboarding (trade is fixed there; price book should use your real costs before client sends)

### Enabling "send quote"

Sign up at resend.com, verify a sending domain, add `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Without these, save still works; send fails with a clear error.

### Enabling Xero

Register a developer app at developer.xero.com. Redirect URI: `<deployed-url>/api/xero/callback`. Set `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`.

Each business connects their own org from Settings. On quote accept, Swiftscope pushes a **draft** invoice (scope lines when available, otherwise the quote total). Payment status does **not** sync back from Xero yet - mark jobs paid in Swiftscope when money clears. Variations do not auto-update the Xero invoice yet.

### Enabling billing (Stripe)

$45/mo or annual (~2 months free), unlimited users, 7-day free trial, no per-seat pricing.

1. Create recurring Prices in Stripe (AUD monthly + annual)
2. Set `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_SECRET_KEY`
3. Webhook to `/api/stripe/webhook` for subscription + checkout events → `STRIPE_WEBHOOK_SECRET`
4. `SUPABASE_SERVICE_ROLE_KEY` for webhook writes
5. `NEXT_PUBLIC_APP_URL` for Checkout redirects

Access is gated in `middleware.ts` via trial/subscription status (`lib/requireActiveAccess.ts`).

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm test          # vitest unit tests (quote grouping, Xero line builder, trade normalize)
```

## What's still honest / incomplete

- Starter material seeds are **placeholders** - replace before sending client quotes
- Labour time assumptions in calc engines are estimates
- Most of 13 trades share the generic quote shell; electrician / plumber / carpenter / roofer have deeper helpers
- Xero: draft invoice push on accept is live; payment back-sync and variation invoice updates are not
- Job costing / Profit still relies on manual actuals in places - timesheets alone do not fill every margin board

## Deploying

Push to GitHub, import in Vercel, set the env vars above. Standard Next.js app.
