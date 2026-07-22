/**
 * lib/featureFlags.ts
 * --------------------
 * Simple on/off switches for features that are built and working but
 * deliberately not surfaced yet. Kept as plain constants (not env vars)
 * since these are product decisions, not per-environment config -- flip
 * the value and redeploy.
 */

/**
 * The "get a quote" / lead-matching flow (homeowner posts a job, up to 3
 * matched tradies get notified and can claim it) and the per-listing
 * "request a quote" enquiry form on the directory.
 *
 * Off for now: with limited directory coverage, a homeowner posting a job
 * or submitting an enquiry that no tradie claims or responds to hurts
 * trust more than not offering the feature at all. The directory itself
 * (browse, call, email, visit website) is the focus until there's enough
 * tradie density for the lead flow to reliably deliver a response.
 *
 * Nothing downstream was deleted -- /get-quotes, the directory enquiry
 * form/modal, /api/directory/enquire, /api/job-requests/*, and their
 * tables are all intact. Flip this back to true (and the matching
 * per-file flags in app/directory/[slug]/page.tsx and
 * components/DirectoryCard.tsx, which are kept in sync manually) to
 * bring it all back with no other code changes.
 */
export const LEADS_ENABLED = false;

/**
 * The per-listing "request a quote" enquiry form on directory pages
 * (app/api/directory/enquire, the QuoteForm component). Separate from
 * LEADS_ENABLED above -- that's the broader lead-matching flow
 * (/get-quotes, homeowner posts a job, matched tradies get notified),
 * which stays off. This is just the simpler, per-business enquiry form.
 *
 * Routing:
 *  - Claimed listing: sent to the account's real email (profiles.contact_email)
 *  - Unclaimed listing: sent to the scraped contact email if we have a
 *    valid one on file, falling back to Swiftscope's own inbox otherwise
 *    -- and includes a claim-your-page nudge, since this is a genuine,
 *    concrete "here's why you'd want an account" moment for an unclaimed
 *    business.
 *
 * Was two separate hardcoded `false` constants in
 * app/directory/[slug]/page.tsx and components/DirectoryCard.tsx, kept in
 * sync manually -- promoted to one shared flag here instead.
 */
export const QUOTE_REQUESTS_ENABLED = true;

/**
 * The free claimed directory page: ABN/licence verification badge, manual
 * photo gallery, quote capture into the real quotes table, monthly goal
 * setting, and the business marketing pack. No paid tier -- claiming a
 * page is free, zero barrier to adopt. (No Stripe/billing was ever built
 * for this, so there's nothing to remove -- it was always just this flag.)
 *
 * Live as of 20 July 2026. ABN verification (lib/abnLookup.ts) degrades
 * gracefully to "unverified" until ABN_LOOKUP_GUID is set in Vercel --
 * the Verified Business badge won't actually turn on for anyone until
 * that's configured, but nothing breaks in the meantime.
 */
export const CLAIMED_DIRECTORY_PAGES_ENABLED = true;
