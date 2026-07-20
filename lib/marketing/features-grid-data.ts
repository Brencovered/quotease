import { MapPin, Briefcase, Smartphone, PenTool, DollarSign, RefreshCw, LucideIcon } from "lucide-react";

export type FeatureCardType = "replace" | "integrate";

export interface FeatureGridItem {
  slug: string;
  icon: LucideIcon;
  type: FeatureCardType;
  replaces: string;
  label: string;
  note: string;
  image: string;
  imageAlt: string;
  /** Optional separate image for the detail-page hero. Falls back to `image`/`imageAlt` if omitted. */
  heroImage?: string;
  heroImageAlt?: string;
  /** Detail page content */
  heroTitle: string;
  heroSubtitle: string;
  /** One-line direct comparison shown prominently in the hero, under the subtitle */
  replacesReason: string;
  /** 3 short (2-4 word) chips shown in the hero to fill the space and reinforce value at a glance */
  quickStats: string[];
  intro: string[];
  bullets: string[];
  costLabel?: string;
}

export const FEATURES_GRID: FeatureGridItem[] = [
  {
    slug: "lead-generation",
    icon: MapPin,
    type: "replace",
    replaces: "HiPages",
    label: "Lead generation",
    note: "Homeowner quote requests included with your plan. No per-lead auction. No credits system.",
    image: "/marketing/lead-generation-leads.png",
    imageAlt: "Swiftscope Leads screen showing claimed homeowner leads with stage, budget and timeframe",
    heroTitle: "Win local leads without the auction",
    heroSubtitle: "Homeowner quote requests, included with your plan",
    replacesReason: "HiPages charges $30-150 every time you claim a lead. Swiftscope doesn't charge you a cent extra for a single one.",
    quickStats: ["No auction", "No credits system", "Unlimited claims"],
    intro: [
      "HiPages and similar directories sell you leads one at a time, in an auction against other tradies, with a credits system that runs out right when work is slow. Swiftscope includes homeowner quote requests in your flat monthly plan instead.",
      "Homeowners in your service area post the job they need done. You claim the ones that fit your trade and availability, at no extra cost per lead. There's no bidding, no credits to top up, and no cap on how many you can claim in a month.",
      "Claimed leads drop straight into your pipeline next to your other jobs, so you're not juggling a separate app just to chase new work.",
    ],
    bullets: [
      "No per-lead auction or bidding against other tradies",
      "No credits system that runs out at the worst time",
      "Unlimited claims included in your flat monthly plan",
      "Claimed leads flow straight into your existing job pipeline",
    ],
    costLabel: "HiPages lead credits typically run $80-300/month",
  },
  {
    slug: "job-management",
    icon: Briefcase,
    type: "replace",
    replaces: "Fergus / Tradify",
    label: "Job management",
    note: "Quotes, jobs, scheduling, variations, job costing. All in one place, all on your phone.",
    image: "/marketing/job-management-schedule.png",
    imageAlt: "Swiftscope Schedule screen showing a month calendar of jobs and follow-ups",
    heroImage: "/marketing/job-management-jobslist.png",
    heroImageAlt: "Swiftscope Jobs screen showing job value, amount still owing, estimated profit, and active jobs in progress",
    heroTitle: "Everything about a job, in one place",
    heroSubtitle: "Quotes, jobs, scheduling, variations and costing together",
    replacesReason: "Fergus and Tradify are priced and built for bigger operations. This is scoped for a crew your size, at a fraction of the cost.",
    quickStats: ["One board, not five apps", "No per-seat pricing", "Built for 1-15 crews"],
    intro: [
      "Fergus and Tradify built full job management platforms - and most small trade businesses only end up using a third of what they pay for. Swiftscope covers the parts that actually matter for a 1-15 person crew: quoting, job tracking, scheduling, variations and job costing, without the enterprise-scale complexity.",
      "A job moves from quote to scheduled to in-progress to invoiced, all visible on one board, on your phone, without switching between five different screens.",
      "Because it's built for small crews specifically, there's no per-seat pricing creep as you add an apprentice or a second team member.",
    ],
    bullets: [
      "Quotes, jobs, scheduling and invoicing in a single board",
      "Variations raised and signed off in one tap, before extra work starts",
      "Built for 1-15 person crews, not enterprise job management",
      "No per-seat pricing as your team grows",
    ],
    costLabel: "Fergus or ServiceM8 typically run $40-130/month",
  },
  {
    slug: "mobile-quoting",
    icon: Smartphone,
    type: "replace",
    replaces: "ServiceM8",
    label: "Mobile quoting",
    note: "Trade-specific quote builder on your phone. Send the quote before you leave the driveway.",
    image: "/marketing/mobile-quoting-quote-builder.png",
    imageAlt: "Swiftscope quote builder screen showing labour, materials and on-site items, with two tradies reviewing it on site",
    heroImage: "/marketing/mobile-quoting-quotes-list.png",
    heroImageAlt: "Swiftscope Quotes screen showing follow-up reminders and quote statuses",
    heroTitle: "Quote before you leave the driveway",
    heroSubtitle: "A trade-specific quote builder that lives on your phone",
    replacesReason: "ServiceM8 charges per user, per month, for mobile quoting alone. It's built into Swiftscope's flat plan from day one.",
    quickStats: ["Trade-specific fields", "Numbers calculate live", "Sent before you drive off"],
    intro: [
      "Generic quoting apps ask for generic fields. Swiftscope's quote builder is trade-specific - an electrician sees circuit and switchboard fields, a plumber sees fixture and pipe-run fields, a carpenter sees framing and joinery fields - so you're not translating your job into someone else's template.",
      "Numbers calculate live as you fill the quote in: labour hours, materials pulled from your own price book, margin, total. By the time you're back in the car, the quote is already sent.",
      "Homeowners who get a quote on the spot, while you're still standing in front of them, are far more likely to accept it than one that arrives three days later after they've called two other tradies.",
    ],
    bullets: [
      "Trade-specific fields for electricians, plumbers, carpenters, roofers and generic trades",
      "Numbers calculate live as you build the quote",
      "Send a professional quote from your phone on-site",
      "Faster quotes mean higher acceptance rates",
    ],
    costLabel: "ServiceM8 typically runs $48-62/user/month",
  },
  {
    slug: "drawing-markup",
    icon: PenTool,
    type: "replace",
    replaces: "GroundPlan",
    label: "Drawing markup",
    note: "Upload site plans, draw cable runs or pipe routes, count items. Costs link to your quote.",
    image: "/marketing/drawing-markup-floorplan.png",
    imageAlt: "Swiftscope drawing markup screen showing numbered downlight points placed on a floor plan",
    heroTitle: "Mark up a plan, get a priced quote",
    heroSubtitle: "Upload a drawing, click to count items, costs flow straight through",
    replacesReason: "GroundPlan is a $60-100/month add-on bolted onto other platforms. Drawing markup is native to Swiftscope, at no extra cost.",
    quickStats: ["Click to count items", "Costs auto-link to quote", "No separate takeoff tool"],
    intro: [
      "Takeoff tools like GroundPlan are built for estimators on large commercial jobs. Swiftscope's drawing markup is built for a tradie quoting a house: upload a floor plan, click to mark downlights, GPOs, switchboards, cable runs or pipe routes, and each click adds a priced item to the quote in the background.",
      "There's no separate export-then-re-enter step. The costs you generate on the plan are the same costs that show up in the quote total, sourced from your own price book.",
      "For jobs where a full plan isn't available, the same click-to-count approach works live on a phone camera on site - see Live Site Markup.",
    ],
    bullets: [
      "Upload any site plan or floor plan image",
      "Click to mark cable runs, pipe routes, fixtures and points",
      "Costs link directly to the quote - no manual re-entry",
      "Pulls pricing from your own price book, not a generic rate card",
    ],
    costLabel: "GroundPlan typically runs $60-100/month",
  },
  {
    slug: "job-costing",
    icon: DollarSign,
    type: "replace",
    replaces: "SimPro",
    label: "Job costing",
    note: "Track actual hours and materials against what you quoted. Know your real margin on every job.",
    image: "/marketing/job-costing-materials.png",
    imageAlt: "Swiftscope Materials screen showing the pricing catalog with search and supplier filters",
    heroImage: "/marketing/job-costing-packages.png",
    heroImageAlt: "Swiftscope Packages screen showing reusable priced quote templates",
    heroTitle: "Know your real margin on every job",
    heroSubtitle: "Actual hours and materials, tracked against what you quoted",
    replacesReason: "SimPro sells job costing as a premium add-on, priced per user. It's part of the base Swiftscope plan, no upsell required.",
    quickStats: ["Actual vs quoted", "Real margin per job", "No implementation project"],
    intro: [
      "Most tradies find out whether a job made money weeks later, if at all, once the invoice is paid and the dust has settled. Job costing in Swiftscope tracks actual labour hours and materials used against what was quoted, in real time as the job runs.",
      "That means you see - job by job - where a quote held up and where it didn't, instead of guessing at the end of the year why margins felt tighter than expected.",
      "SimPro and other enterprise platforms offer this too, at a level of depth built for much larger operations. Swiftscope's version is scoped for a 1-15 person crew that wants the answer without the setup overhead.",
    ],
    bullets: [
      "Actual hours and materials tracked against the original quote",
      "See real margin on every job, not just at tax time",
      "Spot which jobs or job types are undercutting your margin",
      "No lengthy setup or implementation project required",
    ],
    costLabel: "SimPro's job costing add-on typically runs $75+/user/month",
  },
  {
    slug: "xero-sync",
    icon: RefreshCw,
    type: "integrate",
    replaces: "Xero",
    label: "Xero live sync",
    note: "Swiftscope integrates with Xero. Accepted quotes push as invoices automatically - no double entry.",
    image: "/marketing/xero-sync-export.png",
    imageAlt: "Swiftscope Export to Xero / MYOB screen showing job export filters and a list of exported invoices",
    heroTitle: "Your books, sorted without re-typing anything",
    heroSubtitle: "Accepted quotes push straight into Xero as invoices",
    replacesReason: "Every competitor offers some form of Xero sync. Swiftscope's is a live OAuth connection, included in the base plan, not a higher tier.",
    quickStats: ["Live OAuth sync", "No CSV re-entry", "Included, not an add-on"],
    intro: [
      "Swiftscope connects to Xero via a live OAuth sync, not a CSV you export and re-import by hand. When a client accepts a quote and it becomes a job, the invoice pushes through to Xero automatically.",
      "That means the numbers your bookkeeper or accountant sees match what's actually in the field, without a second round of manual data entry that introduces typos and mismatches.",
      "It's included in the base Swiftscope plan - there's no separate integration fee or higher tier required to turn it on.",
    ],
    bullets: [
      "Live OAuth sync with Xero, not a manual CSV export",
      "Accepted quotes push through as invoices automatically",
      "No double entry, no mismatched numbers between systems",
      "Included in the base plan, not a paid add-on",
    ],
  },
];

export function getFeatureBySlug(slug: string) {
  return FEATURES_GRID.find((f) => f.slug === slug);
}
