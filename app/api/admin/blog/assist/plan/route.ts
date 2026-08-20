/**
 * POST /api/admin/blog/assist/plan
 * ---------------------------------
 * Admin-only. Takes a target SEO keyword plus a post type and turns it
 * into a structured outline (title, slug, excerpt, category, tags, key
 * takeaways, section headings) that the composer UI hands to the writer.
 * This never writes prose for the body - see assist/draft for that -
 * it only plans structure, so the "words stay yours" framing in the UI
 * stays true even when a section is drafted afterward.
 *
 * Input:  { keyword: string, postType: string, notes?: string }
 * Output: { title, slug, excerpt, category, tags, takeaways[], sections[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { generateObjectWithFallback, MODELS } from "@/lib/ai/gateway";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";

const PlanSchema = z.object({
  title:     z.string().describe("Post title, under 60 characters"),
  slug:      z.string().describe("URL slug, lowercase, hyphenated, under 50 characters"),
  excerpt:   z.string().describe("One-sentence summary, under 155 characters"),
  category:  z.string().describe("One or two words, e.g. Pricing, Industry, Tips & guides"),
  tags:      z.array(z.string()).describe("Three short tags"),
  takeaways: z.array(z.string()).describe("Four or five specific, concrete claims for a Key Takeaways box"),
  sections:  z.array(z.object({
    heading: z.string().describe("The H2 heading text"),
    brief:   z.string().describe("One sentence on what this section argues or covers"),
  })).describe("Four to six sections. At least one must concede something genuinely true in a named competitor's favour."),
});

type Plan = z.infer<typeof PlanSchema>;

const PRODUCT_CONTEXT = `PRODUCT FACTS (use only these, never invent competitor pricing or specifics - if
something else is needed, phrase the brief as a placeholder to verify, not a fabricated claim):
Swiftscope: $45/month flat, unlimited users, unlimited jobs, 7 day trial, no per-user or
per-job fees, directory listing with no per-lead cost, drawing markup built in, Xero integration.
ServiceM8 (for comparison posts): charges by job volume - Free $0 (1 user, 30 jobs), Starter $29
(50 jobs), Growing $79 (150 jobs), Premium $149 (500 jobs), Premium Plus $349 (1500+ jobs),
unlimited users on paid plans.

STYLE: Australian spelling and tone, direct, no filler, no moralising. Never use em or en dashes.
Concede genuine competitor strengths where relevant rather than overselling.`;

function buildSystemPrompt() {
  return `You plan SEO blog posts for Swiftscope, a quoting and job management platform for
Australian trade businesses (electricians, plumbers, carpenters, roofers, and other trades).

${PRODUCT_CONTEXT}

You are planning STRUCTURE only - headings and one-sentence briefs - not writing the post.
The author writes every word themselves; your job is to give them a strong, well-researched
starting skeleton so they aren't facing a blank page.`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const rl = await checkRateLimit(`blog-assist-plan:${userData.user.id}`, 20, 60 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const postType = typeof body.postType === "string" ? body.postType : "practical";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }
  if (keyword.length > 200) {
    return NextResponse.json({ error: "keyword too long (max 200 chars)" }, { status: 400 });
  }

  const POST_TYPE_BRIEFS: Record<string, string> = {
    comparison: "A comparison against a named competitor.",
    practical:  "A practical how-to guide for one specific trade.",
    explainer:  "An explainer on pricing or how something works.",
    data:       "A piece built on Swiftscope's own directory data (listing counts, suburb coverage) rather than external claims.",
  };

  const prompt = `Target keyword: "${keyword}"
Post type: ${POST_TYPE_BRIEFS[postType] ?? postType}
Author's angle (real information or a story only they know, use it if given): ${notes || "(none given - plan around the keyword and product facts alone)"}

Plan 4 to 6 sections.`;

  try {
    const result = await generateObjectWithFallback<Plan>({
      primaryModel:  MODELS.SONNET,
      fallbackModel: MODELS.HAIKU,
      system:        buildSystemPrompt(),
      prompt,
      schema:        PlanSchema,
    });

    return NextResponse.json({ plan: result.object, model: result.model });
  } catch (err) {
    console.error("[blog-assist/plan] Error:", err);
    return NextResponse.json(
      { error: "Planning failed. Please try again." },
      { status: 500 }
    );
  }
}
