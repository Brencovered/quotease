/**
 * lib/tradeLocationMatrix.ts
 * ---------------------------
 * Single source of truth for the trade x location combinations the
 * Yellow Pages scraper covers - used by both the manual admin UI
 * (components/AdminWebsiteScraper.tsx) and the automated directory
 * expansion sweep (lib/directoryExpansionSweep.ts,
 * app/api/cron/expand-directory). Previously only existed inline in
 * the admin component; moved here so the automated sweep can't drift
 * out of sync with what the manual tool actually offers.
 */

export const TRADES = [
  "electrician", "plumber", "carpenter", "roofer", "painter",
  "tiler", "landscaper", "builder", "concreter", "plasterer",
  "airconditioning", "solar", "locksmith", "glazier", "fencer",
] as const;

export interface TradeLocation {
  label: string;
  suburb: string;
  postcode: string;
}

// Major AU suburbs/cities with postcodes for targeted scraping
export const LOCATIONS: TradeLocation[] = [
  // NSW
  { label: "Sydney CBD, NSW",         suburb: "Sydney NSW",          postcode: "2000" },
  { label: "Parramatta, NSW",          suburb: "Parramatta NSW",      postcode: "2150" },
  { label: "Newcastle, NSW",           suburb: "Newcastle NSW",       postcode: "2300" },
  { label: "Wollongong, NSW",          suburb: "Wollongong NSW",      postcode: "2500" },
  { label: "Penrith, NSW",             suburb: "Penrith NSW",         postcode: "2750" },
  { label: "Blacktown, NSW",           suburb: "Blacktown NSW",       postcode: "2148" },
  // VIC
  { label: "Melbourne CBD, VIC",       suburb: "Melbourne VIC",       postcode: "3000" },
  { label: "Geelong, VIC",             suburb: "Geelong VIC",         postcode: "3220" },
  { label: "Ballarat, VIC",            suburb: "Ballarat VIC",        postcode: "3350" },
  { label: "Bendigo, VIC",             suburb: "Bendigo VIC",         postcode: "3550" },
  { label: "Dandenong, VIC",           suburb: "Dandenong VIC",       postcode: "3175" },
  // QLD
  { label: "Brisbane CBD, QLD",        suburb: "Brisbane QLD",        postcode: "4000" },
  { label: "Gold Coast, QLD",          suburb: "Gold Coast QLD",      postcode: "4217" },
  { label: "Sunshine Coast, QLD",      suburb: "Sunshine Coast QLD",  postcode: "4557" },
  { label: "Townsville, QLD",          suburb: "Townsville QLD",      postcode: "4810" },
  { label: "Cairns, QLD",              suburb: "Cairns QLD",          postcode: "4870" },
  { label: "Toowoomba, QLD",           suburb: "Toowoomba QLD",       postcode: "4350" },
  // WA
  { label: "Perth CBD, WA",            suburb: "Perth WA",            postcode: "6000" },
  { label: "Fremantle, WA",            suburb: "Fremantle WA",        postcode: "6160" },
  { label: "Mandurah, WA",             suburb: "Mandurah WA",         postcode: "6210" },
  // SA
  { label: "Adelaide CBD, SA",         suburb: "Adelaide SA",         postcode: "5000" },
  { label: "Mount Gambier, SA",        suburb: "Mount Gambier SA",    postcode: "5290" },
  // TAS
  { label: "Hobart, TAS",              suburb: "Hobart TAS",          postcode: "7000" },
  // NT
  { label: "Darwin, NT",               suburb: "Darwin NT",           postcode: "0800" },
  // ACT
  { label: "Canberra, ACT",            suburb: "Canberra ACT",        postcode: "2600" },
];
