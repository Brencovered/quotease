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

export const TOOL_DISCLAIMER =
  "These free tools are planning guidelines only. They are not financial, tax, accounting, or legal advice. Rates and rules change. Confirm figures with your accountant or the ATO before you set prices, claim deductions, or make super payments.";

export type ToolSource = { label: string; href: string; note: string };

export const CHARGE_OUT_SOURCES: ToolSource[] = [
  {
    label: "ATO Super Guarantee rates",
    href: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee",
    note: "Official Superannuation Guarantee percentage (currently 12% of ordinary time earnings / qualifying earnings).",
  },
  {
    label: "ATO Super Guarantee rate increase notice",
    href: "https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/the-final-sg-rate-increase-is-coming-on-1-july",
    note: "ATO notice on the move to 12% SG.",
  },
  {
    label: "Digit Super Guarantee employer guide",
    href: "https://digit.business/insights/people-payroll/super-guarantee-rate-2025-26-australia",
    note: "Employer-focused summary of SG rate, due dates, and Payday Super changes.",
  },
  {
    label: "Finder hourly rate calculator guide",
    href: "https://www.finder.com.au/business-insurance/hourly-rate-calculator",
    note: "Australian benchmarks for building a charge-out from costs and realistic billable hours.",
  },
  {
    label: "FigsFlow Australian charge-out rate breakdown",
    href: "https://figsflow.com/calculators/charge-out-rate-calculator-au/",
    note: "Breakdown of salaries, super, overheads, and non-billable time in charge-out math.",
  },
];

export const MARGIN_SOURCES: ToolSource[] = [
  {
    label: "Xero AU Margin vs Markup guide",
    href: "https://www.xero.com/au/glossary/margin-vs-markup/",
    note: "Clear definitions: margin is profit on revenue; markup is profit on cost.",
  },
  {
    label: "Xero margin calculator",
    href: "https://www.xero.com/calculators/margin-calculator/",
    note: "Shows why a 20% margin needs a 25% markup.",
  },
];

export const VEHICLE_SOURCES: ToolSource[] = [
  {
    label: "ATO cents-per-kilometre method",
    href: "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/cars-transport-and-travel/motor-vehicle-and-car-expenses/expenses-for-a-car-you-own-or-lease/cents-per-kilometre-method",
    note: "Official cents-per-km rates (88c for 2024–25 and 2025–26; check the year you are claiming).",
  },
  {
    label: "ATO motor vehicle expenses (business)",
    href: "https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/cents-per-kilometre-method",
    note: "Sole trader / partnership guidance on claiming car expenses.",
  },
];

export const QUOTE_PDF_SOURCES: ToolSource[] = [
  {
    label: "Xero AU Margin vs Markup guide",
    href: "https://www.xero.com/au/glossary/margin-vs-markup/",
    note: "Useful when setting material margins on quote line items.",
  },
];

export function sourcesForTool(slug: string): ToolSource[] {
  switch (slug) {
    case "charge-out-rate":
      return CHARGE_OUT_SOURCES;
    case "margin-markup":
      return MARGIN_SOURCES;
    case "vehicle-cost":
      return VEHICLE_SOURCES;
    case "quote-pdf":
      return QUOTE_PDF_SOURCES;
    default:
      return [];
  }
}

export const TOOLS: ToolMeta[] = [
  {
    slug: "charge-out-rate",
    href: "/tools/charge-out-rate",
    title: "True charge-out rate calculator for Australian tradies",
    shortTitle: "True charge-out rate",
    description:
      "Free calculator that factors net pay, tax, 12% super, workers comp, leave, public holidays, and unbillable admin time into your real hourly and day rate.",
    audience: "tradie",
    hook: "Save your true charge-out rate straight into your Swiftscope profile so on-site quotes automatically protect your profit.",
    hookCta: "Start 7-day free trial",
    hookHref: "/signup",
  },
  {
    slug: "margin-markup",
    href: "/tools/margin-markup",
    title: "Profit margin vs markup converter for tradies",
    shortTitle: "Margin vs markup",
    description:
      "Free margin and markup converter with GST toggle and a side-by-side matrix. Stop leaking profit by confusing 20% markup with 20% margin.",
    audience: "tradie",
    hook: "Stop doing driveway math at Bunnings. Swiftscope applies your exact pre-configured profit margins to materials instantly.",
    hookCta: "Try Swiftscope free",
    hookHref: "/signup",
  },
  {
    slug: "quote-pdf",
    href: "/tools/quote-pdf",
    title: "Free professional quote PDF generator for tradies",
    shortTitle: "Quote PDF generator",
    description:
      "No-login quote PDF builder with logo, brand colour, labour and materials lines, payment terms, and a signature line. Email and phone unlock the download.",
    audience: "tradie",
    hook: "Creating this PDF took minutes at your desk. Swiftscope's AI voice quote builder creates and sends this in seconds from your driveway.",
    hookCta: "Try voice and on-site quoting free",
    hookHref: "/signup",
  },
  {
    slug: "vehicle-cost",
    href: "/tools/vehicle-cost",
    title: "Tradie vehicle and equipment wear-and-tear calculator",
    shortTitle: "Vehicle & equipment cost",
    description:
      "Calculate true cost per kilometre and daily rolling overhead for ute, van, or truck. Includes fuel, tyres, depreciation, tool replacement, and ATO 88c/km comparison.",
    audience: "tradie",
    hook: "Automatically include your custom vehicle trip fee in every quote with one tap in Swiftscope.",
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

export const CHARGE_OUT_FAQS = [
  {
    q: "Why is my true charge-out higher than salary ÷ 2,000?",
    a: "Because up to 40% of a tradie week is often unbillable, and net pay ignores tax, super, leave, workers comp, and fixed overheads. Dividing a target salary by 2,000 quietly underprices every job.",
  },
  {
    q: "Does this include the 12% superannuation guarantee?",
    a: "Yes. The calculator defaults to 12% super on your net-plus-tax base as a planning input. Confirm employer SG obligations with the ATO. This tool is a guideline, not financial advice.",
  },
  {
    q: "Should I use break-even or the buffered charge-out?",
    a: "Break-even covers costs. The buffered rate adds a profit margin so one quiet week or a materials surprise does not wipe you out. Most crews quote off the buffered number. Check with your accountant before locking prices.",
  },
];

export const MARGIN_FAQS = [
  {
    q: "What is the difference between margin and markup?",
    a: "Markup is profit as a percent of cost. Margin is profit as a percent of sell price. A 20% markup on $1,000 is $1,200, which is only a 16.7% margin. See the Xero AU guide linked below.",
  },
  {
    q: "Should GST be inside my margin target?",
    a: "No. Set margin on the ex-GST sell price, then add 10% GST for the customer total. Mixing GST into margin math is another common way to underquote.",
  },
];

export const QUOTE_PDF_FAQS = [
  {
    q: "Do I need a Swiftscope account to make a PDF?",
    a: "No. Build the quote in the browser. Email and phone unlock the download so we can send useful follow-up tips. No login wall on the builder itself.",
  },
  {
    q: "Can I add payment terms and a signature line?",
    a: "Yes. Choose 7-day payment, deposit, or a variation clause, and optionally include a client signature block on the PDF. Terms here are templates only. Get legal advice for your contracts.",
  },
];

export const VEHICLE_FAQS = [
  {
    q: "What is the ATO cents-per-kilometre rate?",
    a: "The ATO cents-per-km method is 88 cents per kilometre for the 2024–25 and 2025–26 income years (rates change. Always check the ATO page for the year you are claiming). This tool compares your estimated running cost to that rate for planning only.",
  },
  {
    q: "Why include a tool replacement pool?",
    a: "Grinders, batteries, blades, and consumables wear out on site and rarely get line-itemed. Folding an annual tool pool into daily overhead stops that quiet leak. Not a tax deduction calculator.",
  },
];

export function getToolBySlug(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function toolsByAudience(audience: ToolAudience): ToolMeta[] {
  return TOOLS.filter((t) => t.audience === audience);
}
