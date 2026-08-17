/**
 * Free tools registry — tradie acquisition + homeowner directory traffic.
 */

export type ToolAudience = "tradie" | "homeowner";

export type ToolMeta = {
  slug: string;
  href: string;
  title: string;
  shortTitle: string;
  description: string;
  audience: ToolAudience;
  hook: string;
  hookCta: string;
  hookHref: string;
};

export const TOOLS: ToolMeta[] = [
  {
    slug: "charge-out-rate",
    href: "/tools/charge-out-rate",
    title: "True charge-out rate calculator",
    shortTitle: "Charge-out rate",
    description:
      "Work out the minimum hourly and day rate you need from take-home pay, real overheads, and the hours you actually bill.",
    audience: "tradie",
    hook: "Stop guessing your prices. Want to build quotes automatically using your true profitable rate?",
    hookCta: "Start your 7-day free trial",
    hookHref: "/signup",
  },
  {
    slug: "margin-markup",
    href: "/tools/margin-markup",
    title: "Profit margin and materials markup calculator",
    shortTitle: "Margin & markup",
    description:
      "Enter cost price and desired margin. See the sell price, and the difference between margin and markup so you stop underquoting.",
    audience: "tradie",
    hook: "Tired of doing this math in your head at Bunnings or in the driveway? Swiftscope automates your margins instantly.",
    hookCta: "Try Swiftscope free",
    hookHref: "/signup",
  },
  {
    slug: "quote-pdf",
    href: "/tools/quote-pdf",
    title: "Free professional quote PDF generator",
    shortTitle: "Quote PDF",
    description:
      "Add your business details, a few line items, and download a clean quote PDF. No signup required to try it.",
    audience: "tradie",
    hook: "Making this PDF took you 10 minutes. With Swiftscope on-site markup or voice-to-quote, it takes seconds.",
    hookCta: "Try quoting on site free",
    hookHref: "/signup",
  },
  {
    slug: "vehicle-cost",
    href: "/tools/vehicle-cost",
    title: "Tradie vehicle running cost estimator",
    shortTitle: "Vehicle cost",
    description:
      "Estimate the true cost of your ute or van per kilometre from fuel, rego, insurance, servicing, and depreciation.",
    audience: "tradie",
    hook: "Fold vehicle cost into your charge-out rate, then load the number into your Swiftscope price book.",
    hookCta: "Build quotes with real costs",
    hookHref: "/signup",
  },
  {
    slug: "ballpark-cost",
    href: "/tools/ballpark-cost",
    title: "Ballpark renovation and job cost estimator",
    shortTitle: "Ballpark costs",
    description:
      "Pick a common job and size to see a rough Australian price range before you call a tradie.",
    audience: "homeowner",
    hook: "This is only a ballpark. Want a real number from someone local? Browse vetted tradies near you.",
    hookCta: "Find a local tradie",
    hookHref: "/directory",
  },
  {
    slug: "diy-materials",
    href: "/tools/diy-materials",
    title: "DIY material calculators",
    shortTitle: "DIY materials",
    description:
      "Concrete volume, tile boxes, and paint litres. Plan the materials before you decide to DIY or hire.",
    audience: "homeowner",
    hook: "Realised this job is bigger than you thought? Find a local tradie to do it for you.",
    hookCta: "Browse the directory",
    hookHref: "/directory",
  },
  {
    slug: "hire-checklist",
    href: "/tools/hire-checklist",
    title: "Hire a tradie safety checklist",
    shortTitle: "Hire checklist",
    description:
      "The five checks every homeowner should make before hiring: licence, insurance, references, clear quote, and timeline.",
    audience: "homeowner",
    hook: "Don't want the hassle of vetting everyone yourself? Search Google-reviewed tradies on Swiftscope.",
    hookCta: "Search your suburb",
    hookHref: "/directory",
  },
];

export function getToolBySlug(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function toolsByAudience(audience: ToolAudience): ToolMeta[] {
  return TOOLS.filter((t) => t.audience === audience);
}
