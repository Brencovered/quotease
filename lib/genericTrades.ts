// Generic trade templates - labour + materials model
// Used for all trades that don't have a dedicated calc engine

export interface GenericLineItem {
  id: string;
  label: string;
  qty: number;
  unit: string;       // "hr", "m", "sqm", "ea", "lm", "day", "item"
  unit_cost: number;
  is_labour: boolean;
}

export interface GenericIntake {
  jobType: string;
  description: string;
  lineItems: GenericLineItem[];
  siteAccess: "easy" | "moderate" | "difficult";
  notes?: string;
}

export interface GenericQuoteResult {
  labourHours: number;
  materialsCost: number;
  totalCost: number;
}

export function calcGenericQuote(
  intake: GenericIntake,
  marginPct: number
): GenericQuoteResult {
  let labourTotal = 0;
  let materialsTotal = 0;
  let labourHours = 0;

  const siteMult = intake.siteAccess === "easy" ? 1 : intake.siteAccess === "moderate" ? 1.1 : 1.25;

  for (const item of intake.lineItems) {
    const lineTotal = item.qty * item.unit_cost;
    if (item.is_labour) {
      labourTotal += lineTotal * siteMult;
      if (item.unit === "hr") labourHours += item.qty * siteMult;
    } else {
      materialsTotal += lineTotal;
    }
  }

  const matWithMargin = materialsTotal * (1 + marginPct / 100);
  return {
    labourHours:   Math.round(labourHours * 10) / 10,
    materialsCost: Math.round(matWithMargin),
    totalCost:     Math.round(labourTotal + matWithMargin),
  };
}

// Default templates per trade
export const GENERIC_TRADE_TEMPLATES: Record<string, {
  label: string;
  jobTypes: string[];
  defaultItems: Omit<GenericLineItem, "id">[];
}> = {
  painter: {
    label: "Painter",
    jobTypes: ["Interior repaint", "Exterior repaint", "New build", "Feature walls", "Trim & doors", "Fence painting"],
    defaultItems: [
      { label: "Labour", qty: 8, unit: "hr", unit_cost: 75, is_labour: true },
      { label: "Interior paint (10L)", qty: 2, unit: "ea", unit_cost: 85, is_labour: false },
      { label: "Primer / undercoat (10L)", qty: 1, unit: "ea", unit_cost: 65, is_labour: false },
      { label: "Brushes, rollers, drop sheets", qty: 1, unit: "item", unit_cost: 45, is_labour: false },
      { label: "Masking tape & prep materials", qty: 1, unit: "item", unit_cost: 20, is_labour: false },
    ],
  },
  tiler: {
    label: "Tiler",
    jobTypes: ["Bathroom floor & wall", "Kitchen splashback", "Laundry", "Outdoor paving", "Pool surrounds", "Feature wall"],
    defaultItems: [
      { label: "Labour", qty: 8, unit: "hr", unit_cost: 80, is_labour: true },
      { label: "Floor tiles (per sqm)", qty: 10, unit: "sqm", unit_cost: 45, is_labour: false },
      { label: "Wall tiles (per sqm)", qty: 8, unit: "sqm", unit_cost: 50, is_labour: false },
      { label: "Tile adhesive (20kg bag)", qty: 2, unit: "ea", unit_cost: 35, is_labour: false },
      { label: "Grout (per bag)", qty: 2, unit: "ea", unit_cost: 18, is_labour: false },
      { label: "Tile spacers & accessories", qty: 1, unit: "item", unit_cost: 15, is_labour: false },
    ],
  },
  landscaper: {
    label: "Landscaper",
    jobTypes: ["Garden design & install", "Retaining wall", "Paving", "Turf laying", "Irrigation", "Drainage", "Mulching"],
    defaultItems: [
      { label: "Labour", qty: 8, unit: "hr", unit_cost: 75, is_labour: true },
      { label: "Turf (per sqm)", qty: 20, unit: "sqm", unit_cost: 18, is_labour: false },
      { label: "Topsoil (per m3)", qty: 1, unit: "ea", unit_cost: 85, is_labour: false },
      { label: "Mulch (per m3)", qty: 1, unit: "ea", unit_cost: 75, is_labour: false },
      { label: "Plants / shrubs (allowance)", qty: 1, unit: "item", unit_cost: 150, is_labour: false },
      { label: "Irrigation fittings (allowance)", qty: 1, unit: "item", unit_cost: 80, is_labour: false },
    ],
  },
  arborist: {
    label: "Arborist",
    jobTypes: ["Tree removal", "Tree pruning", "Stump grinding", "Hedge trimming", "Emergency storm damage", "Arborist report"],
    defaultItems: [
      { label: "Climbing & rigging labour", qty: 4, unit: "hr", unit_cost: 120, is_labour: true },
      { label: "Ground crew labour", qty: 4, unit: "hr", unit_cost: 75, is_labour: true },
      { label: "Stump grinder hire", qty: 1, unit: "day", unit_cost: 280, is_labour: false },
      { label: "Chipper hire / disposal", qty: 1, unit: "day", unit_cost: 180, is_labour: false },
      { label: "Tip fees (per load)", qty: 1, unit: "ea", unit_cost: 120, is_labour: false },
    ],
  },
  concreter: {
    label: "Concreter",
    jobTypes: ["Driveway", "House slab", "Shed slab", "Pathways", "Exposed aggregate", "Retaining wall footing", "Footings"],
    defaultItems: [
      { label: "Labour", qty: 8, unit: "hr", unit_cost: 85, is_labour: true },
      { label: "Concrete (per m3)", qty: 3, unit: "ea", unit_cost: 220, is_labour: false },
      { label: "Reinforcement mesh", qty: 2, unit: "ea", unit_cost: 85, is_labour: false },
      { label: "Formwork (per LM)", qty: 10, unit: "lm", unit_cost: 12, is_labour: false },
      { label: "Plastic sheeting / DPC", qty: 1, unit: "item", unit_cost: 35, is_labour: false },
      { label: "Pump hire", qty: 1, unit: "day", unit_cost: 450, is_labour: false },
    ],
  },
  fencer: {
    label: "Fencer",
    jobTypes: ["Colorbond fence", "Timber paling fence", "Pool fence", "Retaining wall", "Gate installation", "Farm fencing"],
    defaultItems: [
      { label: "Labour", qty: 6, unit: "hr", unit_cost: 75, is_labour: true },
      { label: "Colorbond panels (per LM)", qty: 10, unit: "lm", unit_cost: 45, is_labour: false },
      { label: "Steel posts (per post)", qty: 5, unit: "ea", unit_cost: 28, is_labour: false },
      { label: "Concrete (post footings)", qty: 5, unit: "ea", unit_cost: 8, is_labour: false },
      { label: "Gate (standard)", qty: 1, unit: "ea", unit_cost: 280, is_labour: false },
      { label: "Hardware & fixings", qty: 1, unit: "item", unit_cost: 45, is_labour: false },
    ],
  },
  aircon: {
    label: "Air conditioning",
    jobTypes: ["Split system supply & install", "Ducted system", "Service & clean", "Repair / fault find", "Commercial install"],
    defaultItems: [
      { label: "Installation labour", qty: 4, unit: "hr", unit_cost: 110, is_labour: true },
      { label: "Split system unit (2.5kW)", qty: 1, unit: "ea", unit_cost: 850, is_labour: false },
      { label: "Copper pipe set (3m)", qty: 1, unit: "ea", unit_cost: 85, is_labour: false },
      { label: "Electrical connection", qty: 1, unit: "item", unit_cost: 120, is_labour: false },
      { label: "Outdoor bracket", qty: 1, unit: "ea", unit_cost: 45, is_labour: false },
      { label: "Drain & pipe lagging", qty: 1, unit: "item", unit_cost: 35, is_labour: false },
    ],
  },
  surveyor: {
    label: "Surveyor",
    jobTypes: ["Feature & level survey", "Boundary survey", "Construction survey", "Peg out", "Subdivision", "Title re-establishment"],
    defaultItems: [
      { label: "Survey labour", qty: 4, unit: "hr", unit_cost: 180, is_labour: true },
      { label: "Field crew (2nd person)", qty: 4, unit: "hr", unit_cost: 120, is_labour: true },
      { label: "Report & plan preparation", qty: 2, unit: "hr", unit_cost: 150, is_labour: true },
      { label: "Survey pegs & markers", qty: 1, unit: "item", unit_cost: 45, is_labour: false },
      { label: "Travel / site allowance", qty: 1, unit: "item", unit_cost: 80, is_labour: false },
    ],
  },
  custom: {
    label: "Custom",
    jobTypes: ["Custom job"],
    defaultItems: [
      { label: "Labour", qty: 4, unit: "hr", unit_cost: 85, is_labour: true },
      { label: "Materials (allowance)", qty: 1, unit: "item", unit_cost: 200, is_labour: false },
    ],
  },
};

export const ALL_TRADES = [
  { key: "electrician", label: "Electrician",      dedicated: true },
  { key: "plumber",     label: "Plumber",           dedicated: true },
  { key: "carpenter",   label: "Carpenter",         dedicated: true },
  { key: "roofer",      label: "Roofer",            dedicated: true },
  { key: "painter",     label: "Painter",           dedicated: false },
  { key: "tiler",       label: "Tiler",             dedicated: false },
  { key: "landscaper",  label: "Landscaper",        dedicated: false },
  { key: "arborist",    label: "Arborist",          dedicated: false },
  { key: "concreter",   label: "Concreter",         dedicated: false },
  { key: "fencer",      label: "Fencer",            dedicated: false },
  { key: "aircon",      label: "Air conditioning",  dedicated: false },
  { key: "surveyor",    label: "Surveyor",          dedicated: false },
  { key: "custom",      label: "Custom",            dedicated: false },
];
