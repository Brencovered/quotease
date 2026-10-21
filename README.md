# SwiftScope (quotease)

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

Each business connects their own org from Settings. On quote accept, SwiftScope pushes a **draft** invoice (scope lines when available, otherwise the quote total). Payment status does **not** sync back from Xero yet - mark jobs paid in SwiftScope when money clears. Variations do not auto-update the Xero invoice yet.

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
npm run directory:merge    # dry-run duplicate plan; add -- --apply to write
npm run directory:abn      # free ABN ingest + enrich + MX/ABN verify (local)
npm run directory:verify   # re-check ABN status and email MX only
```

## Directory data (free, scheduled)

`directory_listing` feeds SEO pages and outreach. Phone numbers are stored as E.164 (`+61…`) in `phone_e164`, websites as a bare hostname in `website_domain`, and ABNs as 11 digits. Shared call-centre numbers (`13` / `1300` / `1800` / `1900`) and directory hosts (Facebook, Yellow Pages, supplier sites) are not used as unique identity.

Apply order on an existing database (do this yourself; nothing in CI mutates production):

1. Apply `supabase/migrations/20261021120000_directory_listing_identity.sql`. It adds `abn`, `phone_e164`, `website_domain`, `verified_at`, `verification_source`, `email_valid`, and the shared-key flags. It also relabels historical `source = 'scraper'` rows that have a `place_id` to `google_places`. Deploy the app only after this migration: outreach export and claim-invite select `email_valid`.
2. Dry-run `npx tsx scripts/merge-directory-duplicates.ts` (or `npm run directory:merge`). Read the MERGE, SUPPRESS, and REVIEW lines.
3. Apply with `npx tsx scripts/merge-directory-duplicates.ts --apply`. Same-suburb rows that are the same business are merged (claimed or richer row wins; the loser is snapshotted in `directory_listing_merge_log`). Different businesses that share a phone or domain keep both rows; the extra row drops the normalised key so the unique index can exist. The displayed phone and website stay. A group with two claimed profiles is left for a person to resolve.
4. Apply `supabase/migrations/20261021130000_directory_listing_unique_identity.sql`. It refuses to create the unique indexes while any duplicate phone, domain, or ABN group remains in one suburb.
5. Deploy the app.

Secrets for the weekly GitHub Action `.github/workflows/abn-directory.yml` (Settings → Secrets and variables → Actions). Do not commit values.

| Name | Where |
| --- | --- |
| `SUPABASE_URL` | same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `ABN_LOOKUP_GUID` | free registration at https://abr.business.gov.au/Tools/WebServices |

Optional variables: `ABN_ENRICH_LIMIT` (default 800), `DIRECTORY_VERIFY_LIMIT` (default 2000). The workflow runs Sundays at 16:00 UTC, or on demand with phase `all`, `ingest`, `enrich`, or `verify`. It downloads each ABR zip once, stream-parses it, bulk-inserts trade candidates, guesses websites in parallel, then re-checks ABNs (ABN Lookup) and email DNS MX records. It never sends email and it deletes `GOOGLE_PLACES_API_KEY` from the job environment before it starts. Google Places stays on the manual admin scrape, directory-page scrape, and listing-create screens. The paused `expand-directory` cron stays out of `vercel.json`.

The admin page **ABN directory growth** starts that same workflow. The server needs `GITHUB_ACTIONS_DISPATCH_TOKEN` (Vercel env or `.env.local`): a fine-grained GitHub token with Actions read and write on this repository, or a classic token with the `workflow` scope. Optional `GITHUB_REPOSITORY` (default `Brencovered/quotease`) and `ABN_WORKFLOW_REF` (default `main`). Merge the workflow to that ref before using the button. Apply `supabase/migrations/20261021140000_abn_directory_runs.sql` so the page can show queued, running, done, or failed, with a link to the Actions run. The page polls that table and the newest candidates and listings. Phase 2 ("Process next 50", or continuous while the page is open) still runs on the server and does not call Google.

The Actions workflow also writes progress into `abn_directory_runs`. A full run can take hours of GitHub-hosted time. It does not call a paid search API.

## What's still honest / incomplete

- Starter material seeds are **placeholders** - replace before sending client quotes
- Labour time assumptions in calc engines are estimates
- Most of 13 trades share the generic quote shell; electrician / plumber / carpenter / roofer have deeper helpers
- Xero: draft invoice push on accept is live; payment back-sync and variation invoice updates are not
- Job costing / Profit still relies on manual actuals in places - timesheets alone do not fill every margin board

## Deploying

Push to GitHub, import in Vercel, set the env vars above. Standard Next.js app.
