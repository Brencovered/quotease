# Tradie Quote App

Trade-specific job intake that calculates a quote live as you fill it in.
Electrician is the first trade built out — residential/reno focused, with
roof/subfloor access time factors and a per-tradie materials price book.

## Architecture

- **Next.js 15 (App Router)** — frontend and API routes in one deploy
- **Supabase** — auth, Postgres (profiles, material_items, quotes), row-level
  security so each tradie only ever sees their own data
- **Resend** — sends the quote email to the client
- **Xero** — OAuth2, so each tradie connects their own Xero org

## Setup

1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor
2. Copy `.env.example` to `.env.local` and fill in the Supabase keys
3. `npm install && npm run dev`
4. Sign up at `/signup` — this seeds the placeholder material prices for that account
5. Go to the materials library tab and either edit prices by hand or upload a
   CSV (`key,cost` per line — use "Download template" in the UI for the exact keys)

### Enabling "send quote"
Sign up at resend.com, verify a sending domain, add `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` to your env vars. Without these, "Save and email quote"
will save the draft but the send will fail with a clear error.

### Enabling Xero
Register a developer app at developer.xero.com/app/manage. Set its redirect
URI to `<your-deployed-url>/api/xero/callback`, then add `XERO_CLIENT_ID`,
`XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` to your env vars. Each tradie then
connects their own org from the Settings page — tokens are stored per-profile,
not shared.

**Not yet built**: actually pushing an accepted quote into Xero as a draft
invoice (the OAuth connection and token storage are in place, but the
`POST /api/v2.0/Invoices` call itself isn't wired up yet — that's the next
piece once a real Xero developer app exists to test against).

## What's a placeholder right now

- Material price book is seeded with made-up defaults on signup — every
  tradie needs to replace these with real numbers before quotes mean anything
- Labour time-per-item assumptions (0.4hr per power point, roof/subfloor
  multipliers, etc) in `lib/calc.ts` are estimates, not validated against
  real job data — tune these with your electrician mate's actual numbers
- Only the electrician trade is built; `lib/calc.ts` and the materials seed
  list are the pattern to follow for the next trade

## Deploying

Push to GitHub, then import the repo in Vercel and set the env vars above
in the project settings. No other config needed — it's a standard Next.js app.
