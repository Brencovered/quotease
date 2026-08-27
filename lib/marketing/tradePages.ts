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

import type { ScreenshotKey } from "@/lib/marketing/screenshots";

export interface DocketLine {
  label: string;
  /** The trade's own unit: 'each', 'lm', 'm2', 'hrs'. This column is the point. */
  qty: string;
  unit: string;
  amount: number;
}

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

  /* ---- Expanded sections ------------------------------------------- */

  /** What this trade is actually up against, in their words. */
  problem: string;
  /** How Swiftscope answers that specific problem. */
  answer: string;
  /** Three things generic job software gets wrong for this trade. */
  genericFails: string[];
  /** Materials this trade would load on day one. */
  setupMaterials: string;
  /** A package this trade would save and reuse, with its contents. */
  packageName: string;
  packageContents: string;
  /** The shape of a real quote for this trade, start to send. */
  quotingFlow: { step: string; detail: string }[];
  /** What happens after the client accepts, for this trade. */
  afterAccept: string;

  /** Lines for the example quote card. Real fields, illustrative numbers. */
  docket: DocketLine[];
  docketHours: number;

  /**
   * Real screenshots embedded lower on the page. `setup` sits beside the
   * "set up in minutes" section (the trade's own price file/pricebook where
   * a real capture exists); `flow` sits beside "how the quoting works" (the
   * result of that trade's flow -- a sent quote, or for roofers the one
   * capture that actually matches their own "Runs and extras" step). Both
   * are real captures from that trade's own builder where one was taken;
   * the two trades without one (painters-and-plasterers, the generic
   * catch-all) point at their closest genuine capture or a trade-neutral
   * screen rather than another trade's mismatched fields.
   */
  screens: { setup: ScreenshotKey; flow: ScreenshotKey };
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
    problem:
      "Most sparkies quote from a notepad and a memory of what the last similar job cost. The number is usually close, but the twenty minutes finding the old quote, the retyped client details and the chase for current cable pricing all happen at 9pm, unpaid.",
    answer:
      "Swiftscope prices the things that actually move an electrical number: points, runs, board work and access. You count them once, on site, and the quote is built as you go.",
    genericFails: [
      "A blank line-item table with no idea that a downlight has a grade, a supply arrangement and sometimes a provisional sum",
      "No concept of access, so a 1960s tile roof with a crawl-through is priced identically to a new-build ceiling space",
      "Cable priced as a lump rather than by the metre, which is fine until the run to the shed is thirty metres",
    ],
    setupMaterials:
      "Upload your wholesaler price file as a CSV and Swiftscope reads the columns itself: description, unit, cost, supplier and SKU. GPOs, switches, downlights, cable by the metre and RCBOs land in your pricebook in one go.",
    packageName: "Standard bathroom rough-in",
    packageContents:
      "Exhaust fan, two downlights, one GPO, switch and the cable run, saved once and dropped into every bathroom you quote after that.",
    quotingFlow: [
      { step: "Count on site", detail: "Walk the job and tap in points, switches and downlights, or mark them straight onto the plan." },
      { step: "Set the runs and access", detail: "Cable metres, trench metres, roof and subfloor access. The multipliers do the work you would otherwise do in your head." },
      { step: "Board and extras", detail: "Switchboard upgrade, RCBOs by board or per pole, three-phase, exhaust fans." },
      { step: "Send before you leave", detail: "Margin applied, terms attached, PDF to the client from the driveway." },
    ],
    afterAccept:
      "The quote becomes the job. Schedule it, assign your apprentice, track hours against the estimate, raise a variation when the board turns out to be a Federal Pacific, then invoice and push to Xero without retyping a line.",
  docket: [
    { label: "Double GPO, installed",            qty: "6",  unit: "each",        amount: 780 },
    { label: "Downlight, standard grade",        qty: "12", unit: "each",        amount: 1140 },
    { label: "Cable run, 2.5mm T&E",  qty: "42", unit: "lm",          amount: 336 },
    { label: "Switchboard upgrade, RCBO",        qty: "8",  unit: "poles",       amount: 1240 },
    { label: "Roof access, tiled", qty: "1",  unit: "allowance",   amount: 180 },
  ],
  docketHours: 14,
  screens: { setup: "materials", flow: "quoteSend" },
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
    problem:
      "Plumbing quotes go wrong in two places: fixtures counted as a lump instead of individually, and the gas certification nobody mentioned until handover. Both get discovered late, and both come out of your margin.",
    answer:
      "Swiftscope counts every fixture as its own line and flags gas certification at quote time, so the scope on paper matches the job you actually do.",
    genericFails: [
      "Tapware as one line, so a basin mixer and a shower mixer are priced the same",
      "No distinction between a fixture swap and a full rough-in, which are hours apart",
      "Gas certification treated as an afterthought rather than a cost with a date attached",
    ],
    setupMaterials:
      "Upload your supplier's price file and Swiftscope maps the columns itself. Mixers, pans, PVC and copper by the metre, and hot water units by type all land in the pricebook ready to price against.",
    packageName: "Full bathroom rough-in",
    packageContents:
      "Shower mixer, basin mixer, toilet, waste and vent, plus the labour allowance, saved once and reused on every bathroom.",
    quotingFlow: [
      { step: "Count the fixtures", detail: "Basin, kitchen, shower and bath mixers, and toilets, each on its own line." },
      { step: "Add the rough-ins", detail: "Bathroom, kitchen or laundry, priced as the multi-day items they are rather than folded into fixtures." },
      { step: "Hot water and gas", detail: "Unit type, gas points, and the certification flag set now instead of remembered later." },
      { step: "Send it on the spot", detail: "Priced, marked up and emailed before you have packed the ute." },
    ],
    afterAccept:
      "Job scheduled, hours tracked against estimate, and when the floor comes up and the drainage is not where the plan said, the variation is raised and signed before you keep digging. Invoice and Xero at the end.",
  docket: [
    { label: "Shower mixer, supplied and fitted", qty: "1", unit: "each",      amount: 340 },
    { label: "Basin mixer",                       qty: "2", unit: "each",      amount: 420 },
    { label: "Toilet suite",                      qty: "1", unit: "each",      amount: 620 },
    { label: "Bathroom rough-in",                 qty: "1", unit: "room",      amount: 1450 },
    { label: "Hot water unit, heat pump",         qty: "1", unit: "each",      amount: 2890 },
  ],
  docketHours: 22,
  screens: { setup: "plumberMaterials", flow: "plumberSend" },
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
    problem:
      "Roofing is quoted as a lump sum more than almost any trade, which is why a steep roof and a low one too often carry the same price, and why rotten battens turn into an argument rather than a variation.",
    answer:
      "Swiftscope prices roofing the way it is actually built: area and pitch for the sheeting, linear metres for everything that runs along an edge.",
    genericFails: [
      "No pitch multiplier, so the roof that needs harnesses and staging is priced like a garage",
      "Ridge, valley, fascia, gutter and downpipe collapsed into one 'flashings' line",
      "Colorbond, terracotta and concrete tile treated as the same job on the same rate",
    ],
    setupMaterials:
      "Load your supplier's sheeting, capping and guttering prices as a CSV. Sheet by the square metre, ridge and gutter by the metre, and the fixings you go through by the box.",
    packageName: "Gutter and downpipe replacement",
    packageContents:
      "Gutter by the metre, brackets, downpipes, shoes and the disposal allowance, saved as one item you drop into any restoration quote.",
    quotingFlow: [
      { step: "Area and pitch", detail: "Square metres and low, standard or steep. The pitch multiplier handles the labour difference." },
      { step: "Roof type", detail: "Colorbond, terracotta, concrete tile or mixed, each on its own rate." },
      { step: "Runs and extras", detail: "Ridge, valley, fascia, gutter and downpipe by the metre. Whirlybirds and skylights by count." },
      { step: "Send from the roof", detail: "Photograph what you found, attach it, and send the quote before you are back down the ladder." },
    ],
    afterAccept:
      "Schedule around the weather, track the crew's hours, and when the battens come up rotten, raise the variation with the photo attached so nobody argues about whether it was there. Then invoice and push to Xero.",
  docket: [
    { label: "Colorbond, standard pitch", qty: "182", unit: "m2",     amount: 9100 },
    { label: "Ridge capping",                      qty: "22",  unit: "lm",     amount: 1078 },
    { label: "Valley, sarking and flashing",       qty: "14",  unit: "lm",     amount: 966 },
    { label: "Gutter replacement",                 qty: "48",  unit: "lm",     amount: 1632 },
    { label: "Downpipes",                          qty: "3",   unit: "each",   amount: 285 },
  ],
  docketHours: 46,
  screens: { setup: "roofingMaterials", flow: "roofingScope" },
  },
  {
    slug: "carpenters",
    trade: "carpenters",
    Trade: "Carpenters",
    singular: "chippy",
    dedicated: true,
    image: "/trades/carpenter.jpg",
    alt: "Carpenter using a nail gun on timber wall framing",
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
    problem:
      "Carpentry quotes get rebuilt from scratch every time, because the last one was a spreadsheet with a different structure. Deck, fit-out and framing all price differently, and a generic form makes you flatten them into the same shape.",
    answer:
      "Swiftscope keeps linear metre, square metre and unit work as separate things, and saves the combinations you quote most so you are not starting from a blank sheet.",
    genericFails: [
      "Doors as one number, with no separation between a hung door and a frame where the client supplies the leaf",
      "Skirting and architrave lumped into 'trim', which hides where the hours actually go",
      "Decking priced per job rather than per square metre with beams by the metre",
    ],
    setupMaterials:
      "Upload your timber merchant's price list. Framing timber and decking by the metre, sheets by the unit, and hardware by the box, all mapped from the CSV automatically.",
    packageName: "Standard internal door hang",
    packageContents:
      "Door, frame, hardware, architrave both sides and the labour allowance, saved once and multiplied by however many doors the job has.",
    quotingFlow: [
      { step: "Pick the job type", detail: "Deck, framing, fit-out, renovation or repair, each priced on its own basis." },
      { step: "Measure what runs", detail: "Skirting, architrave, framing timber, decking beams and robe shelving by linear metre." },
      { step: "Count what does not", detail: "Doors, frames, stud walls and plywood sheets as units. Decking by square metre." },
      { step: "Send it from site", detail: "Priced with your margin, terms attached, out before you are back in the ute." },
    ],
    afterAccept:
      "The quote becomes a scheduled job with hours tracked against estimate. Rot in the bearers becomes a signed variation, not a favour. Invoice and Xero when it is done.",
  docket: [
    { label: "Merbau decking, laid",        qty: "32", unit: "m2",   amount: 4160 },
    { label: "Decking beams and bearers",   qty: "26", unit: "lm",   amount: 988 },
    { label: "Internal door, hung",         qty: "6",  unit: "each", amount: 1740 },
    { label: "Skirting and architrave",     qty: "64", unit: "lm",   amount: 1216 },
    { label: "New stud wall, 3m",           qty: "2",  unit: "each", amount: 940 },
  ],
  docketHours: 38,
  screens: { setup: "carpenterMaterials", flow: "carpenterSend" },
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
    problem:
      "Painting and plastering quotes live or die on the pricebook. Re-costing the second bedroom from memory, or forgetting that paint went up eleven percent in March, is where the margin quietly goes.",
    answer:
      "Swiftscope gives you a builder you shape to your own units, backed by a pricebook and saved packages so the same room is never priced twice from scratch.",
    genericFails: [
      "Rigid trade templates that assume you price by the item rather than by the square metre or the coat",
      "Materials and labour merged, so a paint price rise is invisible until the job is finished",
      "No reusable room or coat packages, which is exactly the repetition this trade lives on",
    ],
    setupMaterials:
      "Upload your paint or plaster supplier's price file as a CSV. Products, unit sizes and costs land in the pricebook, so a price rise is one re-upload rather than a rebuild.",
    packageName: "Standard bedroom, two coats",
    packageContents:
      "Walls and ceiling by area, cutting in, prep and patching allowance, and the paint at your current cost, saved once and reused room after room.",
    quotingFlow: [
      { step: "Build your line items", detail: "Per square metre, per room or per coat. Your units, not someone else's template." },
      { step: "Pull from the pricebook", detail: "Saved rates and current material costs, so nothing is priced from memory." },
      { step: "Drop in packages", detail: "Standard room, whole house repaint, or whatever you quote most, added in one tap." },
      { step: "Send it on site", detail: "Margin applied, terms attached, gone before you leave the walk-through." },
    ],
    afterAccept:
      "Scheduled, hours tracked, and the wall that needs a full skim instead of a patch becomes a signed variation before the extra day starts. Invoice and Xero at completion.",
  docket: [
    { label: "Walls, two coats",            qty: "196", unit: "m2",   amount: 3920 },
    { label: "Ceilings, living areas",      qty: "54",  unit: "m2",   amount: 1188 },
    { label: "Prep, patch and sand",        qty: "1",   unit: "job",  amount: 680 },
    { label: "Cutting in, doors and trim",  qty: "18",  unit: "each", amount: 810 },
    { label: "Paint and materials",         qty: "1",   unit: "lot",  amount: 1240 },
  ],
  docketHours: 34,
  // No materials capture exists for this trade (the registry's comment on
  // paintingPackages/paintingSend explains why -- the only "materials" shot
  // taken alongside them is actually the roofer's catalogue). Packages is
  // the closest real capture to "your price file" for this section.
  screens: { setup: "paintingPackages", flow: "paintingSend" },
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
    problem:
      "Most trade software is built for one or two trades and everyone else gets the leftovers: a blank form, someone else's units, and a monthly bill that goes up when you hire someone.",
    answer:
      "Swiftscope gives you a builder you define yourself, on a pricebook and packages you control, at the same flat price no matter how many people are on it.",
    genericFails: [
      "Templates built for plumbing and electrical, with your trade squeezed into the nearest fit",
      "Per-user pricing that makes hiring an apprentice a software decision",
      "Per-job credits, so your busiest month is also your most expensive",
    ],
    setupMaterials:
      "Upload whatever price file your supplier sends. Swiftscope reads the columns itself, so you are not remapping a spreadsheet before you can quote.",
    packageName: "Your most repeated job",
    packageContents:
      "Whatever you quote every week, saved with its materials, labour and allowances, and dropped into a quote in one tap.",
    quotingFlow: [
      { step: "Define your line items", detail: "Your units, your rates, saved to a pricebook you own." },
      { step: "Price from the book", detail: "Current material costs and your labour rates, not a number from memory." },
      { step: "Reuse your packages", detail: "The jobs you quote most often, built once." },
      { step: "Send from site", detail: "Priced and emailed before you have left the job." },
    ],
    afterAccept:
      "Scheduled, tracked against estimate, variations signed on site, invoiced and pushed to Xero. The same flow every dedicated trade gets.",
  docket: [
    { label: "Exposed aggregate driveway",  qty: "60", unit: "m2",   amount: 7200 },
    { label: "Reinforcing mesh",            qty: "60", unit: "m2",   amount: 720 },
    { label: "Concrete pump hire",          qty: "1",  unit: "day",  amount: 950 },
    { label: "Edging, formed and finished", qty: "12", unit: "lm",   amount: 540 },
    { label: "Site prep and excavation",    qty: "1",  unit: "job",  amount: 1180 },
  ],
  docketHours: 26,
  // No capture exists for this catch-all trade specifically -- both shots
  // are from the trade-neutral subset (see screenshots.ts's own note on
  // which captures carry no trade-specific fields) rather than showing a
  // dedicated trade's fields on the page for everyone else.
  screens: { setup: "pricingTiers", flow: "quoteSentDetail" },
  },
];

export function getTradePage(slug: string): TradePage | undefined {
  return TRADE_PAGES.find((t) => t.slug === slug);
}
