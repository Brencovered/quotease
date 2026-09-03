/**
 * POST /api/admin/blog/assist/draft
 * -----------------------------------
 * Admin-only. Drafts prose for one section, or for a batch of remaining
 * sections in a single Gateway call ("Draft all"). One call per heading was
 * burning the free-tier per-model RPM budget before the last sections ran.
 *
 * Single: { postTitle, keyword, heading, brief, otherHeadings[] }
 * Batch:  { postTitle, keyword, sections: [{ heading, brief }], otherHeadings[] }
 * Output: { text } or { drafts: [{ heading, text }], model }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { generateWithFallback, textModelsFrom } from "@/lib/ai/gateway";
import { aiGatewayHttpStatus, formatAiGatewayError, gatewayRetryAfterSeconds } from "@/lib/ai/formatAiGatewayError";
import { checkRateLimit, rateLimitResponseInit } from "@/lib/rateLimit";
import { splitDraftedSections } from "@/lib/blogDraftSections";

export const maxDuration = 60;

const FORMAT_NOTES = `CONTENT FORMAT this section must follow (plain markdown, no HTML):
- "## " for this section's own H2 heading (include it, as the first line)
- "### " for any sub-headings
- "- " for bullet lists. For a labelled bullet like "Area calculations: notes on that",
  write the label in plain text followed by a colon - do NOT wrap the label in "**" as
  well. The renderer already bolds everything before the first colon in a list item
  automatically, so adding "**" around it too just leaves literal asterisks/duplicate
  markup in the output.
- pipe tables: | Col 1 | Col 2 |
- "> " for a pull quote
- inline links as [text](/path) - only real Swiftscope paths: /features /how-it-works
  /directory /areas /signup /blog/...

STYLE: never use em or en dashes. Punchy, direct, Australian spelling, no filler, no moralising.
Never invent competitor pricing or statistics - if something needs checking, write
"[VERIFY: what to check]" instead of making it up.`;

type SectionIn = { heading: string; brief: string };

function gatewayFail(err: unknown) {
  console.error("[blog-assist/draft] Error:", err);
  const status = aiGatewayHttpStatus(err);
  const retryAfter = status === 429 ? gatewayRetryAfterSeconds(err) : undefined;
  return NextResponse.json(
    { error: formatAiGatewayError(err), retryAfter },
    {
      status,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );
}

function parseBatchSections(raw: unknown): SectionIn[] {
  if (!Array.isArray(raw)) return [];
  const out: SectionIn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const heading = typeof (item as { heading?: unknown }).heading === "string"
      ? (item as { heading: string }).heading.trim()
      : "";
    const brief = typeof (item as { brief?: unknown }).brief === "string"
      ? (item as { brief: string }).brief.trim()
      : "";
    if (heading && brief) out.push({ heading, brief });
    if (out.length >= 8) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const rl = await checkRateLimit(`blog-assist-draft:${userData.user.id}`, 40, 60 * 60 * 1000);
  const rlBlocked = rateLimitResponseInit(rl);
  if (rlBlocked) return NextResponse.json(rlBlocked.body, rlBlocked.init);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postTitle = typeof body.postTitle === "string" ? body.postTitle.trim() : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const otherHeadings = Array.isArray(body.otherHeadings)
    ? body.otherHeadings.filter((h): h is string => typeof h === "string")
    : [];
  const modelOffset = Number.isFinite(Number(body.modelOffset))
    ? Math.floor(Number(body.modelOffset))
    : 0;

  const batch = parseBatchSections(body.sections);
  if (batch.length > 0) {
    return draftBatch({ postTitle, keyword, otherHeadings, modelOffset, batch });
  }

  const heading = typeof body.heading === "string" ? body.heading.trim() : "";
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!heading || !brief) {
    return NextResponse.json({ error: "heading and brief are required" }, { status: 400 });
  }

  const prompt = `Post title: ${postTitle || "(untitled)"}
Target keyword: ${keyword || "(none given)"}
This section's H2: ${heading}
This section must argue: ${brief}
Other sections in the post (for context, don't repeat them): ${otherHeadings.join(" | ") || "(none)"}

Write ONLY this section, starting with the "## ${heading}" line. 150 to 300 words.
Include at least one internal link. No preamble, no sign-off, no explanation of what you did.`;

  try {
    const result = await generateWithFallback({
      models: textModelsFrom(modelOffset),
      system: `You write SEO blog posts for Swiftscope, Australian trade business software.\n\n${FORMAT_NOTES}`,
      prompt,
      maxTokens: 700,
      maxRateLimitHops: 3,
    });
    return NextResponse.json({ text: result.text, model: result.model });
  } catch (err) {
    return gatewayFail(err);
  }
}

async function draftBatch(opts: {
  postTitle: string;
  keyword: string;
  otherHeadings: string[];
  modelOffset: number;
  batch: SectionIn[];
}) {
  const listed = opts.batch
    .map((s, i) => `${i + 1}. H2 exactly: "## ${s.heading}"\n   This section must argue: ${s.brief}`)
    .join("\n");
  const headings = opts.batch.map((s) => s.heading);

  const prompt = `Post title: ${opts.postTitle || "(untitled)"}
Target keyword: ${opts.keyword || "(none given)"}
Outline headings (write every one, in this order, do not skip): ${headings.join(" | ")}

${listed}

Write ALL ${opts.batch.length} sections now. Each section starts with its "## " heading on its own line, then 150 to 300 words. Include at least one internal link per section. No preamble, no sign-off, no explanation of what you did.`;

  try {
    const result = await generateWithFallback({
      models: textModelsFrom(opts.modelOffset),
      system: `You write SEO blog posts for Swiftscope, Australian trade business software.\n\n${FORMAT_NOTES}`,
      prompt,
      maxTokens: Math.min(700 * opts.batch.length, 4500),
      // One successful call drafts the whole post, so try every RPM bucket.
      maxRateLimitHops: textModelsFrom(0).length,
    });

    const drafts = splitDraftedSections(result.text, headings);
    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "The model returned prose but none of the section headings. Try Draft all again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ drafts, model: result.model, text: result.text });
  } catch (err) {
    return gatewayFail(err);
  }
}
