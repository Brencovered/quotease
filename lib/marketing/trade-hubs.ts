/**
 * Marketing hubs for every product trade in ALL_TRADES (13).
 * URLs use plural SEO slugs: /for/electricians, /for/air-conditioning, etc.
 */

import { ALL_TRADES } from "@/lib/genericTrades";
import { tradeToSlug } from "@/lib/seo/meta";

export type TradeHubFaq = { question: string; answer: string };

export type TradeHub = {
  key: string;
  slug: string;
  label: string;
  plural: string;
  dedicated: boolean;
  /** Short SEO title fragment */
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subhead: string;
  pain: string;
  outcomes: string[];
  jobTypes: string[];
  quoteFields: string[];
  faqs: TradeHubFaq[];
};

const PLURAL_LABEL: Record<string, string> = {
  electrician: "electricians",
  plumber: "plumbers",
  carpenter: "carpenters",
  roofer: "roofers",
  painter: "painters",
  tiler: "tilers",
  landscaper: "landscapers",
  arborist: "arborists",
  concreter: "concreters",
  fencer: "fencers",
  aircon: "air conditioning techs",
  surveyor: "surveyors",
  custom: "specialist trades",
};

const HUB_SLUG_OVERRIDE: Record<string, string> = {
  custom: "other-trades",
};

type HubCopy = Omit<TradeHub, "key" | "slug" | "label" | "plural" | "dedicated">;

const COPY: Record<string, HubCopy> = {
  electrician: {
    metaTitle: "Quoting software for electricians",
    metaDescription:
      "Build and send electrical quotes on site. Downlights, circuits, switchboards, and cable runs priced from your book before you leave the driveway.",
    headline: "Quote the electrical job before you leave site.",
    subhead:
      "Tap fixtures on a plan, draw the run, load materials and labour from your price book, and send a clean quote from your phone.",
    pain: "Most electricians still scribble counts on the plan, retype them at the desk, then chase the PDF. By then the client has already taken another call.",
    outcomes: [
      "Count downlights, GPOs, and switches on the plan",
      "Price cable runs and switchboard work from your book",
      "Send the quote while you are still on site",
      "Accepted work becomes a job with schedule and materials",
    ],
    jobTypes: [
      "New house rough-in",
      "Downlight upgrades",
      "Switchboard upgrades",
      "EV charger installs",
      "Renovations and fit-outs",
      "Smoke alarm compliance",
    ],
    quoteFields: ["Circuits", "Switchboards", "Cabling", "Fixtures", "Labour hours", "Margin"],
    faqs: [
      {
        question: "Can I quote from a floor plan on my phone?",
        answer:
          "Yes. Upload the plan, tap points for fixtures, draw cable runs, and costs flow into the quote from your price book.",
      },
      {
        question: "Does it handle COES and compliance notes?",
        answer:
          "You can attach notes and line items for compliance work on the quote. Keep your own COES process; Swiftscope keeps the priced scope with the job.",
      },
      {
        question: "Is it built for solo sparkies or crews?",
        answer:
          "Both. Solo operators through crews up to about 15. Not a site office system for 200.",
      },
    ],
  },
  plumber: {
    metaTitle: "Quoting software for plumbers",
    metaDescription:
      "Price plumbing jobs on site. Fixtures, pipe runs, and labour from your book, sent before you leave the driveway.",
    headline: "Price the plumbing job while you are still on site.",
    subhead:
      "Fixture counts, pipe runs, and labour load from your book. Send the quote from your phone, not from memory at the desk later.",
    pain: "Bathroom and rough-in quotes die in the gap between the site visit and the PDF. Swiftscope closes that gap.",
    outcomes: [
      "Mark fixtures and pipe routes on plans or photos",
      "Pull fittings and labour from your price book",
      "Send a client-ready quote the same visit",
      "Win accepted jobs straight onto your board",
    ],
    jobTypes: [
      "Bathroom renovations",
      "Hot water upgrades",
      "New home rough-in",
      "Kitchen plumbing",
      "Blocked drains and repairs",
      "Gas fitting jobs",
    ],
    quoteFields: ["Fixtures", "Pipe runs", "Fittings", "Labour hours", "Call-out", "Margin"],
    faqs: [
      {
        question: "Can I quote bathroom renos from photos?",
        answer:
          "Yes. Capture the space on camera or mark a plan, then price fixtures and labour from your book before you leave.",
      },
      {
        question: "Does it replace my supplier price lists?",
        answer:
          "No. You load your own negotiated rates. Swiftscope uses your book, not a generic rate card.",
      },
      {
        question: "Will clients accept quotes on their phone?",
        answer:
          "They open a clean portal, tap accept, and the job lands on your board. No PDF chase.",
      },
    ],
  },
  carpenter: {
    metaTitle: "Quoting software for carpenters",
    metaDescription:
      "Quote carpentry and joinery on site. Framing, doors, timber runs, and labour priced from your book and sent the same visit.",
    headline: "Scope framing and joinery without the desk rewrite.",
    subhead:
      "Measure once on site, price timber and labour from your book, and send the quote before you pack the ute.",
    pain: "Carpentry quotes often wait until you are back at the shed. That delay is where jobs leak to the next caller.",
    outcomes: [
      "Build quotes around framing, doors, and timber runs",
      "Keep fixings and labour allowances in your book",
      "Send from site with a clear scope the client can accept",
      "Turn accepted quotes into scheduled jobs",
    ],
    jobTypes: [
      "Framing packages",
      "Door and window installs",
      "Decks and pergolas",
      "Built-in joinery",
      "Renovations",
      "Site measure and fit-off",
    ],
    quoteFields: ["Timber runs", "Doors", "Fixings", "Labour hours", "Waste factor", "Margin"],
    faqs: [
      {
        question: "Can I price a deck or framing package on site?",
        answer:
          "Yes. Use trade fields and your materials book so lengths, fixings, and labour calculate while you are still there.",
      },
      {
        question: "What about custom joinery?",
        answer:
          "Add line items and notes for bespoke work. Your book stays the source of truth for repeatable rates.",
      },
      {
        question: "Is this only for residential?",
        answer:
          "It is built for residential and small commercial crews, not large estimating offices.",
      },
    ],
  },
  roofer: {
    metaTitle: "Quoting software for roofers",
    metaDescription:
      "Quote roofing jobs on site. Areas, materials, labour, and extras from your book, sent before you leave the driveway.",
    headline: "Quote the roof while you can still see it.",
    subhead:
      "Capture the scope on site, price materials and labour from your book, and send before the client has called someone else.",
    pain: "Roof quotes often wait on photos, square metres, and a desk rebuild. By then you are quoting cold.",
    outcomes: [
      "Scope metal, tile, or membrane work on site",
      "Price sheets, battens, flashings, and labour from your book",
      "Send a clear quote the same visit",
      "Manage accepted jobs from your phone",
    ],
    jobTypes: [
      "Metal roof replacements",
      "Tile repairs",
      "Re-roof packages",
      "Gutter and fascia",
      "Leak repairs",
      "New builds",
    ],
    quoteFields: ["Roof area", "Material type", "Flashings", "Labour days", "Scaffold allowance", "Margin"],
    faqs: [
      {
        question: "Can I quote from site photos?",
        answer:
          "Yes. Capture the roof on camera, add priced lines from your book, and send while the job is still fresh.",
      },
      {
        question: "Does it handle scaffolding and extras?",
        answer:
          "Add allowances as line items so the client sees a complete number, not a surprise later.",
      },
      {
        question: "Will it work for a small roofing crew?",
        answer:
          "Yes. Built for solo operators and crews up to about 15.",
      },
    ],
  },
  painter: {
    metaTitle: "Quoting software for painters",
    metaDescription:
      "Quote painting jobs on site. Rooms, prep, materials, and labour from your book, sent the same visit.",
    headline: "Price prep and coats before you leave the driveway.",
    subhead:
      "Room by room scope, materials, and labour from your book. Send a clean quote while the walkthrough is still fresh.",
    pain: "Painting quotes stall when room counts and prep notes sit in a notebook until tonight. Clients move on.",
    outcomes: [
      "Scope rooms, walls, and prep levels on site",
      "Price paint and labour from your book",
      "Send before you drive off",
      "Keep won jobs on one board",
    ],
    jobTypes: [
      "Interior repaints",
      "Exterior houses",
      "New build paint packages",
      "Commercial touch-ups",
      "Feature walls",
      "Prep and plaster repairs",
    ],
    quoteFields: ["Rooms", "Prep level", "Coat count", "Materials", "Labour hours", "Margin"],
    faqs: [
      {
        question: "Can I quote room by room?",
        answer:
          "Yes. Break the job into clear lines so the client sees what they are paying for, and you keep margin control.",
      },
      {
        question: "What about prep that changes on the day?",
        answer:
          "Start with a scoped allowance, then adjust lines before you send, or add a variation once the job is won.",
      },
      {
        question: "Do I need a laptop?",
        answer:
          "No. The quote builder is built for phone use on site.",
      },
    ],
  },
  tiler: {
    metaTitle: "Quoting software for tilers",
    metaDescription:
      "Quote tiling jobs on site. Areas, materials, labour, and waterproofing from your book, sent the same visit.",
    headline: "Turn a tile measure into a sent quote on site.",
    subhead:
      "Square metres, materials, and labour from your book. Waterproofing and extras stay on the quote, not in your head.",
    pain: "Tile quotes often wait on a evening spreadsheet. That lag loses bathrooms to whoever sent first.",
    outcomes: [
      "Price floors and walls by area from your book",
      "Include waterproofing, trim, and labour clearly",
      "Send from site the same visit",
      "Run accepted jobs from your phone",
    ],
    jobTypes: [
      "Bathroom floors and walls",
      "Kitchen splashbacks",
      "Laundry renovations",
      "Outdoor areas",
      "New builds",
      "Repairs and replacements",
    ],
    quoteFields: ["Area m2", "Tile supply", "Waterproofing", "Trim", "Labour hours", "Margin"],
    faqs: [
      {
        question: "Can I separate supply and lay?",
        answer:
          "Yes. Keep materials and labour as clear lines so clients can compare apples with apples.",
      },
      {
        question: "Does it handle waterproofing?",
        answer:
          "Add waterproofing as its own priced line so it never gets forgotten in a lump sum.",
      },
      {
        question: "Is it useful for small tiling crews?",
        answer:
          "Yes. Solo tilers and small crews are the sweet spot.",
      },
    ],
  },
  landscaper: {
    metaTitle: "Quoting software for landscapers",
    metaDescription:
      "Quote landscaping jobs on site. Softscape, hardscape, materials, and labour from your book, sent before you leave.",
    headline: "Scope the yard and send the number the same visit.",
    subhead:
      "Softscape, hardscape, materials, and labour from your book. No rewriting the job at the kitchen table tonight.",
    pain: "Landscape quotes sprawl across photos, sketches, and supplier lists. The delay is where clients ghost.",
    outcomes: [
      "Break softscape and hardscape into clear lines",
      "Price materials and labour from your book",
      "Send a client-ready quote on site",
      "Schedule won work from one board",
    ],
    jobTypes: [
      "Garden makeovers",
      "Turf and planting",
      "Paving and edging",
      "Retaining walls",
      "Irrigation",
      "Maintenance packages",
    ],
    quoteFields: ["Softscape", "Hardscape", "Materials", "Machine hire", "Labour days", "Margin"],
    faqs: [
      {
        question: "Can I quote mixed softscape and hardscape jobs?",
        answer:
          "Yes. Keep each package as clear lines so the client can accept the full scope or stage the work.",
      },
      {
        question: "What about machine hire and tip fees?",
        answer:
          "Add them as allowances so your number stays honest and your margin stays protected.",
      },
      {
        question: "Will clients accept on mobile?",
        answer:
          "Yes. They open a clean portal on their phone and tap accept.",
      },
    ],
  },
  arborist: {
    metaTitle: "Quoting software for arborists",
    metaDescription:
      "Quote tree work on site. Removals, pruning, stump grinding, and labour from your book, sent the same visit.",
    headline: "Price tree work before you leave the property.",
    subhead:
      "Removals, pruning, and stump work from your book. Send the quote while the client is still looking at the tree.",
    pain: "Arborist quotes often wait until you are back in the truck with a notepad full of tree notes. That lag loses urgent jobs.",
    outcomes: [
      "Scope removals, pruning, and stump grinding clearly",
      "Price crew time and disposal from your book",
      "Send while you are still on site",
      "Keep won jobs on a simple board",
    ],
    jobTypes: [
      "Tree removals",
      "Crown reductions",
      "Deadwooding",
      "Stump grinding",
      "Storm damage",
      "Council and permit work",
    ],
    quoteFields: ["Tree count", "Access", "Crew size", "Disposal", "Stump work", "Margin"],
    faqs: [
      {
        question: "Can I price by tree and access?",
        answer:
          "Yes. Build lines around size, access, and crew time so hard trees are not underquoted.",
      },
      {
        question: "Does it help with urgent storm work?",
        answer:
          "Send a clear number from site the same visit so the client can accept while the urgency is real.",
      },
      {
        question: "Is this for climbing crews or ground crews?",
        answer:
          "Either. Keep your own method; Swiftscope holds the priced scope and the won job.",
      },
    ],
  },
  concreter: {
    metaTitle: "Quoting software for concreters",
    metaDescription:
      "Quote concrete jobs on site. Slabs, paths, steel, and labour from your book, sent before you leave the driveway.",
    headline: "Turn a site measure into a concrete quote on the spot.",
    subhead:
      "Areas, thickness, steel, and labour from your book. Send before the pour window moves on without you.",
    pain: "Concrete quotes die when m2, steel, and pump hire sit in a notebook until tonight.",
    outcomes: [
      "Price slabs and paths by area and thickness",
      "Include steel, pump, and labour from your book",
      "Send the quote the same visit",
      "Manage accepted pours from your phone",
    ],
    jobTypes: [
      "House slabs",
      "Paths and driveways",
      "Shed slabs",
      "Crossovers",
      "Exposed aggregate",
      "Repairs and saw cuts",
    ],
    quoteFields: ["Area m2", "Thickness", "Steel", "Pump hire", "Labour", "Margin"],
    faqs: [
      {
        question: "Can I quote driveways and slabs quickly?",
        answer:
          "Yes. Use area, thickness, and your book rates so the number is ready before you leave site.",
      },
      {
        question: "What about pump and steel extras?",
        answer:
          "Add them as clear lines so the client sees the full job cost up front.",
      },
      {
        question: "Is it built for small concreting crews?",
        answer:
          "Yes. Solo operators and small crews, not a commercial estimating suite.",
      },
    ],
  },
  fencer: {
    metaTitle: "Quoting software for fencers",
    metaDescription:
      "Quote fencing jobs on site. Metres, posts, materials, and labour from your book, sent the same visit.",
    headline: "Measure the boundary, send the fence quote on site.",
    subhead:
      "Metres, posts, and labour from your book. No rewriting panels and gates at the desk later.",
    pain: "Fence quotes stall when lengths, gates, and removals wait for a night at the laptop.",
    outcomes: [
      "Price by metre with posts and gates as clear lines",
      "Include removal and clean-up allowances",
      "Send from site the same visit",
      "Keep won jobs scheduled in one place",
    ],
    jobTypes: [
      "Colorbond runs",
      "Timber paling",
      "Piers and plinths",
      "Gates",
      "Boundary replacements",
      "Repairs",
    ],
    quoteFields: ["Length m", "Post count", "Panels", "Gates", "Removal", "Margin"],
    faqs: [
      {
        question: "Can I quote Colorbond and timber the same way?",
        answer:
          "Yes. Keep material types in your book and build the run as clear metre and post lines.",
      },
      {
        question: "What about old fence removal?",
        answer:
          "Add removal as its own line so it does not get absorbed into a thin metre rate.",
      },
      {
        question: "Do clients accept on their phone?",
        answer:
          "Yes. They tap accept in a clean portal and the job lands on your board.",
      },
    ],
  },
  aircon: {
    metaTitle: "Quoting software for air conditioning",
    metaDescription:
      "Quote air conditioning installs on site. Systems, labour, and extras from your book, sent before you leave the driveway.",
    headline: "Quote the install while you are still in the house.",
    subhead:
      "Systems, mounts, electrical allowances, and labour from your book. Send before the client calls the next company.",
    pain: "HVAC quotes often wait on model numbers and a desk rewrite. That delay loses installs.",
    outcomes: [
      "Price split systems and ducted work from your book",
      "Include mounts, drains, and electrical allowances",
      "Send a clean quote the same visit",
      "Run accepted installs from your phone",
    ],
    jobTypes: [
      "Split system installs",
      "Multi-head systems",
      "Ducted upgrades",
      "Replacements",
      "Servicing packages",
      "Commercial light commercial",
    ],
    quoteFields: ["System type", "Heads", "Mounts", "Electrical", "Labour", "Margin"],
    faqs: [
      {
        question: "Can I quote splits and ducted in one tool?",
        answer:
          "Yes. Use your book and clear lines so each system type stays priced the way you actually sell it.",
      },
      {
        question: "What about electrical and mounting extras?",
        answer:
          "Keep them as separate lines so the client sees a complete install number.",
      },
      {
        question: "Is it mobile friendly on site?",
        answer:
          "Yes. Built for phone quoting in the driveway, not a desktop-only estimator.",
      },
    ],
  },
  surveyor: {
    metaTitle: "Job and quote software for surveyors",
    metaDescription:
      "Scope survey jobs on site, price from your book, send for acceptance, and run the work from your phone.",
    headline: "Scope the survey, send the fee, run the job.",
    subhead:
      "Capture the brief on site, price from your book, and keep accepted work on a simple board with schedule and notes.",
    pain: "Survey work still loses time in email threads and retyped scopes. A clean send-and-accept flow keeps the job moving.",
    outcomes: [
      "Scope site visits and deliverables as clear lines",
      "Price from your own fee book",
      "Send for acceptance without a PDF chase",
      "Track won work with schedule and notes",
    ],
    jobTypes: [
      "Title re-establishment",
      "Feature and level surveys",
      "Set-out",
      "Subdivision support",
      "Identification surveys",
      "Construction checks",
    ],
    quoteFields: ["Site visit", "Deliverable", "Drafting", "Travel", "Rush fee", "Margin"],
    faqs: [
      {
        question: "Is this only for building trades?",
        answer:
          "No. Surveyors use the same quote, accept, and job flow with fields that match how you price work.",
      },
      {
        question: "Can clients accept fees on their phone?",
        answer:
          "Yes. They open a clean portal, tap accept, and the job lands on your board.",
      },
      {
        question: "Does it replace my CAD tools?",
        answer:
          "No. It sits around the commercial side: quote, win, schedule, and track the job.",
      },
    ],
  },
  custom: {
    metaTitle: "Quoting software for specialist trades",
    metaDescription:
      "Quote and run jobs for specialist trades. Your price book, on-site quoting, client accept, and a simple job board.",
    headline: "Your trade, your book, quotes from site.",
    subhead:
      "Not every trade fits a default template. Load your rates, scope the job on site, send for accept, and run the work from your phone.",
    pain: "Specialist trades get stuck with generic forms that do not match how they price. Swiftscope starts from your book instead.",
    outcomes: [
      "Build quotes from your own materials and labour book",
      "Send from site without a desk rewrite",
      "Let clients accept on their phone",
      "Keep won jobs on one board for a small crew",
    ],
    jobTypes: [
      "Specialist installs",
      "Service calls",
      "Maintenance packages",
      "Custom fabrications",
      "Site measures",
      "Repeat residential work",
    ],
    quoteFields: ["Labour", "Materials", "Call-out", "Travel", "Notes", "Margin"],
    faqs: [
      {
        question: "What if my trade is not in the main list?",
        answer:
          "Use a custom setup with your own price book and line items. The quote, accept, and job flow still works the same way.",
      },
      {
        question: "Can I still quote on my phone?",
        answer:
          "Yes. The product is built for on-site quoting first.",
      },
      {
        question: "Is it suitable for a one-person business?",
        answer:
          "Yes. Solo operators are a core audience, through to crews up to about 15.",
      },
    ],
  },
};

function buildHub(trade: (typeof ALL_TRADES)[number]): TradeHub {
  const copy = COPY[trade.key];
  if (!copy) {
    throw new Error(`[trade-hubs] Missing copy for trade key: ${trade.key}`);
  }
  const slug = HUB_SLUG_OVERRIDE[trade.key] ?? tradeToSlug(trade.key);
  return {
    key: trade.key,
    slug,
    label: trade.label,
    plural: PLURAL_LABEL[trade.key] ?? `${trade.label.toLowerCase()}s`,
    dedicated: trade.dedicated,
    ...copy,
  };
}

export const TRADE_HUBS: TradeHub[] = ALL_TRADES.map(buildHub);

export function getTradeHubBySlug(slug: string): TradeHub | undefined {
  return TRADE_HUBS.find((h) => h.slug === slug);
}

export function getTradeHubByKey(key: string): TradeHub | undefined {
  return TRADE_HUBS.find((h) => h.key === key);
}
