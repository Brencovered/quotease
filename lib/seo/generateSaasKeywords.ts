/**
 * lib/seo/generateSaasKeywords.ts
 * --------------------------------
 * Generates keyword ideas for the core product (job management / quoting
 * software for tradies), not the directory. Unlike generateDirectoryKeywords
 * (which mechanically derives from live trade+suburb data), there's no
 * equivalent live dataset to derive SaaS keywords from -- this is a
 * template-based expansion grounded in what Swiftscope actually is: a flat-
 * rate SaaS consolidating tools like ServiceM8, Tradify, Fergus, HiPages,
 * GroundPlan and SimPro for Australian trade businesses (electricians,
 * plumbers, carpenters, roofers, and generic trades).
 *
 * Deliberately not AI-generated -- a fixed, reviewable template list is
 * easier to keep honest (no invented competitor claims, no keywords that
 * don't match what the product actually does) and costs nothing to run
 * repeatedly as the template list grows.
 *
 * Safe to re-run any time: same upsert-with-ignoreDuplicates pattern as
 * generateDirectoryKeywords -- existing keywords (including ones already
 * triaged into Targeting/Tracking/Ignore) are never touched or duplicated.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const TRADES = ["electrician", "plumber", "carpenter", "roofer", "tradie"];
const TRADES_PLURAL: Record<string, string> = {
  electrician: "electricians",
  plumber: "plumbers",
  carpenter: "carpenters",
  roofer: "roofers",
  tradie: "tradies",
};

// The actual named tools Swiftscope consolidates -- kept in sync with
// product_information rather than invented. Only used for genuine
// comparison/alternative-style keywords, not fabricated claims.
const COMPETITORS = ["ServiceM8", "Tradify", "Fergus", "SimPro", "GroundPlan"];

interface KeywordTemplate {
  keyword: string;
  intent: string;
  notes: string;
}

function buildTemplates(): KeywordTemplate[] {
  const templates: KeywordTemplate[] = [];

  // Core product-category terms, plain and trade-specific
  const coreTerms = ["quoting software", "quote software", "quoting app", "job management software", "trade business software"];
  for (const term of coreTerms) {
    templates.push({ keyword: term, intent: "Commercial", notes: "Core product category term" });
    templates.push({ keyword: `${term} australia`, intent: "Commercial", notes: "Core product category term, AU-qualified" });
    templates.push({ keyword: `best ${term} for tradies`, intent: "Commercial", notes: "Core product category term, comparison intent" });
  }

  for (const trade of TRADES) {
    const plural = TRADES_PLURAL[trade];
    templates.push({ keyword: `quoting software for ${plural}`, intent: "Commercial", notes: `Trade-specific: ${trade}` });
    templates.push({ keyword: `quote app for ${plural}`, intent: "Commercial", notes: `Trade-specific: ${trade}` });
    templates.push({ keyword: `job management software for ${plural}`, intent: "Commercial", notes: `Trade-specific: ${trade}` });
    templates.push({ keyword: `${trade} quoting app`, intent: "Commercial", notes: `Trade-specific: ${trade}` });
  }

  // Pricing-led terms -- the flat $45/mo positioning is a real
  // differentiator against per-seat/tiered competitor pricing.
  templates.push({ keyword: "flat rate quoting software", intent: "Commercial", notes: "Pricing differentiator" });
  templates.push({ keyword: "affordable quoting software for tradies", intent: "Commercial", notes: "Pricing differentiator" });
  templates.push({ keyword: "quoting software no per user fee", intent: "Commercial", notes: "Pricing differentiator" });

  // Genuine alternative/comparison terms against the named tools
  // Swiftscope actually consolidates -- never invent a claim about a
  // competitor, just the comparison search pattern itself.
  for (const competitor of COMPETITORS) {
    templates.push({ keyword: `${competitor} alternative`, intent: "Commercial", notes: `Alternative-to search for ${competitor}` });
    templates.push({ keyword: `swiftscope vs ${competitor}`, intent: "Commercial", notes: `Direct comparison search for ${competitor}` });
  }

  // AI-feature-led terms -- genuine product features (drawing/voice/photo
  // analysis for quote building), a real differentiator worth targeting.
  templates.push({ keyword: "ai quoting software tradies", intent: "Commercial", notes: "AI feature differentiator" });
  templates.push({ keyword: "quote from photo app tradies", intent: "Commercial", notes: "AI feature differentiator" });

  return templates;
}

export interface GenerateSaasResult {
  templatesConsidered: number;
  keywordsInserted: number;
  totalTracked: number;
}

export async function generateSaasKeywords(): Promise<GenerateSaasResult> {
  const admin = createAdminClient();

  const templates = buildTemplates();
  const payload = templates.map((t) => ({
    keyword: t.keyword,
    intent: t.intent,
    segment: "saas" as const,
    status: "new" as const,
    notes: t.notes,
  }));

  let keywordsInserted = 0;
  if (payload.length > 0) {
    const { data: inserted, error } = await admin
      .from("seo_keywords")
      .upsert(payload, { onConflict: "keyword", ignoreDuplicates: true })
      .select("id");

    if (error) {
      throw new Error(`[generateSaasKeywords] Insert failed: ${error.message}`);
    }
    keywordsInserted = inserted?.length ?? 0;
  }

  const { count: totalTracked } = await admin
    .from("seo_keywords")
    .select("id", { count: "exact", head: true })
    .eq("segment", "saas");

  return {
    templatesConsidered: templates.length,
    keywordsInserted,
    totalTracked: totalTracked ?? 0,
  };
}
