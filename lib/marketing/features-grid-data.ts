import { MapPin, Briefcase, Smartphone, PenTool, DollarSign, RefreshCw, LucideIcon } from "lucide-react";

export type FeatureCardType = "replace" | "integrate";

export interface WorkflowStep {
  step: number;
  title: string;
  body: string;
}

export interface FeatureGridItem {
  slug: string;
  icon: LucideIcon;
  type: FeatureCardType;
  replaces: string;
  label: string;
  note: string;
  image: string;
  imageAlt: string;
  heroImage?: string;
  heroImageAlt?: string;
  heroTitle: string;
  heroSubtitle: string;
  valueStatement: string;
  replacesReason: string;
  quickStats: string[];
  intro: string[];
  bullets: string[];
  workflow: WorkflowStep[];
  whySwiftscope: string[];
  competitorCostLabel?: string;
  competitorCost?: string;
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
    valueStatement: "Every homeowner lead in your service area, claimable the moment it lands. No bidding war, no waiting to see if it is worth your time.",
    replacesReason: "HiPages charges $30-150 every time you claim a lead. Swiftscope doesn't charge you a cent extra for a single one.",
    quickStats: ["No auction", "No credits system", "Unlimited claims"],
    intro: [
      "Homeowner quote requests are included in your flat monthly plan. **No auction, no credits system that runs out right when work is slow.** Directories like HiPages sell you leads one at a time, forcing you to bid against other tradies for the same job.",
      "The problem with the auction model isn't just cost. It's psychology. You're spending money before you've done any work, which means you're already under pressure to win the job at a price that might not stack up. **Swiftscope removes that pressure entirely.** You see the lead, you decide if it suits you, you claim it, and you quote it.",
      "Claimed leads drop straight into your pipeline next to your other jobs, so you're not juggling a separate app just to chase new work. The whole process -- from homeowner posting the job to you sending a quote -- can happen in under ten minutes.",
    ],
    workflow: [
      { step: 1, title: "Homeowner posts a job", body: "A homeowner in your service area submits what they need done, their budget range, and when they want it. You get notified immediately." },
      { step: 2, title: "You review and claim it", body: "Read the job details, see the suburb and rough budget, then claim it with one tap. No credits deducted. No competing bid to worry about." },
      { step: 3, title: "Lead enters your pipeline", body: "The claimed lead appears in your jobs board. Contact the homeowner directly to arrange a site visit or send a quote right from the app." },
      { step: 4, title: "Quote on site, win the job", body: "Use Swiftscope's mobile quote builder to send a professional quote before you leave the driveway. Homeowners who get same-day quotes accept them at much higher rates." },
    ],
    whySwiftscope: [
      "HiPages, Oneflare and Airtasker all run the same auction model -- your cost per job won goes up as more tradies join, and the leads get diluted. Swiftscope's model is different because leads are a feature of the platform, not a product being sold separately.",
      "Because you're already paying a flat monthly fee, every lead you claim is free. A tradie who claims ten leads a month is paying the same as one who claims one. That changes how you think about lead volume -- you go wider, you respond faster, and you win more without spending more.",
      "The other thing worth knowing: homeowners who come through Swiftscope's directory are already past the browsing stage. They've found your profile, read your reviews and ratings, and decided to ask you specifically. That's a warmer lead than an anonymous job post on a general marketplace.",
    ],
    bullets: [
      "No per-lead auction or bidding against other tradies",
      "No credits system that runs out at the worst time",
      "Unlimited claims included in your flat monthly plan",
      "Claimed leads flow straight into your existing job pipeline",
      "Homeowners contact you directly, not through a broker",
      "Works alongside your existing referral and repeat business",
    ],
    competitorCostLabel: "HiPages lead credits",
    competitorCost: "$80-300/month",
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
    valueStatement: "One board that carries a job from first quote to final invoice, so nothing gets lost between apps or forgotten in a notebook on the dash.",
    replacesReason: "Fergus and Tradify are priced and built for bigger operations. This is scoped for a crew your size, at a fraction of the cost.",
    quickStats: ["One board, not five apps", "No per-seat pricing", "Built for 1-15 crews"],
    intro: [
      "Most trade businesses are running five or six tools at once. A quoting app, a job tracker, a scheduling calendar, a group chat, and a notes app on someone's phone that only that person can read. **Each handoff between tools is a place where things fall through the gap.**",
      "Swiftscope covers everything that matters for a 1-15 person crew -- quoting, job tracking, scheduling, variations and job costing -- **without the enterprise-scale complexity** that platforms like Fergus and Tradify are built for, and priced for.",
      "A job moves from quote to scheduled to in-progress to invoiced, all visible on one board, on your phone. **The site notes your apprentice added this morning are visible to you on the way to the job.** The variation the client signed off on site is already in the invoice by the time you get home.",
    ],
    workflow: [
      { step: 1, title: "Quote is created and sent", body: "Build a trade-specific quote on site from your phone. Material costs and labour hours calculate live. Client receives it via email with a one-tap accept button." },
      { step: 2, title: "Accepted quote becomes a job", body: "When the client accepts, a job is created automatically with the quote details, client info, and site address already filled in. Schedule it in two taps." },
      { step: 3, title: "Job runs in real time", body: "Team members log hours, add site photos, raise variations and flag issues from their phones. You see everything as it happens, from anywhere." },
      { step: 4, title: "Variations are signed and tracked", body: "Any extra work is raised as a variation before it starts. The client approves it from their phone. The variation amount adds to the invoice automatically." },
      { step: 5, title: "Invoice and close out", body: "When the job wraps, the invoice is ready. Push it to Xero with one tap. Mark it paid when it clears and see your real margin on the job." },
    ],
    whySwiftscope: [
      "Fergus and ServiceM8 are genuinely good platforms, but they're built for larger operations and priced accordingly. A sole trader or a small crew ends up paying for features they'll never use while fighting a UI designed for a business three times their size.",
      "Swiftscope is built specifically for the 1-15 person trade business. That means fewer screens, faster flows, and a mobile-first design that assumes you're on a building site with work gloves half-on, not at a desk in an office.",
      "There's no per-seat pricing. Adding an apprentice or a second team doesn't change your monthly bill. That's a deliberate decision -- we think trade businesses should be able to grow without their software costs growing faster than their revenue.",
    ],
    bullets: [
      "Quotes, jobs, scheduling and invoicing in a single board",
      "Team members update jobs from the field in real time",
      "Variations raised and signed off before extra work starts",
      "Built for 1-15 person crews, not enterprise job management",
      "No per-seat pricing as your team grows",
      "Schedule view shows your full week and upcoming deadlines",
    ],
    competitorCostLabel: "Fergus or ServiceM8",
    competitorCost: "$40-130/month",
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
    valueStatement: "Build and send a proper quote before you have even packed the ute back up. Numbers calculated live, in fields built for your trade, not a generic form.",
    replacesReason: "ServiceM8 charges per user, per month, for mobile quoting alone. It's built into Swiftscope's flat plan from day one.",
    quickStats: ["Trade-specific fields", "Numbers calculate live", "Sent before you drive off"],
    intro: [
      "The gap between finishing a site visit and sending a quote is where most tradies lose jobs. The client liked you. They're ready to book. Then three days pass, a competitor calls them first, and the job is gone. **Swiftscope closes that gap by making it possible to quote on site, in the time it takes to walk back to your ute.**",
      "The quote builder is trade-specific. An electrician sees circuit and switchboard fields. A plumber sees fixture and pipe-run fields. A carpenter sees framing and joinery fields. **You're not translating your job into someone else's generic form.** The fields match the way you actually think about and price the work.",
      "Materials are pulled from your own price book -- the rates you've negotiated with your suppliers, not a generic rate card someone else decided for you. Labour hours, materials, and margin **calculate live as you fill the quote in**. By the time you're walking back to the car, the quote is drafted, reviewed, and sent.",
    ],
    workflow: [
      { step: 1, title: "Open the quote builder on site", body: "Open Swiftscope from your phone while you're still on the job. No laptop, no going back to the office, no taking notes to enter later." },
      { step: 2, title: "Fill trade-specific fields", body: "Select your trade and fill in the relevant fields. For an electrician that's circuits, switchboards, cabling and fixtures. Labour and materials calculate automatically in the background." },
      { step: 3, title: "Annotate a drawing or capture on camera", body: "If the client has plans, upload them and mark items directly on the drawing. Or use the live camera tool to annotate on-site and add items from what you see in front of you." },
      { step: 4, title: "Review the total and adjust margin", body: "See the full quote breakdown before sending. Adjust margin, add a site-specific note, and check the line items look right. Takes about 30 seconds." },
      { step: 5, title: "Send and track acceptance", body: "The client receives a professional quote by email with a one-tap accept button. You get notified the moment they accept. Follow-up reminders fire if they don't respond." },
    ],
    whySwiftscope: [
      "The research is clear: trade businesses that quote on the day of the site visit have significantly higher acceptance rates than those that send quotes days later. The reason is simple. The client's problem is still fresh, their urgency is still high, and they haven't had time to talk themselves out of it or call someone else.",
      "Most quoting apps treat mobile as an afterthought -- a stripped-down version of the desktop tool that lets you do the basics but not the full job. Swiftscope was built mobile-first, which means the full quote builder, the drawing markup, the price book and the send flow all work on a phone screen, standing in a client's driveway.",
      "Voice quoting is also available. Describe the work out loud while you walk a site and Swiftscope generates a structured quote from the transcript. Useful when you're on site in loud conditions, or for tradies who find typing on a phone screen slow.",
    ],
    bullets: [
      "Trade-specific fields for electricians, plumbers, carpenters, roofers and more",
      "Numbers calculate live as you build the quote",
      "Materials pulled from your own price book, not a generic rate card",
      "Voice quoting available -- describe the job out loud",
      "Send a professional quote from your phone on-site",
      "Automatic follow-up reminders if the client doesn't respond",
    ],
    competitorCostLabel: "ServiceM8",
    competitorCost: "$48-62/user/month",
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
    valueStatement: "Turn a floor plan into a priced quote by working through it once. No separate takeoff step, no re-keying numbers into a different tool.",
    replacesReason: "GroundPlan is a $60-100/month add-on bolted onto other platforms. Drawing markup is native to Swiftscope, at no extra cost.",
    quickStats: ["Click to count items", "Costs auto-link to quote", "No separate takeoff tool"],
    intro: [
      "Reading a set of plans and counting up materials has traditionally been a desk job -- something you do back at the office, after the site visit, in a separate tool that doesn't connect to your quoting software. The numbers get written down, transferred, cross-checked, and re-entered. **Every step is another chance for an error or a missed item.**",
      "Swiftscope's drawing markup works differently. Upload any floor plan or site drawing -- a PDF, an image from your email, a photo of a hand-drawn sketch -- and click to mark items directly on it. Each click adds a priced line item to your quote in the background. **By the time you've worked through the plan, the quote is already built.**",
      "It's designed for a tradie quoting a house or a small commercial fit-out, not an estimator running takeoff on a multi-storey tower. The AI can also read a plan and pre-fill counts automatically, which you then review and confirm rather than building from scratch.",
    ],
    workflow: [
      { step: 1, title: "Upload the drawing", body: "Drop any floor plan, site plan, or drawing into Swiftscope. PDF, image, or photo of a printed plan all work. You can upload from email, camera roll, or directly from a file." },
      { step: 2, title: "Set your scale", body: "Tap two known points on the drawing and enter the real-world distance between them. Swiftscope calibrates the scale so line measurements reflect actual distances." },
      { step: 3, title: "Mark items on the plan", body: "Tap to place a point for each fixture, GPO, or fitting. Drag a line for cable runs, pipe routes, or conduit. Each item is priced from your price book as you place it." },
      { step: 4, title: "AI pre-read (optional)", body: "Let Swiftscope's AI read the drawing first and suggest item counts. You review the suggestions, adjust quantities, and confirm. Faster than counting from scratch on a dense plan." },
      { step: 5, title: "Costs flow straight to the quote", body: "Every marked item is already in your quote total. No export, no copy-paste, no re-entry. Review the breakdown, adjust margin if needed, and send." },
    ],
    whySwiftscope: [
      "GroundPlan is a purpose-built takeoff tool and it's excellent at what it does -- for a large estimating team running commercial jobs. For a residential or small commercial tradie quoting from their phone on a Tuesday morning, it's overkill and an extra $60-100 per month on top of everything else.",
      "Swiftscope's drawing markup isn't trying to replicate GroundPlan feature-for-feature. It's trying to answer a specific question: how does a tradie go from receiving a set of plans to sending a quote without going back to a desk? The answer is a markup tool that's fast, mobile-friendly, and connected directly to the quote builder and price book.",
      "The live camera annotation tool is also worth mentioning here. When there are no plans -- a knockdown rebuild quote, a renovation with no drawings, a job where the plans are wrong -- you annotate directly on live camera footage of the site. Same outcome, different starting point.",
    ],
    bullets: [
      "Upload any site plan or floor plan image -- PDF, image or photo",
      "Click to mark fixtures, fittings and cable or pipe routes",
      "Scale calibration for accurate linear measurements",
      "AI can pre-read a plan and suggest item counts for review",
      "Costs link directly to the quote with no manual re-entry",
      "Pulls pricing from your own price book, not a generic rate card",
    ],
    competitorCostLabel: "GroundPlan",
    competitorCost: "$60-100/month",
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
    valueStatement: "See exactly what a job earned the moment it wraps up, not months later when the annual numbers don't quite add up.",
    replacesReason: "SimPro sells job costing as a premium add-on, priced per user. It's part of the base Swiftscope plan, no upsell required.",
    quickStats: ["Actual vs quoted", "Real margin per job", "No implementation project"],
    intro: [
      "Most trade businesses find out whether a job made money weeks or months after the fact, when the invoice is paid, the accounts are reconciled, and someone works backwards through what actually happened. **By then, the pattern that's eating your margin has already repeated itself six more times.**",
      "Job costing in Swiftscope tracks actual labour hours and materials used against what was quoted, in real time as the job runs. Your team logs hours from their phones. Materials used are recorded against the job. **At the end, you see the actual margin on that specific job, not an average across everything you've done this quarter.**",
      "That granularity matters. It lets you see that your bathroom renovation quotes are consistently running over by 15% in labour, or that a specific supplier's materials pricing is killing your margin on a certain job type. **You can't fix what you can't see**, and right now most tradies can't see it until the damage is done.",
    ],
    workflow: [
      { step: 1, title: "Quote is built with your rates", body: "Every quote is built from your own price book -- your negotiated supplier rates and your hourly rate. That quote becomes the baseline the actual job is measured against." },
      { step: 2, title: "Team logs hours from the field", body: "Team members log start and finish times from their phones as the job runs. No paper timesheets, no end-of-week catch-up. Hours are attributed to the correct job automatically." },
      { step: 3, title: "Materials used are recorded", body: "As materials are consumed on the job, they're recorded in the app. If something was ordered that wasn't in the original quote, it's flagged as a variation or absorbed into costs." },
      { step: 4, title: "Variation costs are tracked separately", body: "Any approved variations are tracked as add-ons to the original quote. You can see margin on the base job and margin including variations side by side." },
      { step: 5, title: "Job closes, margin is visible", body: "When the job is marked complete, the actual vs quoted comparison is ready. Labour variance, materials variance, and final margin are all visible in one view." },
    ],
    whySwiftscope: [
      "SimPro is a comprehensive platform and job costing is one of its genuinely strong features. But it's enterprise software with an enterprise implementation overhead -- it typically takes weeks to set up, costs significantly more per user, and has a learning curve that assumes you have someone whose job is to manage the software.",
      "Swiftscope's job costing is scoped for a sole trader or small crew who wants to know whether their jobs are making money without a training course or a dedicated admin person. The setup is the same as signing up -- your price book is your price book, your team logs hours, and the reports are just there.",
      "The other thing worth noting is the price book integration. Because your quotes are built from your actual supplier prices and your actual hourly rate, the comparison between quoted and actual is genuinely meaningful. You're not comparing against a generic industry rate -- you're comparing against your own numbers.",
    ],
    bullets: [
      "Actual hours tracked against quoted labour from day one",
      "Materials used recorded and compared against what was quoted",
      "Real margin visible on every individual job",
      "Spot patterns -- which job types or clients run over consistently",
      "Variations tracked separately from the base job cost",
      "No lengthy setup or implementation project required",
    ],
    competitorCostLabel: "SimPro's job costing add-on",
    competitorCost: "$75+/user/month",
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
    valueStatement: "An accepted quote becomes an invoice in Xero automatically, so your books match what actually happened on site without you touching a keyboard twice.",
    replacesReason: "Every competitor offers some form of Xero sync. Swiftscope's is a live OAuth connection, included in the base plan, not a higher tier.",
    quickStats: ["Live OAuth sync", "No CSV re-entry", "Included, not an add-on"],
    intro: [
      "The double-entry problem is one of the biggest time wasters in a trade business. A job is quoted in one tool, tracked in another, and then the invoice is manually created in Xero from what was quoted -- or what someone thinks was quoted, because the variation got added on a sticky note. **Every time data moves from one system to another by hand, something goes wrong.**",
      "Swiftscope connects to Xero via a live OAuth connection. When a client accepts a quote, the invoice pushes to Xero automatically -- line items, amounts, client details, job reference. **The numbers your bookkeeper sees are the numbers from the field, with nothing lost or changed in between.**",
      "It works the other way too. Payment status in Xero updates job status in Swiftscope, so your jobs board reflects which invoices have actually been paid without you having to check both systems.",
    ],
    workflow: [
      { step: 1, title: "Connect Xero once", body: "Go to Settings and connect your Xero account via OAuth. Takes about 60 seconds. Your chart of accounts and tax settings are pulled in automatically." },
      { step: 2, title: "Quote is accepted by the client", body: "When the client taps Accept on their quote, Swiftscope creates the job and queues the invoice for Xero." },
      { step: 3, title: "Invoice pushes to Xero automatically", body: "The invoice appears in Xero with the correct line items, amounts, client details and job reference. No manual entry, no copy-paste, no formatting." },
      { step: 4, title: "Variations sync as they are approved", body: "Approved variations update the invoice in Xero automatically. The final invoice always reflects what was actually agreed, not just what was in the original quote." },
      { step: 5, title: "Payment status flows back", body: "When an invoice is marked paid in Xero, the job status in Swiftscope updates. Your bookkeeper works in Xero, you work in Swiftscope, and both stay in sync." },
    ],
    whySwiftscope: [
      "Every major field service platform has some form of Xero sync. The difference is usually in how it's structured and what it costs to turn on. Tradify and Fergus both offer Xero integration, but on higher-tier plans. Swiftscope includes it on the base plan because it shouldn't be a premium feature -- it's basic accounting hygiene.",
      "The OAuth connection also matters more than it sounds. A CSV export that you drag into Xero once a week works, but it creates a one-week lag in your books, introduces the risk of forgetting, and breaks if the format changes. A live connection means your books are always current, which matters when you're checking cashflow or preparing for a BAS lodgement.",
      "For tradies who use an accountant or bookkeeper, this feature often pays for itself in reduced hours. Your accountant spends less time reconciling discrepancies between what's in Xero and what's in your job management tool, because there are no discrepancies.",
    ],
    bullets: [
      "Live OAuth sync with Xero, not a manual CSV export",
      "Accepted quotes push through as invoices automatically",
      "No double entry, no mismatched numbers between systems",
      "Variations sync to the invoice as they are approved",
      "Payment status in Xero updates job status in Swiftscope",
      "Included in the base plan, not a paid add-on",
    ],
  },
];

export function getFeatureBySlug(slug: string) {
  return FEATURES_GRID.find((f) => f.slug === slug);
}
