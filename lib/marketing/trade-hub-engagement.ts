/**
 * Trade-page engagement layer: demos, compliance, field mockups.
 * Merged into TradeHub via trade-hubs.ts
 */

export type TradeDemoLine = {
  name: string;
  qty: string;
  amount: number;
};

export type TradeDemoJob = {
  id: string;
  label: string;
  labourHours: number;
  lines: TradeDemoLine[];
};

export type TradeCompliance = {
  badge: string;
  title: string;
  body: string;
};

export type TradeQuoteField = {
  id: string;
  label: string;
  /** How it appears in the phone mock line items */
  mockLine: string;
  mockQty: string;
  mockAmount: number;
};

export type TradeEngagement = {
  /** AU slang for eyebrow e.g. sparkies */
  slang: string;
  /** Trade-matched hero alt override when photo is best-fit */
  heroAlt: string;
  supportAlt: string;
  compliance: TradeCompliance;
  demoJobs: TradeDemoJob[];
  quoteFields: TradeQuoteField[];
};

function money(n: number) {
  return n;
}

export const TRADE_ENGAGEMENT: Record<string, TradeEngagement> = {
  electrician: {
    slang: "sparkies",
    heroAlt: "Sparky at a residential switchboard scoping circuits",
    supportAlt: "Electrician on site checking the install before quoting",
    compliance: {
      badge: "COES",
      title: "COES and compliance on the quote",
      body: "Add Certificate of Electrical Safety notes and compliance line items with the priced scope. Your COES process stays yours — Swiftscope keeps the paperwork with the job.",
    },
    demoJobs: [
      {
        id: "ev-charger",
        label: "EV charger install",
        labourHours: 4.5,
        lines: [
          { name: "7 kW wall charger supply", qty: "1 ea", amount: money(890) },
          { name: "6 mm² twin & earth run", qty: "14 m", amount: money(280) },
          { name: "Circuit breaker + isolator", qty: "1 lot", amount: money(165) },
          { name: "Labour — install & test", qty: "4.5 h", amount: money(495) },
        ],
      },
      {
        id: "switchboard",
        label: "Switchboard upgrade",
        labourHours: 6,
        lines: [
          { name: "Main switchboard enclosure", qty: "1 ea", amount: money(620) },
          { name: "RCBO circuits", qty: "8 ea", amount: money(480) },
          { name: "Men / earth upgrade", qty: "1 lot", amount: money(210) },
          { name: "Labour — changeover", qty: "6 h", amount: money(660) },
        ],
      },
      {
        id: "downlights",
        label: "Downlight upgrade",
        labourHours: 3.5,
        lines: [
          { name: "LED downlight, standard", qty: "12 ea", amount: money(420) },
          { name: "1.5 mm T&E cable", qty: "35 m", amount: money(175) },
          { name: "Ceiling cans / trims", qty: "12 ea", amount: money(96) },
          { name: "Labour — cut & fit", qty: "3.5 h", amount: money(385) },
        ],
      },
      {
        id: "rough-in",
        label: "New house rough-in",
        labourHours: 28,
        lines: [
          { name: "Power points & switches", qty: "42 ea", amount: money(1260) },
          { name: "Cable package", qty: "1 lot", amount: money(1850) },
          { name: "Smoke alarms (interconnected)", qty: "4 ea", amount: money(320) },
          { name: "Labour — rough-in", qty: "28 h", amount: money(3080) },
        ],
      },
    ],
    quoteFields: [
      { id: "circuits", label: "Circuits", mockLine: "New lighting circuit", mockQty: "1 ea", mockAmount: 185 },
      { id: "switchboards", label: "Switchboards", mockLine: "RCBO switchboard upgrade", mockQty: "1 lot", mockAmount: 1480 },
      { id: "cabling", label: "Cabling", mockLine: "1.5 mm T&E cable run", mockQty: "40 m", mockAmount: 312 },
      { id: "fixtures", label: "Fixtures", mockLine: "Downlight, standard", mockQty: "8 ea", mockAmount: 280 },
      { id: "labour", label: "Labour hours", mockLine: "Install labour", mockQty: "6 h", mockAmount: 660 },
      { id: "margin", label: "Margin", mockLine: "Residential margin (+6%)", mockQty: "applied", mockAmount: 0 },
    ],
  },

  plumber: {
    slang: "plumbers",
    heroAlt: "Plumber working a residential wet-area rough-in",
    supportAlt: "Bathroom ready for fit-off after the plumbing measure",
    compliance: {
      badge: "WWC",
      title: "Waterproofing certs stay with the job",
      body: "Note waterproofing certificates and wet-area compliance on the quote so the builder and homeowner see inclusions before they accept — not as a surprise later.",
    },
    demoJobs: [
      {
        id: "hot-water",
        label: "Hot water unit replacement",
        labourHours: 3,
        lines: [
          { name: "250 L heat pump HWS", qty: "1 ea", amount: money(2100) },
          { name: "Tempering valve + isolators", qty: "1 lot", amount: money(185) },
          { name: "Copper / PEX tie-ins", qty: "1 lot", amount: money(140) },
          { name: "Labour — swap & commission", qty: "3 h", amount: money(390) },
        ],
      },
      {
        id: "bathroom-reno",
        label: "Bathroom reno rough-in",
        labourHours: 8,
        lines: [
          { name: "Shower mixer + rose", qty: "1 set", amount: money(420) },
          { name: "Vanity taps + waste", qty: "1 set", amount: money(280) },
          { name: "Drainage run relocates", qty: "1 lot", amount: money(650) },
          { name: "Labour — rough-in & fit-off", qty: "8 h", amount: money(1040) },
        ],
      },
      {
        id: "blocked-drain",
        label: "Blocked drain call-out",
        labourHours: 1.5,
        lines: [
          { name: "Call-out / first hour", qty: "1 ea", amount: money(180) },
          { name: "Electric eel / jet", qty: "1 lot", amount: money(95) },
          { name: "Camera inspection", qty: "optional", amount: money(120) },
          { name: "Labour — clear & test", qty: "1.5 h", amount: money(195) },
        ],
      },
      {
        id: "kitchen",
        label: "Kitchen plumbing fit-off",
        labourHours: 4,
        lines: [
          { name: "Sink + tap package", qty: "1 set", amount: money(380) },
          { name: "Dishwasher isolator", qty: "1 ea", amount: money(65) },
          { name: "Waste & water rough-in", qty: "1 lot", amount: money(240) },
          { name: "Labour — fit-off", qty: "4 h", amount: money(520) },
        ],
      },
    ],
    quoteFields: [
      { id: "fixtures", label: "Fixtures", mockLine: "Wall-hung toilet suite", mockQty: "1 ea", mockAmount: 640 },
      { id: "pipes", label: "Pipe runs", mockLine: "20 mm copper hot run", mockQty: "8 m", mockAmount: 168 },
      { id: "fittings", label: "Fittings / valves", mockLine: "Isolation + tempering valves", mockQty: "1 lot", mockAmount: 145 },
      { id: "labour", label: "Labour hours", mockLine: "Rough-in labour", mockQty: "6 h", mockAmount: 780 },
      { id: "callout", label: "Call-out", mockLine: "Service call-out", mockQty: "1 ea", mockAmount: 120 },
      { id: "margin", label: "Margin", mockLine: "Residential margin (+6%)", mockQty: "applied", mockAmount: 0 },
    ],
  },

  carpenter: {
    slang: "chippies",
    heroAlt: "Chippie framing a residential interior fit-out",
    supportAlt: "Residential framing site after the measure and quote",
    compliance: {
      badge: "Take-off",
      title: "Timber take-offs that match the quote",
      body: "Keep framing and decking take-offs with the priced scope — lengths, waste factor, and fixings — so the job board matches what you sold, not a second guess later.",
    },
    demoJobs: [
      {
        id: "deck",
        label: "Decking build",
        labourHours: 24,
        lines: [
          { name: "Treated pine joists / bearers", qty: "1 lot", amount: money(1480) },
          { name: "Decking boards", qty: "42 m²", amount: money(2100) },
          { name: "Fixings & connectors", qty: "1 lot", amount: money(320) },
          { name: "Labour — frame & lay", qty: "24 h", amount: money(2640) },
        ],
      },
      {
        id: "framing",
        label: "Framing package",
        labourHours: 32,
        lines: [
          { name: "Wall frames package", qty: "1 lot", amount: money(3200) },
          { name: "Lintels & bracing", qty: "1 lot", amount: money(680) },
          { name: "Fixings", qty: "1 lot", amount: money(240) },
          { name: "Labour — stand & fix", qty: "32 h", amount: money(3520) },
        ],
      },
      {
        id: "doors",
        label: "Door & window install",
        labourHours: 8,
        lines: [
          { name: "Internal doors supply", qty: "6 ea", amount: money(900) },
          { name: "Jambs & hardware", qty: "6 sets", amount: money(420) },
          { name: "Labour — hang & adjust", qty: "8 h", amount: money(880) },
          { name: "Architraves", qty: "1 lot", amount: money(260) },
        ],
      },
      {
        id: "pergola",
        label: "Pergola / outdoor frame",
        labourHours: 16,
        lines: [
          { name: "Posts & beams", qty: "1 lot", amount: money(1100) },
          { name: "Rafters / battens", qty: "1 lot", amount: money(640) },
          { name: "Fixings & brackets", qty: "1 lot", amount: money(180) },
          { name: "Labour — build", qty: "16 h", amount: money(1760) },
        ],
      },
    ],
    quoteFields: [
      { id: "timber", label: "Timber runs", mockLine: "90×45 MGP10 studs", mockQty: "48 lm", mockAmount: 384 },
      { id: "doors", label: "Doors", mockLine: "Flush door + jamb", mockQty: "1 ea", mockAmount: 185 },
      { id: "fixings", label: "Fixings", mockLine: "Structural screws & brackets", mockQty: "1 lot", mockAmount: 95 },
      { id: "labour", label: "Labour hours", mockLine: "Carpentry labour", mockQty: "8 h", mockAmount: 880 },
      { id: "waste", label: "Waste factor", mockLine: "Timber waste (+10%)", mockQty: "applied", mockAmount: 0 },
      { id: "margin", label: "Margin", mockLine: "Residential margin (+6%)", mockQty: "applied", mockAmount: 0 },
    ],
  },

  roofer: {
    slang: "roofers",
    heroAlt: "Roofer on tin scoping a residential re-roof",
    supportAlt: "Residential roof line ready for sheet and flashing measure",
    compliance: {
      badge: "SWMS",
      title: "Height work SWMS / JSA with the job",
      body: "Keep SWMS and height-work notes against the quote so your crew sees the same scope you sold — scaffold allowances included, not buried in a text thread.",
    },
    demoJobs: [
      {
        id: "reroof",
        label: "Metal re-roof",
        labourHours: 40,
        lines: [
          { name: "Colorbond sheets", qty: "180 m²", amount: money(5400) },
          { name: "Battens & fixings", qty: "1 lot", amount: money(980) },
          { name: "Ridge & flashings", qty: "1 lot", amount: money(720) },
          { name: "Labour — strip & lay", qty: "40 h", amount: money(4400) },
        ],
      },
      {
        id: "gutters",
        label: "Gutter & fascia",
        labourHours: 12,
        lines: [
          { name: "Quad gutter", qty: "48 m", amount: money(960) },
          { name: "Fascia / barges", qty: "1 lot", amount: money(540) },
          { name: "Downpipes", qty: "4 ea", amount: money(320) },
          { name: "Labour — install", qty: "12 h", amount: money(1320) },
        ],
      },
      {
        id: "leak",
        label: "Leak repair",
        labourHours: 3,
        lines: [
          { name: "Call-out / diagnose", qty: "1 ea", amount: money(160) },
          { name: "Flashing / sealant", qty: "1 lot", amount: money(85) },
          { name: "Sheet patch", qty: "as req.", amount: money(120) },
          { name: "Labour — repair", qty: "3 h", amount: money(330) },
        ],
      },
      {
        id: "tile-repair",
        label: "Tile roof repair",
        labourHours: 5,
        lines: [
          { name: "Replacement tiles", qty: "24 ea", amount: money(216) },
          { name: "Sarking / battens", qty: "1 lot", amount: money(140) },
          { name: "Labour — replace & bed", qty: "5 h", amount: money(550) },
          { name: "Ridge pointing", qty: "8 m", amount: money(160) },
        ],
      },
    ],
    quoteFields: [
      { id: "area", label: "Roof area", mockLine: "Metal roof cover", mockQty: "160 m²", mockAmount: 4800 },
      { id: "material", label: "Sheet / material", mockLine: "Colorbond Custom Orb", mockQty: "160 m²", mockAmount: 0 },
      { id: "flashings", label: "Flashings", mockLine: "Apron & barge flashings", mockQty: "1 lot", mockAmount: 480 },
      { id: "labour", label: "Labour days", mockLine: "Roofing crew labour", mockQty: "3 days", mockAmount: 3600 },
      { id: "scaffold", label: "Scaffold allowance", mockLine: "Scaffold / edge protection", mockQty: "1 lot", mockAmount: 900 },
      { id: "margin", label: "Margin", mockLine: "Residential margin (+6%)", mockQty: "applied", mockAmount: 0 },
    ],
  },

  painter: {
    slang: "painters",
    heroAlt: "Painter cutting in on a residential interior repaint",
    supportAlt: "Interior walls prepped and ready for coats",
    compliance: {
      badge: "Prep",
      title: "Prep notes that protect the margin",
      body: "Scope prep levels and plaster repairs on the quote so clients see why the number is what it is — and you are not absorbing surprises for free.",
    },
    demoJobs: [
      {
        id: "interior",
        label: "Interior house repaint",
        labourHours: 36,
        lines: [
          { name: "Wash & Wear low sheen", qty: "40 L", amount: money(720) },
          { name: "Primer / sealer", qty: "15 L", amount: money(240) },
          { name: "Prep & fill allowance", qty: "1 lot", amount: money(380) },
          { name: "Labour — walls & ceilings", qty: "36 h", amount: money(3240) },
        ],
      },
      {
        id: "exterior",
        label: "Exterior house paint",
        labourHours: 48,
        lines: [
          { name: "Exterior acrylic", qty: "60 L", amount: money(1080) },
          { name: "Prep / scrape / sand", qty: "1 lot", amount: money(650) },
          { name: "Labour — exterior", qty: "48 h", amount: money(4320) },
          { name: "Fascia & trim", qty: "1 lot", amount: money(420) },
        ],
      },
      {
        id: "feature",
        label: "Feature wall",
        labourHours: 4,
        lines: [
          { name: "Feature colour paint", qty: "4 L", amount: money(95) },
          { name: "Prep & tape", qty: "1 lot", amount: money(60) },
          { name: "Labour — cut & roll", qty: "4 h", amount: money(360) },
          { name: "Touch-up kit", qty: "1 ea", amount: money(25) },
        ],
      },
      {
        id: "newbuild",
        label: "New build paint package",
        labourHours: 60,
        lines: [
          { name: "Full house paint package", qty: "1 lot", amount: money(2800) },
          { name: "Ceiling flat", qty: "30 L", amount: money(390) },
          { name: "Labour — full package", qty: "60 h", amount: money(5400) },
          { name: "Door & trim enamel", qty: "12 L", amount: money(288) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  tiler: {
    slang: "tilers",
    heroAlt: "Tiler setting floor tiles on a residential wet area",
    supportAlt: "Interior surface ready for tile layout and waterproofing",
    compliance: {
      badge: "WWC",
      title: "Waterproofing certificates upfront",
      body: "Call out waterproofing and wet-area compliance on the quote so builders and homeowners know the job is covered — before they tap accept.",
    },
    demoJobs: [
      {
        id: "bathroom-floor",
        label: "Bathroom floor & walls",
        labourHours: 18,
        lines: [
          { name: "Porcelain tiles supply", qty: "22 m²", amount: money(990) },
          { name: "Waterproofing membrane", qty: "1 lot", amount: money(420) },
          { name: "Adhesive, grout, trim", qty: "1 lot", amount: money(280) },
          { name: "Labour — set & grout", qty: "18 h", amount: money(1980) },
        ],
      },
      {
        id: "splashback",
        label: "Kitchen splashback",
        labourHours: 5,
        lines: [
          { name: "Splashback tiles", qty: "4.5 m²", amount: money(270) },
          { name: "Adhesive & grout", qty: "1 lot", amount: money(85) },
          { name: "Labour — set", qty: "5 h", amount: money(550) },
          { name: "Trim / endpoints", qty: "1 lot", amount: money(60) },
        ],
      },
      {
        id: "outdoor",
        label: "Outdoor paving",
        labourHours: 16,
        lines: [
          { name: "Pavers supply", qty: "28 m²", amount: money(1120) },
          { name: "Bedding sand / adhesive", qty: "1 lot", amount: money(240) },
          { name: "Labour — lay", qty: "16 h", amount: money(1760) },
          { name: "Edge restraints", qty: "1 lot", amount: money(180) },
        ],
      },
      {
        id: "ensuite",
        label: "Ensuite refresh",
        labourHours: 12,
        lines: [
          { name: "Wall & floor tiles", qty: "14 m²", amount: money(630) },
          { name: "Waterproofing redo", qty: "1 lot", amount: money(380) },
          { name: "Labour — strip & reset", qty: "12 h", amount: money(1320) },
          { name: "Niche & trim", qty: "1 lot", amount: money(160) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  landscaper: {
    slang: "landscapers",
    heroAlt: "Lawn care and landscaping work on a residential yard",
    supportAlt: "Fresh turf and outdoor landscaping finish",
    compliance: {
      badge: "Scope",
      title: "Clear inclusions before the dig",
      body: "Separate softscape, hardscape, and hire so clients know what is in — and what needs a variation if the soil turns nasty.",
    },
    demoJobs: [
      {
        id: "garden",
        label: "Garden makeover",
        labourHours: 20,
        lines: [
          { name: "Plants & mulch", qty: "1 lot", amount: money(1200) },
          { name: "Soil & compost", qty: "4 m³", amount: money(320) },
          { name: "Labour — plant & finish", qty: "20 h", amount: money(1800) },
          { name: "Edging", qty: "24 m", amount: money(360) },
        ],
      },
      {
        id: "retaining",
        label: "Retaining wall",
        labourHours: 28,
        lines: [
          { name: "Sleepers / blocks", qty: "1 lot", amount: money(2400) },
          { name: "Drainage gravel", qty: "1 lot", amount: money(380) },
          { name: "Labour — build", qty: "28 h", amount: money(2520) },
          { name: "Machine hire", qty: "1 day", amount: money(450) },
        ],
      },
      {
        id: "turf",
        label: "Turf lay",
        labourHours: 8,
        lines: [
          { name: "Instant turf", qty: "80 m²", amount: money(960) },
          { name: "Soil prep", qty: "1 lot", amount: money(280) },
          { name: "Labour — lay & roll", qty: "8 h", amount: money(720) },
          { name: "Starter fertiliser", qty: "1 lot", amount: money(65) },
        ],
      },
      {
        id: "paving",
        label: "Path & patio paving",
        labourHours: 18,
        lines: [
          { name: "Pavers", qty: "22 m²", amount: money(990) },
          { name: "Base & bedding", qty: "1 lot", amount: money(420) },
          { name: "Labour — lay", qty: "18 h", amount: money(1620) },
          { name: "Edge restraints", qty: "1 lot", amount: money(160) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  arborist: {
    slang: "arborists",
    heroAlt: "Arborist in the canopy with harness and chainsaw",
    supportAlt: "Arborist pruning at height on a residential property",
    compliance: {
      badge: "SWMS",
      title: "SWMS / JSA for height and chipper work",
      body: "Attach height-work and plant SWMS notes to the quote so your crew and the client see the same risk controls you priced around.",
    },
    demoJobs: [
      {
        id: "removal",
        label: "Tree removal",
        labourHours: 10,
        lines: [
          { name: "Climbing / dismantle crew", qty: "1 day", amount: money(1400) },
          { name: "Chipper & truck", qty: "1 day", amount: money(480) },
          { name: "Stump grind", qty: "1 ea", amount: money(220) },
          { name: "Disposal", qty: "1 lot", amount: money(180) },
        ],
      },
      {
        id: "prune",
        label: "Canopy prune",
        labourHours: 6,
        lines: [
          { name: "Climbing prune", qty: "1 tree", amount: money(680) },
          { name: "Ground crew", qty: "4 h", amount: money(320) },
          { name: "Green waste", qty: "1 lot", amount: money(120) },
          { name: "Traffic / access", qty: "as req.", amount: money(90) },
        ],
      },
      {
        id: "stump",
        label: "Stump grind",
        labourHours: 2,
        lines: [
          { name: "Stump grind", qty: "1 ea", amount: money(180) },
          { name: "Backfill & turf", qty: "1 lot", amount: money(65) },
          { name: "Call-out", qty: "1 ea", amount: money(95) },
          { name: "Labour", qty: "2 h", amount: money(180) },
        ],
      },
      {
        id: "multi",
        label: "Multi-tree package",
        labourHours: 16,
        lines: [
          { name: "Three-tree prune package", qty: "1 lot", amount: money(2100) },
          { name: "Chipper day", qty: "1 day", amount: money(480) },
          { name: "Crew labour", qty: "16 h", amount: money(1440) },
          { name: "Disposal", qty: "1 lot", amount: money(260) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  concreter: {
    slang: "concreters",
    heroAlt: "Concreter on a residential slab and path pour",
    supportAlt: "Residential site set for formwork and pour",
    compliance: {
      badge: "Pour",
      title: "Pour specs on the quote",
      body: "Lock thickness, steel, and finish type on the quote so variations are clear when the site changes — not argued after the pour.",
    },
    demoJobs: [
      {
        id: "path",
        label: "Concrete path",
        labourHours: 8,
        lines: [
          { name: "N20 concrete", qty: "2.4 m³", amount: money(720) },
          { name: "Mesh & bar chairs", qty: "1 lot", amount: money(180) },
          { name: "Formwork", qty: "1 lot", amount: money(140) },
          { name: "Labour — form & finish", qty: "8 h", amount: money(880) },
        ],
      },
      {
        id: "slab",
        label: "Shed / garage slab",
        labourHours: 16,
        lines: [
          { name: "N25 concrete", qty: "8 m³", amount: money(2400) },
          { name: "SL82 mesh", qty: "1 lot", amount: money(420) },
          { name: "Pump hire", qty: "1 ea", amount: money(380) },
          { name: "Labour — pour & finish", qty: "16 h", amount: money(1760) },
        ],
      },
      {
        id: "driveway",
        label: "Driveway",
        labourHours: 20,
        lines: [
          { name: "Concrete supply", qty: "12 m³", amount: money(3600) },
          { name: "Steel & prep", qty: "1 lot", amount: money(680) },
          { name: "Labour — pour", qty: "20 h", amount: money(2200) },
          { name: "Expansion joints", qty: "1 lot", amount: money(160) },
        ],
      },
      {
        id: "patio",
        label: "Patio slab",
        labourHours: 12,
        lines: [
          { name: "Concrete", qty: "5 m³", amount: money(1500) },
          { name: "Mesh", qty: "1 lot", amount: money(240) },
          { name: "Labour", qty: "12 h", amount: money(1320) },
          { name: "Edge finish", qty: "1 lot", amount: money(120) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  fencer: {
    slang: "fencers",
    heroAlt: "Fencer installing a residential ColorBond boundary fence",
    supportAlt: "Residential boundary line ready for posts and panels",
    compliance: {
      badge: "Boundary",
      title: "Boundary & neighbour notes on the quote",
      body: "Capture shared-boundary assumptions and removal allowances so the accept portal matches what you agreed over the fence.",
    },
    demoJobs: [
      {
        id: "colorbond",
        label: "ColorBond fence",
        labourHours: 14,
        lines: [
          { name: "ColorBond panels", qty: "28 m", amount: money(1680) },
          { name: "Posts & caps", qty: "15 ea", amount: money(525) },
          { name: "Labour — dig & stand", qty: "14 h", amount: money(1260) },
          { name: "Concrete for posts", qty: "1 lot", amount: money(180) },
        ],
      },
      {
        id: "timber",
        label: "Timber paling fence",
        labourHours: 16,
        lines: [
          { name: "Palings & rails", qty: "30 m", amount: money(1350) },
          { name: "Posts", qty: "16 ea", amount: money(480) },
          { name: "Labour", qty: "16 h", amount: money(1440) },
          { name: "Old fence removal", qty: "1 lot", amount: money(320) },
        ],
      },
      {
        id: "gate",
        label: "Gate install",
        labourHours: 4,
        lines: [
          { name: "Gate supply", qty: "1 ea", amount: money(420) },
          { name: "Hardware", qty: "1 lot", amount: money(85) },
          { name: "Labour — hang", qty: "4 h", amount: money(360) },
          { name: "Post upgrade", qty: "as req.", amount: money(120) },
        ],
      },
      {
        id: "repair",
        label: "Fence repair run",
        labourHours: 5,
        lines: [
          { name: "Panels / palings", qty: "6 m", amount: money(240) },
          { name: "Posts", qty: "2 ea", amount: money(90) },
          { name: "Labour", qty: "5 h", amount: money(450) },
          { name: "Call-out", qty: "1 ea", amount: money(95) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  aircon: {
    slang: "AC techs",
    heroAlt: "Air conditioning tech installing a residential split system",
    supportAlt: "Technician scoping a wall-mounted split install",
    compliance: {
      badge: "ARC",
      title: "Electrical & refrigerant notes on scope",
      body: "Keep isolator, pipe length, and commissioning notes on the quote so the homeowner sees a complete install — not a call-back bill.",
    },
    demoJobs: [
      {
        id: "split",
        label: "Split system install",
        labourHours: 4,
        lines: [
          { name: "2.5 kW split supply", qty: "1 ea", amount: money(980) },
          { name: "Mounts & pipe set", qty: "1 lot", amount: money(220) },
          { name: "Electrical isolator", qty: "1 ea", amount: money(95) },
          { name: "Labour — install & commission", qty: "4 h", amount: money(440) },
        ],
      },
      {
        id: "multi",
        label: "Multi-head install",
        labourHours: 10,
        lines: [
          { name: "Multi outdoor + 3 heads", qty: "1 set", amount: money(4200) },
          { name: "Pipe & mounts", qty: "1 lot", amount: money(680) },
          { name: "Electrical", qty: "1 lot", amount: money(320) },
          { name: "Labour", qty: "10 h", amount: money(1100) },
        ],
      },
      {
        id: "service",
        label: "Service / clean",
        labourHours: 1.5,
        lines: [
          { name: "Service call-out", qty: "1 ea", amount: money(140) },
          { name: "Filter / coil clean", qty: "1 ea", amount: money(85) },
          { name: "Labour", qty: "1.5 h", amount: money(165) },
          { name: "Gas top-up", qty: "if req.", amount: money(120) },
        ],
      },
      {
        id: "ducted",
        label: "Ducted quote package",
        labourHours: 24,
        lines: [
          { name: "Ducted system supply", qty: "1 lot", amount: money(6500) },
          { name: "Ducting & vents", qty: "1 lot", amount: money(1800) },
          { name: "Electrical", qty: "1 lot", amount: money(650) },
          { name: "Labour — install", qty: "24 h", amount: money(2640) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  surveyor: {
    slang: "surveyors",
    heroAlt: "Survey gear set out on a residential building site",
    supportAlt: "Residential site ready for set-out and identification survey",
    compliance: {
      badge: "Plan",
      title: "Deliverables named on the quote",
      body: "Spell out survey type, plans, and turnaround so clients accept a clear scope — not a vague site visit fee.",
    },
    demoJobs: [
      {
        id: "identsurvey",
        label: "Identification survey",
        labourHours: 4,
        lines: [
          { name: "Site visit & measure", qty: "1 ea", amount: money(650) },
          { name: "Plan drafting", qty: "1 ea", amount: money(420) },
          { name: "Travel", qty: "1 lot", amount: money(85) },
          { name: "Title search", qty: "as req.", amount: money(60) },
        ],
      },
      {
        id: "setout",
        label: "Building set-out",
        labourHours: 5,
        lines: [
          { name: "Set-out visit", qty: "1 ea", amount: money(780) },
          { name: "Pegs & marks", qty: "1 lot", amount: money(120) },
          { name: "Drafting / cert", qty: "1 ea", amount: money(350) },
          { name: "Travel", qty: "1 lot", amount: money(95) },
        ],
      },
      {
        id: "contour",
        label: "Contour / detail survey",
        labourHours: 8,
        lines: [
          { name: "Field survey", qty: "1 day", amount: money(1200) },
          { name: "CAD drafting", qty: "1 lot", amount: money(680) },
          { name: "Travel", qty: "1 lot", amount: money(110) },
          { name: "Rush fee", qty: "optional", amount: money(200) },
        ],
      },
      {
        id: "reestablish",
        label: "Boundary re-establishment",
        labourHours: 6,
        lines: [
          { name: "Boundary survey", qty: "1 ea", amount: money(980) },
          { name: "Pegs", qty: "1 lot", amount: money(150) },
          { name: "Plan", qty: "1 ea", amount: money(420) },
          { name: "Travel", qty: "1 lot", amount: money(90) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },

  custom: {
    slang: "specialist trades",
    heroAlt: "Specialist tradie on a residential job scoping the work",
    supportAlt: "Specialist trade work measured and ready to price",
    compliance: {
      badge: "Notes",
      title: "Your compliance notes, on the quote",
      body: "Add licences, certificates, and job-specific paperwork as notes or lines so accept and job handover stay tidy.",
    },
    demoJobs: [
      {
        id: "callout",
        label: "Service call-out",
        labourHours: 2,
        lines: [
          { name: "Call-out", qty: "1 ea", amount: money(140) },
          { name: "Labour", qty: "2 h", amount: money(220) },
          { name: "Materials", qty: "as used", amount: money(85) },
          { name: "Travel", qty: "1 lot", amount: money(45) },
        ],
      },
      {
        id: "package",
        label: "Scoped package job",
        labourHours: 8,
        lines: [
          { name: "Labour package", qty: "8 h", amount: money(880) },
          { name: "Materials", qty: "1 lot", amount: money(420) },
          { name: "Consumables", qty: "1 lot", amount: money(65) },
          { name: "Notes / certs", qty: "included", amount: money(0) },
        ],
      },
      {
        id: "variation",
        label: "Variation / extras",
        labourHours: 3,
        lines: [
          { name: "Extra labour", qty: "3 h", amount: money(330) },
          { name: "Extra materials", qty: "1 lot", amount: money(180) },
          { name: "Call-out", qty: "1 ea", amount: money(95) },
          { name: "Travel", qty: "1 lot", amount: money(40) },
        ],
      },
      {
        id: "repeat",
        label: "Repeat residential",
        labourHours: 5,
        lines: [
          { name: "Labour", qty: "5 h", amount: money(550) },
          { name: "Materials from book", qty: "1 lot", amount: money(260) },
          { name: "Margin", qty: "applied", amount: money(0) },
          { name: "Travel", qty: "1 lot", amount: money(50) },
        ],
      },
    ],
    quoteFields: [
      { id: "packages", label: "Packages from your book", mockLine: "Starter package lines", mockQty: "1 pkg", mockAmount: 0 },
      { id: "materials", label: "Materials search", mockLine: "Materials from your book", mockQty: "as scoped", mockAmount: 420 },
      { id: "labour", label: "Labour hours", mockLine: "On-site labour", mockQty: "8 h", mockAmount: 680 },
      { id: "customer", label: "Customer tier markup", mockLine: "Residential margin", mockQty: "applied", mockAmount: 0 },
      { id: "jobsize", label: "Job size adjustment", mockLine: "Day-rate adjustment", mockQty: "applied", mockAmount: 0 },
      { id: "drawings", label: "Drawings & photos", mockLine: "Plan / site photo markup", mockQty: "attached", mockAmount: 0 },
    ],
  },
};
