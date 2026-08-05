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
 * /quoting-software/electricians. Plumbers and carpenters have their own
 * real captures now too (materials, packages, send), used on their own
 * pages via app/quoting-software/[trade]/page.tsx's per-trade shot maps.
 * Roofers and the two generic-builder trades (painters-and-plasterers,
 * the catch-all trades page) still don't -- those three pages fall back
 * to the trade-neutral subset (quote capture, dashboard, job detail,
 * dockets, Xero, clients, team, both pricing tier screens) rather than
 * showing a different trade's fields.
 */

export interface ScreenshotToast {
  /** Looked up against PhoneStage's own icon map; an unknown key just means no icon renders. */
  icon: string;
  title: string;
  subtitle: string;
}

export interface Screenshot {
  src: string;
  /** Describes the screen for a reader who cannot see it. */
  alt: string;
  /** Shown under the image. Says what the screen does, not what it is. */
  caption: string;
  width: number;
  height: number;
  /**
   * Default content for the floating notification card PhoneStage overlays
   * on the screenshot. Tied to a real number already visible in the shot
   * itself -- the $829 on quoteSentDetail is the actual total in that
   * screenshot, not a made-up figure -- because a toast that contradicts
   * the screen behind it reads as fake, and one that echoes it reads as
   * the product surfacing its own result. A page can still override this
   * per-use by passing its own `toast` prop to PhoneStage.
   */
  toast?: ScreenshotToast;
}

export const SHOTS = {
  quoteCapture: {
    src: "/product/quote-capture.webp",
    alt: "Swiftscope quote capture screen with options for live site markup, uploading drawings, tracing over a floor plan and recording a voice note",
    caption: "Four ways into a quote: camera markup, drawings, a traced plan, or just talking.",
    width: 718,
    height: 1474,
    toast: { icon: "layers", title: "4 ways in", subtitle: "Camera, plan, drawings or voice" },
  },
  liveCameraMarkup: {
    src: "/product/live-camera-markup.webp",
    alt: "Live camera view of a switchboard on a weatherboard wall with a conduit run drawn on screen and measured at 0.62 metres",
    caption: "Draw a conduit run on the live camera view and it measures itself.",
    width: 257,
    height: 482,
    toast: { icon: "ruler", title: "0.62m", subtitle: "Conduit run - added to the quote" },
  },
  planMarkup: {
    src: "/product/plan-markup.webp",
    alt: "Floor plan uploaded to Swiftscope with ten numbered downlights placed on it and a running labour and materials total above",
    caption: "Tap downlights onto the plan. The total moves as you place them.",
    width: 600,
    height: 1330,
    toast: { icon: "pin", title: "$282", subtitle: "10 downlights placed on the plan" },
  },
  quoteJobPricing: {
    src: "/product/quote-job-pricing.webp",
    alt: "Swiftscope quote builder job step with customer type set to residential at six percent, job size set to medium at twelve percent, and an effective margin of eighteen percent shown as six plus twelve",
    caption: "Customer type and job size stack into one margin, and it shows its working.",
    width: 706,
    height: 1474,
    toast: { icon: "percent", title: "18% margin", subtitle: "6% customer + 12% job size" },
  },
  scopeConditions: {
    src: "/product/scope-conditions.webp",
    alt: "Swiftscope scope step with roof cavity access set to tight crawl, subfloor to easy crawl, overall site access to moderate, and site condition fees for level 2 connection and switchboard isolation",
    caption: "Tight crawl, moderate access, level 2 connection. The things that blow a job out.",
    width: 714,
    height: 1472,
    toast: { icon: "dollar", title: "$350", subtitle: "Level 2 connection fee, added" },
  },
  quoteSend: {
    src: "/product/quote-send.webp",
    alt: "Swiftscope send step listing on-site items pulled from a package with quantities and prices, a site items total of $1,181, and a job description field with a record option",
    caption: "Priced, itemised and ready to send, with the job description talked in if you prefer.",
    width: 714,
    height: 1474,
    toast: { icon: "check", title: "$1,181", subtitle: "8 downlights, priced and ready" },
  },
  packages: {
    src: "/product/packages.webp",
    alt: "Swiftscope packages list showing a ten downlight install pack, a five downlight quote and a kitchen lighting package, each with item counts, estimated hours and price",
    caption: "The job you quote most often, saved once and reused in a tap.",
    width: 704,
    height: 1472,
    toast: { icon: "package", title: "$1,189", subtitle: "10-downlight pack, 8 hrs, one tap" },
  },
  quoteSentDetail: {
    src: "/product/quote-sent-detail.webp",
    alt: "A sent Swiftscope quote for $829 showing scope and cost, the site conditions considered, labour and materials split, accept and decline actions, and a follow-up overdue by three days",
    caption: "What the client sees, plus a nudge when the follow-up is overdue.",
    width: 712,
    height: 1478,
    toast: { icon: "check", title: "$829", subtitle: "Sent - follow-up overdue 3 days" },
  },
  settingsSiteConditions: {
    src: "/product/settings-site-conditions.webp",
    alt: "Swiftscope settings screen listing per-trade site condition starting fees for electricians, including level 2 connection fees at $350 and main switchboard isolation at $120",
    caption: "Your own starting fees per trade, editable on any quote, never fixed.",
    width: 702,
    height: 1470,
    toast: { icon: "dollar", title: "$350", subtitle: "Starting fee, set once" },
  },
  materials: {
    src: "/product/materials.webp",
    alt: "Swiftscope materials catalogue with 72 items imported by CSV, searched for downlights, each showing cost price and sell price at residential markup",
    caption: "Your supplier price file, searchable, with cost and sell price side by side.",
    width: 646,
    height: 1472,
    toast: { icon: "package", title: "72 items", subtitle: "Imported from one supplier CSV" },
  },
  pricingTiers: {
    src: "/product/pricing-tiers.webp",
    alt: "Customer pricing tiers screen showing four tiers including residential at six percent markup and sub contracting at fifteen percent",
    caption: "A markup per customer type, so builder work is not priced like a homeowner.",
    width: 652,
    height: 1478,
    toast: { icon: "percent", title: "+6%", subtitle: "Residential markup, set once" },
  },
  jobSizeTiers: {
    src: "/product/job-size-tiers.webp",
    alt: "Job size tiers screen showing a small job bracket up to one day at three percent markup and a medium job bracket at twelve percent",
    caption: "Small jobs carry a premium, big ones a discount, without you doing the maths.",
    width: 642,
    height: 1476,
    toast: { icon: "layers", title: "+12%", subtitle: "Medium job bracket" },
  },
  jobDetail: {
    src: "/product/job-detail.webp",
    alt: "Swiftscope job screen showing progress from scheduled to invoiced, tasks, dayworks dockets and a timeline of the quote being accepted and paid",
    caption: "Scheduled, in progress, complete, invoiced, with the whole history underneath.",
    width: 654,
    height: 1475,
    toast: { icon: "check", title: "Paid in full", subtitle: "$8,179 received on this job" },
  },
  docketEntry: {
    src: "/product/docket-entry.webp",
    alt: "Dayworks docket entry form with date, weather, site contact, description of work, labour, plant and equipment, materials and a running docket total",
    caption: "A day's labour, plant and materials logged on site, ready to be signed.",
    width: 708,
    height: 1476,
    toast: { icon: "file", title: "$900", subtitle: "Docket total, logged on site" },
  },
  docketsSigned: {
    src: "/product/dockets-signed.webp",
    alt: "List of dayworks dockets on a job, two sent for signature and two signed by the site contact and marked ready to invoice",
    caption: "Signed on the client's phone, timestamped, and ready to invoice.",
    width: 720,
    height: 1430,
    toast: { icon: "check", title: "Signed", subtitle: "Timestamped, ready to invoice" },
  },
  dayworksRates: {
    src: "/product/dayworks-rates.webp",
    alt: "Dayworks rates screen listing a full day and half day labour rate and an excavator plant rate",
    caption: "Your usual day rates saved once, picked from a list on every docket.",
    width: 646,
    height: 1478,
    toast: { icon: "dollar", title: "$900/day", subtitle: "Full day rate, saved once" },
  },
  xeroExport: {
    src: "/product/xero-export.webp",
    alt: "Export to Xero or MYOB screen listing completed jobs with invoice numbers, amounts and the date each was previously exported",
    caption: "Completed jobs out to Xero or MYOB, with what you already sent marked off.",
    width: 594,
    height: 1330,
    toast: { icon: "refresh", title: "9 exported", subtitle: "Marked off, nothing re-typed" },
  },
  dashboard: {
    src: "/product/dashboard.webp",
    alt: "Swiftscope dashboard showing a quote pipeline of draft, sent, accepted, declined and paid quotes, a profit snapshot and time saved on quoting",
    caption: "What is out, what came back, and what it actually made you.",
    width: 654,
    height: 1481,
    toast: { icon: "trending", title: "$2,139 profit", subtitle: "Tracked automatically across jobs" },
  },
  team: {
    src: "/product/team.webp",
    alt: "Team screen showing the account owner, active member and pending invite counts, and a form to invite a team member by email with a role",
    caption: "Invite the crew by email and set what each of them can see.",
    width: 648,
    height: 1478,
    toast: { icon: "users", title: "Invite by email", subtitle: "Set what each person can see" },
  },
  clients: {
    src: "/product/clients.webp",
    alt: "Client list searched by name, showing a client with two jobs totalling $9,415, their address, last job date and a button to start a new quote",
    caption: "Every client with their job history and total, one tap from a new quote.",
    width: 592,
    height: 1332,
    toast: { icon: "users", title: "$9,415", subtitle: "Two jobs, one client history" },
  },

  // Plumber-specific captures. Real pixels from the plumber builder, not
  // the electrician one -- pipe fittings in the pricebook, a plumbing
  // package, a plumbing quote's actual totals.
  plumberMaterials: {
    src: "/product/plumber-materials.webp",
    alt: "Swiftscope materials catalogue searched for pipe, showing copper pipe and PVC pressure pipe from Reece with cost and sell price",
    caption: "Your plumbing supplier's price list, searchable by item or SKU.",
    width: 718,
    height: 1310,
    toast: { icon: "package", title: "Copper Pipe Type B", subtitle: "$18.50 from Reece" },
  },
  plumberPackages: {
    src: "/product/plumber-packages.webp",
    alt: "Standard Bathroom Reno Package with five items including a toilet, vanity unit and shower base, 32 hours and an estimate of $5,194",
    caption: "A bathroom reno saved once, with labour and materials both included.",
    width: 702,
    height: 1310,
    toast: { icon: "package", title: "$5,194", subtitle: "Bathroom reno, 5 items in one tap" },
  },
  plumberSend: {
    src: "/product/plumber-send.webp",
    alt: "Plumbing quote summary showing 32 hours labour, $2,585 materials, a $5,625 total and payment terms of 100% on completion within 14 days",
    caption: "Priced, totalled, and ready to send with terms already attached.",
    width: 718,
    height: 1307,
    toast: { icon: "check", title: "$5,625", subtitle: "Ready to send, 14-day terms" },
  },

  // Carpenter-specific captures. Real pixels from the carpenter builder --
  // treated pine and decking in the pricebook, a framing package, a
  // carpentry quote's actual totals.
  carpenterMaterials: {
    src: "/product/carpenter-materials.webp",
    alt: "Swiftscope materials catalogue with 51 items, showing treated pine posts and Merbau decking from Bunnings Trade with cost and sell price",
    caption: "Timber, decking and hardware, priced from your supplier's own list.",
    width: 720,
    height: 1306,
    toast: { icon: "package", title: "51 items", subtitle: "Bunnings Trade pricing, synced" },
  },
  carpenterPackages: {
    src: "/product/carpenter-packages.webp",
    alt: "Basic Framing Package with three items including pine studs, steel wall brackets and timber screws, 12 hours and an estimate of $4,024",
    caption: "Standard wall framing saved once, priced correctly every time after.",
    width: 712,
    height: 1314,
    toast: { icon: "package", title: "$4,024", subtitle: "Framing pack, 3 items in one tap" },
  },
  carpenterSend: {
    src: "/product/carpenter-send.webp",
    alt: "Carpentry quote summary showing 12 hours labour, $3,461 materials, a $4,601 total and payment terms of 100% on completion within 14 days",
    caption: "Priced, totalled, and ready to send with terms already attached.",
    width: 716,
    height: 1312,
    toast: { icon: "check", title: "$4,601", subtitle: "Ready to send, 14-day terms" },
  },

  // Roofer-specific captures. Materials and packages show real pixels
  // (Anti-Ponding Board, Barge Capping, a roof maintenance package) even
  // though the trade chip in that same demo account is mistagged
  // "electrician" -- pre-existing account data, not something introduced
  // here, and the captions below describe the items shown rather than
  // repeating the wrong chip. roofingScope is the standout of the batch:
  // the job step with Standard/Premium pricing and the real
  // whirlybird/skylight/gutter extras, which is the direct visual match
  // for "Runs and extras" in this trade's own quotingFlow copy.
  roofingMaterials: {
    src: "/product/roofer-materials.webp",
    alt: "Swiftscope materials catalogue with 25 items, showing an Anti-Ponding Board and Barge Capping in Colorbond with cost and sell price",
    caption: "Roofing supplies priced from your own list, not a generic default.",
    width: 704,
    height: 1306,
    toast: { icon: "package", title: "Anti-Ponding Board", subtitle: "$6.45, roofing supplies" },
  },
  roofingPackages: {
    src: "/product/roofer-packages.webp",
    alt: "Roof Maintenance Package with three items including a roof inspection, roof sealant and roof screws, 4 hours and an estimate of $1,399.60",
    caption: "A routine maintenance call saved once, priced the same every time.",
    width: 706,
    height: 1302,
    toast: { icon: "package", title: "$1,400", subtitle: "Roof maintenance, 3 items in one tap" },
  },
  roofingScope: {
    src: "/product/roofer-scope.webp",
    alt: "Roofer job step with extras including ceiling insulation, gutter replacement, a whirlybird ventilator at $350 each, a roof window or skylight at $1200 each, notes and conditions, and warranty text reading 10-year manufacturer warranty plus 5-year workmanship guarantee",
    caption: "Whirlybirds, skylights, sarking, even the warranty wording -- one screen, not five.",
    width: 708,
    height: 1310,
    toast: { icon: "dollar", title: "$350", subtitle: "Whirlybird ventilator, added in one tap" },
  },

  // Painter and plasterer captures, from the generic builder this trade
  // actually runs on. No materials shot: the one captured alongside these
  // (25 items, Anti-Ponding Board, Barge Capping) is the same roofing
  // catalogue as roofingMaterials above, not painting or plastering
  // items, so it isn't used here -- showing a roofer's supplies on a
  // painting page would be the exact mismatch this registry exists to
  // avoid. packages and send are both genuinely from a plastering job.
  paintingPackages: {
    src: "/product/painter-packages.webp",
    alt: "Basic Plastering and Painting Package with five items including plasterboard, joint compound and fibreglass tape, 12 hours and an estimate of $1,463",
    caption: "A single-room skim and paint, saved once and reused on the next one.",
    width: 708,
    height: 1310,
    toast: { icon: "package", title: "$1,463", subtitle: "Plastering & painting, 5 items in one tap" },
  },
  paintingSend: {
    src: "/product/painter-send.webp",
    alt: "Quote summary showing 12 hours labour, $388 materials and a $1,528 total, with the send step active on a five-step Customer, Quote capture, Job, Scope, Send flow",
    caption: "Margin applied, ready to send, before you leave the walk-through.",
    width: 710,
    height: 1312,
    toast: { icon: "check", title: "$1,528", subtitle: "12h labour, $388 materials" },
  },

  // Fills the two roofer and plumber wizard steps that were still text-only.
  roofingRoofType: {
    src: "/product/roofer-roof-type.webp",
    alt: "Roof type selection showing Colorbond Steel at $28 per square metre, Concrete Tiles at $35, Terracotta at $48, Natural Slate at $75 and Zinc at $65, plus colour and labour rate options",
    caption: "Five roof types, five rates -- not one average guess across all of them.",
    width: 716,
    height: 1310,
    toast: { icon: "dollar", title: "$28/m²", subtitle: "Colorbond, priced on its own rate" },
  },
  plumberScope: {
    src: "/product/plumber-scope.webp",
    alt: "Plumber scope step showing moderate overall site access, a gas compliance certificate required toggle, and site conditions for excavator hire, confined space access and asbestos management",
    caption: "Excavator hire, confined space, asbestos -- priced before they become an argument.",
    width: 708,
    height: 1310,
    toast: { icon: "dollar", title: "$450/day", subtitle: "Excavator hire, added when it's needed" },
  },
  plumberHotWater: {
    src: "/product/plumber-hotwater.webp",
    alt: "Plumber job step showing job type set to fault or leak repair, an hourly rate of $95, a materials margin field, and a hot water unit replacement section",
    caption: "Job type, rate and margin on one screen, hot water handled as its own step.",
    width: 720,
    height: 1308,
    toast: { icon: "dollar", title: "$95/hr", subtitle: "Rate and margin, set per quote" },
  },
} as const;

export type ScreenshotKey = keyof typeof SHOTS;
