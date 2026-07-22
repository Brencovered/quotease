/**
 * lib/directorySearch.ts
 * -----------------------
 * Makes the "Name or service" search box tolerant of how people actually
 * type, e.g. "urgent plumber", "roofer asap", "need an electrician
 * Brighton" -- rather than one literal substring match against the whole
 * phrase (which almost never exists verbatim in a business's own text).
 *
 * parseSearchQuery():
 *  1. Detects a trade keyword/synonym anywhere in the query and returns it
 *     separately, so it can be applied as a real trade filter
 *     (directory_listing.trades contains X) instead of a fuzzy text match.
 *  2. Strips urgency/filler words ("urgent", "asap", "emergency", "now",
 *     "immediately", "need", "needed", "please", "a", "an") that don't
 *     correspond to anything filterable yet -- there's no live
 *     availability/response-time signal to act on them with, so they're
 *     dropped rather than silently breaking the match.
 *  3. Whatever's left is returned as individual significant words, meant
 *     to be ANDed together (each word must appear somewhere across
 *     business_name/blurb/services_offered, in any order) rather than
 *     requiring the whole original phrase to match verbatim.
 */

const TRADE_KEYWORDS: Record<string, string[]> = {
  electrician:  ["electrician", "electricians", "electrical", "sparky", "sparkies"],
  plumber:      ["plumber", "plumbers", "plumbing"],
  carpenter:    ["carpenter", "carpenters", "carpentry", "joiner", "joinery"],
  roofer:       ["roofer", "roofers", "roofing", "reroof", "reroofing"],
  painter:      ["painter", "painters", "painting"],
  tiler:        ["tiler", "tilers", "tiling"],
  landscaper:   ["landscaper", "landscapers", "landscaping"],
  arborist:     ["arborist", "arborists", "tree lopper", "tree loppers", "tree removal"],
  concreter:    ["concreter", "concreters", "concreting", "concrete"],
  fencer:       ["fencer", "fencers", "fencing"],
  aircon:       ["aircon", "air conditioning", "air-conditioning", "ac", "hvac"],
  surveyor:     ["surveyor", "surveyors", "surveying"],
};

const NOISE_WORDS = new Set([
  "urgent", "asap", "emergency", "now", "immediately", "immediate",
  "need", "needed", "needing", "want", "wanted", "looking", "for",
  "please", "a", "an", "the", "my", "some", "quick", "fast",
]);

export interface ParsedSearchQuery {
  detectedTrade: string | null;
  significantWords: string[];
}

export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  const lower = rawQuery.toLowerCase().trim();

  // Check multi-word trade phrases first (e.g. "tree removal", "air
  // conditioning") before falling back to single-word matching, so they
  // aren't partially consumed by the word-by-word pass below.
  let detectedTrade: string | null = null;
  let remaining = lower;
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    for (const kw of keywords) {
      if (kw.includes(" ") && remaining.includes(kw)) {
        detectedTrade = trade;
        remaining = remaining.replace(kw, " ");
        break;
      }
    }
    if (detectedTrade) break;
  }

  const words = remaining.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  const significantWords: string[] = [];

  for (const word of words) {
    if (NOISE_WORDS.has(word)) continue;

    if (!detectedTrade) {
      const match = Object.entries(TRADE_KEYWORDS).find(([, keywords]) => keywords.includes(word));
      if (match) {
        detectedTrade = match[0];
        continue;
      }
    }

    significantWords.push(word);
  }

  return { detectedTrade, significantWords };
}
