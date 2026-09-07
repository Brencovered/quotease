/**
 * lib/tradeNameKeywords.ts
 * --------------------------
 * Keyword lists used to filter the ABN Bulk Extract (millions of
 * businesses of every kind) down to ones whose legal/trading name
 * suggests they're actually a relevant trade business. The ABN
 * dataset has no industry classification field in the public extract
 * (see lib/abnBulkIngest.ts) - name keyword matching is the only free
 * way to filter it, so it's a genuinely different, cruder tool than
 * the TRADE_SERVICE_KEYWORDS in lib/websiteScraper.ts (which matches
 * services *within* a page we already know is the right business).
 * False positives are possible (a business named "Electra Consulting"
 * would match "electr" even though it's not an electrician) - kept
 * deliberately narrower/more specific than a loose substring match
 * would allow, to keep the false-positive rate down.
 */

export const TRADE_NAME_KEYWORDS: Record<string, string[]> = {
  electrician: ["electric", "electrical"],
  plumber: ["plumbing", "plumber"],
  carpenter: ["carpentry", "carpenter", "joinery"],
  roofer: ["roofing", "roofer"],
  painter: ["painting", "painter", "decorating"],
  tiler: ["tiling", "tiler"],
  landscaper: ["landscaping", "landscape"],
  builder: ["building contractor", "builders", "construction"],
  concreter: ["concreting", "concreter", "concrete"],
  plasterer: ["plastering", "plasterer"],
  airconditioning: ["air conditioning", "air-conditioning", "aircon", "refrigeration"],
  solar: ["solar power", "solar energy", "solar electrical"],
  locksmith: ["locksmith"],
  glazier: ["glazing", "glazier", "glass"],
  fencer: ["fencing"],
};
