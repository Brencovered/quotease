/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Material {
  id: string;
  description: string;
  sku: string | null;
  supplier: string;
  trade: string;
  unit: string;
  cost_price: number;
  created_at: string;
}

export interface Supplier {
  name: string;
  count: number;
  total_value: number;
}

export interface PackageItem {
  id?: string;
  label: string;
  qty: number;
  unit: string;
  unit_cost: number;
  sort_order: number;
}

export interface Pkg {
  id: string;
  profile_id: string;
  title: string;
  trade: string;
  description: string | null;
  labour_hours: number | null;
  status: string;
  created_at: string;
  package_items?: PackageItem[];
  use_count?: number;
}

export interface PackageRow {
  id: string;
  profile_id: string;
  title: string;
  trade: string;
  description: string | null;
  labour_hours: number | null;
  status: string;
  created_at: string;
  package_items: PackageItem[] | null;
}

export interface PricingTier {
  id: string;
  profile_id: string;
  name: string;
  markup_pct: number;
  sort_order: number;
  created_at: string;
}

export interface JobSizeTier {
  id: string;
  profile_id: string;
  name: string;
  max_days: number | null;
  markup_pct: number;
  sort_order: number;
  created_at: string;
}

export interface BundleItem {
  id: string;
  bundle_id: string;
  label: string;
  qty: number;
  unit: string;
  unit_cost: number;
  sort_order: number;
}

export interface MaterialBundle {
  id: string;
  profile_id: string;
  title: string;
  trade: string;
  description: string | null;
  status: string;
  created_at: string;
  items: BundleItem[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const TRADE_COLORS: Record<string, string> = {
  electrician: "#f59e0b",
  plumber: "#3b82f6",
  carpenter: "#92400e",
  roofer: "#ef4444",
  painter: "#a855f7",
  tiler: "#06b6d4",
  landscaper: "#16a34a",
  concreter: "#71717a",
  fencer: "#854d0e",
  plasterer: "#ec4899",
  handyman: "#0a1722",
};

export const TRADES = [
  { key: "electrician", label: "Electrician" },
  { key: "plumber", label: "Plumber" },
  { key: "carpenter", label: "Carpenter" },
  { key: "roofer", label: "Roofer" },
  { key: "painter", label: "Painter" },
  { key: "tiler", label: "Tiler" },
  { key: "landscaper", label: "Landscaper" },
  { key: "concreter", label: "Concreter" },
  { key: "fencer", label: "Fencer" },
  { key: "plasterer", label: "Plasterer" },
  { key: "handyman", label: "Handyman" },
];

export const UNITS = ["ea", "m", "m2", "m3", "hr", "kg", "each", "box", "roll", "set", "pair", "lot"];

export const DEFAULT_HOURLY_RATE = 95;
export const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function calcItemTotal(item: PackageItem): number {
  return +(item.qty * item.unit_cost).toFixed(2);
}

export function calcPackageTotal(items: PackageItem[], labourHours: number, hourlyRate: number): number {
  const materialsTotal = items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const labourTotal = labourHours * hourlyRate;
  return +(materialsTotal + labourTotal).toFixed(2);
}

export function calcSellPrice(costPrice: number, markupPct: number): number {
  return +(costPrice * (1 + markupPct / 100)).toFixed(2);
}
