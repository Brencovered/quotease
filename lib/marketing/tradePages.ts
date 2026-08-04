/**
 * lib/marketing/tradePages.ts
 * ---------------------------
 * Content for /quoting-software/[trade].
 *
 * Two jobs at once:
 *
 *  1. SEO. Each page targets a real keyword from the tracked SaaS set
 *     ("quoting software for electricians" and siblings). Those terms had no
 *     ranking pages at all, because the SaaS side of the site was three
 *     pages of abstract marketing copy against competitors with a decade of
 *     content. One substantial page per trade is the cheapest way to have
 *     something for Google to return.
 *
 *  2. Credibility. Every `prices` entry below is a field that genuinely
 *     exists in that trade's intake type (lib/calc.ts, calcPlumber.ts,
 *     calcRoofer.ts, calcCarpenter.ts). Nothing here is aspirational. A
 *     tradie who signs up and cannot find what the page promised is worse
 *     than one who never signed up, and specifics are also what make the
 *     copy read as though it was written by someone who has seen the job.
 *
 * When a builder gains or loses a field, update the matching entry here.
 */

export interface TradePage {
  slug: string;
  /** Plural, lowercase: used mid-sentence. */
  trade: string;
  /** Title-case plural, for headings. */
  Trade: string;
  /** Singular, for "a {singular} quoting on site". */
  singular: string;
  /** True only for trades with a purpose-built builder, not the generic one. */
  dedicated: boolean;
  image: string;
  alt: string;
  metaTitle: string;
  metaDescription: string;
  /** One-line promise under the H1. */
  lede: string;
  /** Real intake fields, phrased as a tradie would say them. */
  prices: string[];
  /** What the AI drawing pre-read looks for on this trade's plans. */
  drawing: string;
  /** A spoken sentence this trade would plausibly say to voice quoting. */
  voiceExample: string;
  /** The variation that most often eats this trade's margin. */
  variation: string;
}

export const TRADE_PAGES: TradePage[] = [
  {
    slug: "electricians",
    trade: "electricians",
    Trade: "Electricians",
    singular: "sparky",
    dedicated: true,
    image: "/trades/electrician.jpg",
    alt: "Electrician fitting a ceiling light from a step ladder",
    metaTitle: "Quoting Software for Electricians | Swiftscope",
    metaDescription:
      "Quote electrical work on site: points, runs, downlights and switchboard upgrades, priced from a marked-up plan. Flat $45/month, unlimited users. 7-day free trial.",
    lede:
      "Price points, runs and switchboard work from a marked-up plan, standing in the job rather than at the kitchen table at 9pm.",
    prices: [
      "Power points, light points and switches, counted straight off the plan",
      "Downlights by grade, with client supply or a provisional sum where the fitting is not chosen yet",
      "Cable runs metre by metre, so a long run to the shed is not absorbed into a round number",
      "Switchboard upgrades, RCBO by full board or per pole, and three-phase",
      "Exhaust fans, and trench metres where the run goes underground",
      "Roof and subfloor access multipliers, because a 1960s tile roof is not a new-build ceiling space",
    ],
    drawing:
      "Upload the electrical plan and the AI pre-read picks out GPOs, light points and switch locations before you start clicking. You confirm or correct every item, so a misread symbol never reaches the client.",
    voiceExample:
      "\"Twelve downlights through the living and dining, six new GPOs, switchboard upgrade with RCBOs, and a run out to the shed about twenty-five metres.\"",
    variation:
      "The switchboard that turns out to be a Federal Pacific, or the ceiling space with no access. Raise it as a variation, get it signed on the spot, and it flows through to the invoice.",
  },
  {
    slug: "plumbers",
    trade: "plumbers",
    Trade: "Plumbers",
    singular: "plumber",
    dedicated: true,
    image: "/trades/plumber.jpg",
    alt: "Plumber working under a kitchen sink",
    metaTitle: "Quoting Software for Plumbers | Swiftscope",
    metaDescription:
      "Quote plumbing work on site: fixtures, rough-ins, hot water units and gas points, with variations signed before the extra work starts. Flat $45/month, 7-day free trial.",
    lede:
      "Fixtures, rough-ins and hot water swaps priced before you have left the driveway, with gas certification tracked rather than remembered.",
    prices: [
      "Basin, kitchen and shower or bath mixers counted individually rather than lumped as tapware",
      "Toilets, and full bathroom, kitchen or laundry rough-ins as separate line items",
      "Hot water unit replacement by type: electric, gas or heat pump",
      "Gas points, with the certification flag set at quote time instead of discovered at handover",
      "Drainage and fault work as their own job types, priced on their own basis",
    ],
    drawing:
      "Mark up the hydraulic plan, drop your fixture positions, and let the AI pre-read find the rough-in points on a new build before you count them by hand.",
    voiceExample:
      "\"Full bathroom rough-in, new shower mixer and basin mixer, toilet, and swap the old electric hot water for a heat pump out the side.\"",
    variation:
      "Pulling up the floor and finding the drainage is not where the plan said. That is a variation, signed on site, not a conversation at invoice time.",
  },
  {
    slug: "roofers",
    trade: "roofers",
    Trade: "Roofers",
    singular: "roofer",
    dedicated: true,
    image: "/trades/roofer.jpg",
    alt: "Roofer fixing sheeting on a metal roof",
    metaTitle: "Quoting Software for Roofers | Swiftscope",
    metaDescription:
      "Quote roofing work by area, pitch and linear metres: ridge, valley, fascia, gutter and downpipe. Restoration or full re-roof. Flat $45/month, 7-day free trial.",
    lede:
      "Price a re-roof or restoration by area and pitch, with ridge, valley, fascia and gutter as real line items instead of a lump sum.",
    prices: [
      "Roof area in square metres, with pitch as a labour multiplier so a steep roof is not priced like a low one",
      "Colorbond, terracotta, concrete tile or a mixed roof, each on its own rate",
      "Ridge, valley, fascia, gutter and downpipe by linear metre",
      "Whirlybirds and skylights counted separately",
      "Re-roof, repair, new, gutters or inspection as distinct job types",
    ],
    drawing:
      "Photograph the roof from the ground or mark up a site plan, and use the drawing tools to set out areas and runs while you are still on the job.",
    voiceExample:
      "\"Full re-roof, about one-eighty square, standard pitch, colorbond. Twenty-two metres of ridge, fourteen of valley, and replace all the gutters and three downpipes.\"",
    variation:
      "Battens that are rotten once the tiles come off. Raise it, get it accepted, and keep the original quote intact.",
  },
  {
    slug: "carpenters",
    trade: "carpenters",
    Trade: "Carpenters",
    singular: "chippy",
    dedicated: true,
    image: "/trades/carpenter.jpg",
    alt: "Carpenter carrying a sheet through a stud-framed room",
    metaTitle: "Quoting Software for Carpenters | Swiftscope",
    metaDescription:
      "Quote carpentry by linear and square metre: framing, decking, doors, skirting and fit-out. Built for framing, decks and renovation work. Flat $45/month, 7-day free trial.",
    lede:
      "Framing, decks and fit-out priced by linear and square metre, so a quote is not rebuilt from scratch on every job.",
    prices: [
      "Internal and external doors, and frames on their own where the door is supplied",
      "Skirting and architrave by linear metre",
      "New stud walls by count, and framing timber by linear metre",
      "Plywood sheets counted rather than estimated",
      "Decking by square metre, with beams by linear metre",
      "Robe and shelving runs by linear metre",
    ],
    drawing:
      "Mark up the floor plan to set out wall runs and openings, and let the AI pre-read pick out doors and room dimensions before you count.",
    voiceExample:
      "\"Deck out the back, about thirty-two square, plus beams. Six internal doors, skirting and architrave right through, and two new stud walls in the extension.\"",
    variation:
      "Rot in the bearers once the old deck is lifted. Signed off before the saw comes out.",
  },
  {
    slug: "painters-and-plasterers",
    trade: "painters and plasterers",
    Trade: "Painters & Plasterers",
    singular: "painter",
    dedicated: false,
    image: "/trades/plasterer.jpg",
    alt: "Plasterer holding a trowel on a work site",
    metaTitle: "Quoting Software for Painters & Plasterers | Swiftscope",
    metaDescription:
      "Quote painting and plastering room by room or whole house, on your own rates and units. Flat $45/month, unlimited users, unlimited quotes. 7-day free trial.",
    lede:
      "Room by room or whole house, on rates and units you set yourself, with the same site-first flow as every other trade.",
    prices: [
      "Your own line items and units, priced per square metre, per room or per coat",
      "A saved pricebook, so the second bedroom is not re-costed from memory",
      "Materials tracked separately from labour, so a paint price rise does not quietly eat the margin",
      "Reusable packages for the jobs you quote most often",
    ],
    drawing:
      "Mark up the floor plan to set out rooms and wall areas, then carry the quantities straight into the quote.",
    voiceExample:
      "\"Whole house repaint, four bed, two coats throughout, ceilings in the living areas only, and patch the cracking in the hallway first.\"",
    variation:
      "The wall that needs a full skim rather than a patch. Raised, priced and accepted before the extra day starts.",
  },
  {
    slug: "trades",
    trade: "trades",
    Trade: "Every Other Trade",
    singular: "tradie",
    dedicated: false,
    image: "/trades/general.jpg",
    alt: "Tradesperson kneeling with a cordless drill",
    metaTitle: "Quoting Software for Australian Tradies | Swiftscope",
    metaDescription:
      "Quoting and job management for concreters, tilers, fencers, landscapers and every other trade. Flat $45/month, unlimited users and jobs. 7-day free trial.",
    lede:
      "Concreters, tilers, fencers, landscapers and everyone else, on a builder you shape to your own line items.",
    prices: [
      "Your own line items, units and rates, saved to a pricebook you control",
      "Reusable packages for the jobs you quote week in, week out",
      "Materials and labour split, so margin is visible before you send",
      "The same variations, deposits and invoicing as every dedicated builder",
    ],
    drawing:
      "Upload a plan or a site photo, mark it up, count what matters for your trade, and carry the quantities into the quote.",
    voiceExample:
      "\"Sixty square of exposed aggregate on the driveway, mesh and pump, plus twelve metres of edging down the side.\"",
    variation:
      "Whatever the site turns up once you start. Raise it, get it signed, keep the original quote clean.",
  },
];

export function getTradePage(slug: string): TradePage | undefined {
  return TRADE_PAGES.find((t) => t.slug === slug);
}
