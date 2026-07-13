/**
 * lib/ai/quotePricingExtraction.ts
 * ---------------------------------
 * Onboarding step: a new tradie uploads 3-5 of their own past quotes
 * (PDF or photo), and this extracts line-item descriptions + unit prices
 * so their price book starts populated with their real numbers instead
 * of empty defaults.
 *
 * Modelled on lib/ai/drawingAnalysis.ts's multimodal pattern (file content
 * part + Vercel AI Gateway), but much simpler -- no trade gating, no
 * confidence scoring, just "read this document and pull out priced line
 * items". Deliberately tolerant of messy real-world quote formats (some
 * won't have unit prices, some will just be lump sums) -- items without a
 * usable price are dropped rather than guessed.
 */

import { generateObject, APICallError } from "ai";
import { z } from "zod";
import { MODELS } from "./gateway";

const ExtractedItemSchema = z.object({
  description: z.string().describe("The item or line-item description as written on the quote, cleaned up slightly for readability"),
  unit: z.string().describe("Unit of sale, e.g. 'each', 'hour', 'metre', 'lot' -- infer 'each' if not stated"),
  unit_cost: z.number().describe("The price for one unit, in dollars. If only a line total is given for a quantity, divide it out."),
});

const QuoteExtractionSchema = z.object({
  items: z.array(ExtractedItemSchema).describe("Every priced line item found on this quote. Skip labour-only lines with no clear per-unit material price, and skip subtotals/totals/tax lines."),
});

export type ExtractedPricingItem = z.infer<typeof ExtractedItemSchema>;

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

function buildSystemPrompt(trade: string): string {
  return `You are helping a ${trade} set up their price book from a real quote they've previously sent a customer.
Extract every line item that has a clear per-unit price (materials, fixtures, fittings, named parts, etc).
Skip: subtotals, GST/tax lines, deposit/payment terms, generic "labour" lines with no per-unit price, and boilerplate terms and conditions text.
If a line shows a quantity and a total (e.g. "10 x GPO outlets - $450"), divide to get the per-unit price ($45 each).
Be conservative: if you're not confident an item genuinely has a real, specific price on this document, leave it out rather than guessing.`;
}

/**
 * Extract priced line items from a single quote file (PDF or image).
 * Returns an empty array (not an error) if nothing usable was found --
 * a blank or non-quote document shouldn't block the rest of onboarding.
 */
export async function extractPricingFromQuote(
  base64Data: string,
  mimeType: string,
  trade: string
): Promise<ExtractedPricingItem[]> {
  const system = buildSystemPrompt(trade);
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "file" as const, data: base64Data, mediaType: mimeType },
        { type: "text" as const, text: "Extract the priced line items from this quote." },
      ],
    },
  ];

  for (const model of [MODELS.VISION_PRIMARY, MODELS.VISION_FALLBACK]) {
    try {
      const result = await generateObject({
        model,
        system,
        messages,
        schema: QuoteExtractionSchema,
      });
      return result.object.items.filter((item) => item.unit_cost > 0 && item.description.trim().length > 0);
    } catch (err) {
      const isRetryable =
        err instanceof APICallError && (err.statusCode === undefined || err.statusCode >= 500 || err.statusCode === 429);
      if (!isRetryable || model === MODELS.VISION_FALLBACK) {
        // Last attempt failed, or a non-retryable error (e.g. malformed
        // file) -- don't throw and block the rest of onboarding over one
        // bad upload; just report nothing extracted for this file.
        console.error(`[quote-pricing-extraction] ${model} failed:`, err);
        return [];
      }
      console.warn(`[quote-pricing-extraction] ${model} failed, falling back`);
    }
  }
  return [];
}
