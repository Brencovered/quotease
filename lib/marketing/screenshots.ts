/**
 * lib/marketing/screenshots.ts
 * ----------------------------
 * One registry for every real product screenshot used in marketing.
 *
 * Why a registry rather than string paths scattered through the pages:
 *
 *  1. Intrinsic dimensions live next to the file. These are portrait phone
 *     shots at roughly 1:2.2, and next/image needs real width/height to
 *     reserve the right box. Guessing an aspect ratio is what produced the
 *     `aspect-[4/5] object-cover` crop on /features, which lops the bottom
 *     half off every screenshot it renders.
 *
 *  2. Alt text and captions are content, not layout. The caption under each
 *     shot is often the only place a specific feature name appears in body
 *     copy on that page, so it is doing SEO work as well as explaining what
 *     the reader is looking at.
 *
 *  3. Screenshots go stale. When a screen is redesigned the replacement
 *     lands here once and every page that references the key updates with
 *     it, instead of one page quietly showing last year's UI.
 *
 * Source files are cropped of OS chrome (status bar, home indicator,
 * browser URL bar) and encoded as WebP. Next re-encodes to AVIF on top of
 * that. The whole set is ~1MB, against 2MB for a single one of the old
 * /public/marketing PNGs.
 *
 * Known gap. Every shot here is captured from the electrician builder:
 * downlights in the pricebook, ceiling type and CCEW on the job step,
 * smoke alarms on the scope step. That is fine on the homepage and on
 * /quoting-software/electricians, and slightly undercuts the argument on
 * the roofer, plumber and carpenter pages, which claim a builder that
 * knows their trade and then show someone else's. Roughly half the set is
 * trade-neutral (quote capture, dashboard, job detail, dockets, Xero,
 * clients, team, both pricing tier screens) and would stay as is. The rest
 * wants a per-trade capture, at which point this becomes a keyed lookup
 * rather than a flat object.
 */

export interface Screenshot {
  src: string;
  /** Describes the screen for a reader who cannot see it. */
  alt: string;
  /** Shown under the image. Says what the screen does, not what it is. */
  caption: string;
  width: number;
  height: number;
}

export const SHOTS = {
  quoteCapture: {
    src: "/product/quote-capture.webp",
    alt: "Swiftscope quote capture screen with options for live site markup, uploading drawings, tracing over a floor plan and recording a voice note",
    caption: "Four ways into a quote: camera markup, drawings, a traced plan, or just talking.",
    width: 718,
    height: 1474,
  },
  liveCameraMarkup: {
    src: "/product/live-camera-markup.webp",
    alt: "Live camera view of a switchboard on a weatherboard wall with a conduit run drawn on screen and measured at 0.62 metres",
    caption: "Draw a conduit run on the live camera view and it measures itself.",
    width: 257,
    height: 482,
  },
  planMarkup: {
    src: "/product/plan-markup.webp",
    alt: "Floor plan uploaded to Swiftscope with ten numbered downlights placed on it and a running labour and materials total above",
    caption: "Tap downlights onto the plan. The total moves as you place them.",
    width: 600,
    height: 1330,
  },
  quoteJobPricing: {
    src: "/product/quote-job-pricing.webp",
    alt: "Swiftscope quote builder job step with customer type set to residential at six percent, job size set to medium at twelve percent, and an effective margin of eighteen percent shown as six plus twelve",
    caption: "Customer type and job size stack into one margin, and it shows its working.",
    width: 706,
    height: 1474,
  },
  scopeConditions: {
    src: "/product/scope-conditions.webp",
    alt: "Swiftscope scope step with roof cavity access set to tight crawl, subfloor to easy crawl, overall site access to moderate, and site condition fees for level 2 connection and switchboard isolation",
    caption: "Tight crawl, moderate access, level 2 connection. The things that blow a job out.",
    width: 714,
    height: 1472,
  },
  quoteSend: {
    src: "/product/quote-send.webp",
    alt: "Swiftscope send step listing on-site items pulled from a package with quantities and prices, a site items total of $1,181, and a job description field with a record option",
    caption: "Priced, itemised and ready to send, with the job description talked in if you prefer.",
    width: 714,
    height: 1480,
  },
  packages: {
    src: "/product/packages.webp",
    alt: "Swiftscope packages list showing a ten downlight install pack, a five downlight quote and a kitchen lighting package, each with item counts, estimated hours and price",
    caption: "The job you quote most often, saved once and reused in a tap.",
    width: 704,
    height: 1472,
  },
  quoteSentDetail: {
    src: "/product/quote-sent-detail.webp",
    alt: "A sent Swiftscope quote for $829 showing scope and cost, the site conditions considered, labour and materials split, accept and decline actions, and a follow-up overdue by three days",
    caption: "What the client sees, plus a nudge when the follow-up is overdue.",
    width: 712,
    height: 1480,
  },
  settingsSiteConditions: {
    src: "/product/settings-site-conditions.webp",
    alt: "Swiftscope settings screen listing per-trade site condition starting fees for electricians, including level 2 connection fees at $350 and main switchboard isolation at $120",
    caption: "Your own starting fees per trade, editable on any quote, never fixed.",
    width: 702,
    height: 1470,
  },
  materials: {
    src: "/product/materials.webp",
    alt: "Swiftscope materials catalogue with 72 items imported by CSV, searched for downlights, each showing cost price and sell price at residential markup",
    caption: "Your supplier price file, searchable, with cost and sell price side by side.",
    width: 646,
    height: 1472,
  },
  pricingTiers: {
    src: "/product/pricing-tiers.webp",
    alt: "Customer pricing tiers screen showing four tiers including residential at six percent markup and sub contracting at fifteen percent",
    caption: "A markup per customer type, so builder work is not priced like a homeowner.",
    width: 652,
    height: 1480,
  },
  jobSizeTiers: {
    src: "/product/job-size-tiers.webp",
    alt: "Job size tiers screen showing a small job bracket up to one day at three percent markup and a medium job bracket at twelve percent",
    caption: "Small jobs carry a premium, big ones a discount, without you doing the maths.",
    width: 642,
    height: 1476,
  },
  jobDetail: {
    src: "/product/job-detail.webp",
    alt: "Swiftscope job screen showing progress from scheduled to invoiced, tasks, dayworks dockets and a timeline of the quote being accepted and paid",
    caption: "Scheduled, in progress, complete, invoiced, with the whole history underneath.",
    width: 654,
    height: 1476,
  },
  docketEntry: {
    src: "/product/docket-entry.webp",
    alt: "Dayworks docket entry form with date, weather, site contact, description of work, labour, plant and equipment, materials and a running docket total",
    caption: "A day's labour, plant and materials logged on site, ready to be signed.",
    width: 708,
    height: 1476,
  },
  docketsSigned: {
    src: "/product/dockets-signed.webp",
    alt: "List of dayworks dockets on a job, two sent for signature and two signed by the site contact and marked ready to invoice",
    caption: "Signed on the client's phone, timestamped, and ready to invoice.",
    width: 720,
    height: 1430,
  },
  dayworksRates: {
    src: "/product/dayworks-rates.webp",
    alt: "Dayworks rates screen listing a full day and half day labour rate and an excavator plant rate",
    caption: "Your usual day rates saved once, picked from a list on every docket.",
    width: 646,
    height: 1480,
  },
  xeroExport: {
    src: "/product/xero-export.webp",
    alt: "Export to Xero or MYOB screen listing completed jobs with invoice numbers, amounts and the date each was previously exported",
    caption: "Completed jobs out to Xero or MYOB, with what you already sent marked off.",
    width: 594,
    height: 1330,
  },
  dashboard: {
    src: "/product/dashboard.webp",
    alt: "Swiftscope dashboard showing a quote pipeline of draft, sent, accepted, declined and paid quotes, a profit snapshot and time saved on quoting",
    caption: "What is out, what came back, and what it actually made you.",
    width: 654,
    height: 1484,
  },
  team: {
    src: "/product/team.webp",
    alt: "Team screen showing the account owner, active member and pending invite counts, and a form to invite a team member by email with a role",
    caption: "Invite the crew by email and set what each of them can see.",
    width: 648,
    height: 1478,
  },
  clients: {
    src: "/product/clients.webp",
    alt: "Client list searched by name, showing a client with two jobs totalling $9,415, their address, last job date and a button to start a new quote",
    caption: "Every client with their job history and total, one tap from a new quote.",
    width: 592,
    height: 1332,
  },
} as const;

export type ScreenshotKey = keyof typeof SHOTS;
