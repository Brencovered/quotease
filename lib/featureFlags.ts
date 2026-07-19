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
 * The free claimed directory page: ABN/licence verification badge, manual
 * photo gallery, quote capture into the real quotes table, monthly goal
 * setting, and the business marketing pack. No paid tier -- claiming a
 * page is free, zero barrier to adopt. (No Stripe/billing was ever built
 * for this, so there's nothing to remove -- it was always just this flag.)
 *
 * Off until the full v1 build is done and reviewed -- claim flow, business
 * lookup/matching, and richer page template all need to land together,
 * not incrementally in public. Nothing gated by this flag should be linked
 * to or discoverable while it's off.
 */
// TEMPORARILY ON for preview-branch testing only -- flip back to false
// before this branch merges to main. Never merge this file with the flag
// left true.
export const CLAIMED_DIRECTORY_PAGES_ENABLED = true;
