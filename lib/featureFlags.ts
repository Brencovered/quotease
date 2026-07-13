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
