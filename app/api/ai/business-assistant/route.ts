/**
 * POST /api/ai/business-assistant
 * ---------------------------------
 * The tool-calling backend for the "Business assistant" chat widget
 * (components/DashboardChatAssistant.tsx). This is separate from the
 * generic /api/ai/chat passthrough (still used for plain Q&A and the
 * materials Package Assistant) because this one runs a real agentic tool
 * loop with server-side DB access -- it's not just a text-in/text-out
 * proxy to the Anthropic API.
 *
 * Three tools, all resolved server-side so the model never has to invent
 * numbers or guess at what exists in the account:
 *
 *   search_price_book   -- looks up the tradie's own material_items by
 *                           keyword. The model should call this before
 *                           creating a quote draft so item prices are
 *                           real, not guessed.
 *   create_quote_draft  -- creates a real "packages" + "package_items"
 *                           row (the same mechanism the Packages feature
 *                           already uses) from a list of items. Price is
 *                           always resolved server-side from
 *                           material_items by item_key; if an item_key
 *                           doesn't match anything on file, its cost is
 *                           left at 0 and flagged in the label as
 *                           "(EST -- add price)" rather than trusting
 *                           whatever number the model produced. Returns a
 *                           URL the client renders as a button that opens
 *                           the quote builder pre-loaded with these items
 *                           (?package_id=...), landing the tradie exactly
 *                           where the Packages feature already does --
 *                           they still add the client, review pricing,
 *                           and hit send themselves.
 *   suggest_navigation  -- for walking someone through a task that isn't
 *                          "build a quote" (managing a job, checking the
 *                          price book, inviting a team member, etc). Path
 *                          is checked against an allowlist so the model
 *                          can only ever link to real, known pages.
 *
 * Bounded to 4 tool-use round-trips per request so a confused model can't
 * loop forever burning tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/team";
import { markOnboardingMilestone } from "@/lib/onboarding";

const MAX_TOOL_ROUNDS = 4;

const NAV_ALLOWLIST: Record<string, string> = {
  "/electrician": "Start a new quote",
  "/electrician/jobs": "Your jobs",
  "/electrician/quotes": "Your quotes",
  "/electrician/clients": "Your clients",
  "/electrician/schedule": "Schedule",
  "/electrician/margins": "Job costing & margins",
  "/electrician/dashboard": "Dashboard",
  "/electrician/leads": "Leads",
  "/electrician/export": "Xero export",
  "/settings": "Settings",
  "/settings/pricebook": "Price book",
  "/settings/materials": "Materials",
  "/settings/team": "Team",
  "/billing": "Billing",
};

const TOOLS = [
  {
    name: "search_price_book",
    description:
      "Search the tradie's own price book for real items matching a keyword (e.g. 'downlight', 'toilet', 'gutter'). Always use this before create_quote_draft so item prices come from what's actually on file, not a guess.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keyword to search for, e.g. 'downlight' or 'hot water unit'" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_quote_draft",
    description:
      "Creates a draft quote (as a reusable package of priced items) that the tradie can open, edit, add their client's details to, and send. Only call this once you know real item_keys and prices from search_price_book for as many items as possible -- for anything you can't match, still include it with item_key omitted so the tradie can price it themselves, and say so in your reply.",
    input_schema: {
      type: "object" as const,
      properties: {
        trade: { type: "string", description: "The trade this quote is for, e.g. electrician, plumber, carpenter, roofer" },
        title: { type: "string", description: "Short description of the job, e.g. 'Bathroom reno rough-in'" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_key: { type: "string", description: "Exact item_key from a search_price_book result. Omit if no real match exists." },
              label: { type: "string", description: "Item description" },
              quantity: { type: "number" },
              unit: { type: "string", description: "each, m, m2, hr, etc -- default 'ea'" },
              labour_hours: { type: "number", description: "Estimated total install time for this line, in hours" },
            },
            required: ["label", "quantity"],
          },
        },
      },
      required: ["trade", "title", "items"],
    },
  },
  {
    name: "suggest_navigation",
    description:
      `Offer the tradie a button to jump straight to a specific page when walking them through a task. Valid paths: ${Object.keys(NAV_ALLOWLIST).join(", ")}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", enum: Object.keys(NAV_ALLOWLIST) },
        reason: { type: "string", description: "One short sentence on why you're suggesting this" },
      },
      required: ["path"],
    },
  },
];

interface QuoteDraftAction {
  type: "open_quote_draft";
  url: string;
  title: string;
  itemCount: number;
  pricedCount: number;
  estimatedTotal: number;
}
interface NavigateAction {
  type: "navigate";
  url: string;
  label: string;
  reason?: string;
}
type AssistantAction = QuoteDraftAction | NavigateAction;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await getActiveBusinessId(supabase, userData.user.id);

  // Day 6 onboarding milestone -- no other clean signal that someone has
  // actually used the assistant, so record it here. Fire-and-forget: never
  // let this block or fail the real chat response.
  markOnboardingMilestone(supabase, businessId, "ai_assistant_used_at").catch(() => {});

  const { messages, system } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: unknown }[];
    system: string;
  };

  const actions: AssistantAction[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convo: any[] = [...messages];

  async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    if (name === "search_price_book") {
      const query = String(input.query ?? "").trim();
      if (!query) return { items: [] };
      const { data, error } = await supabase
        .from("material_items")
        .select("item_key, label, unit_cost")
        .eq("profile_id", businessId)
        .ilike("label", `%${query}%`)
        .limit(20);
      if (error) return { error: error.message };
      return { items: data ?? [] };
    }

    if (name === "create_quote_draft") {
      const trade = String(input.trade ?? "electrician").toLowerCase().trim();
      const title = String(input.title ?? "Quote").slice(0, 120);
      const rawItems = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : [];

      if (rawItems.length === 0) {
        return { error: "No items provided -- nothing to create." };
      }

      // Resolve real prices server-side. Never trust a price the model
      // might have included -- only item_key -> material_items lookups.
      const keys = rawItems.map((i) => String(i.item_key ?? "")).filter(Boolean);
      const priceMap = new Map<string, number>();
      if (keys.length > 0) {
        const { data: matched } = await supabase
          .from("material_items")
          .select("item_key, unit_cost")
          .eq("profile_id", businessId)
          .in("item_key", keys);
        for (const m of matched ?? []) priceMap.set(m.item_key, Number(m.unit_cost));
      }

      let pricedCount = 0;
      let estimatedTotal = 0;
      let totalHours = 0;
      const itemsToInsert = rawItems.map((raw, idx) => {
        const itemKey = String(raw.item_key ?? "");
        const knownPrice = priceMap.get(itemKey);
        const priced = knownPrice != null;
        if (priced) pricedCount++;
        const qty = Number(raw.quantity) || 1;
        const unitCost = priced ? knownPrice! : 0;
        const hours = Number(raw.labour_hours) || 0;
        totalHours += hours;
        estimatedTotal += qty * unitCost;
        return {
          label: priced ? String(raw.label ?? "Item") : `${String(raw.label ?? "Item")} (EST -- add price)`,
          qty,
          unit: String(raw.unit ?? "ea").slice(0, 20),
          unit_cost: unitCost,
          item_key: priced ? itemKey : null,
          sort_order: idx,
        };
      });

      const { data: pkg, error: pkgError } = await supabase
        .from("packages")
        .insert({
          profile_id: businessId,
          title: `Quote: ${title}`,
          trade,
          description: "Created by the business assistant",
          labour_hours: totalHours,
          status: "active",
        })
        .select("id")
        .single();

      if (pkgError || !pkg) return { error: pkgError?.message ?? "Could not create the quote draft." };

      const { error: itemsError } = await supabase
        .from("package_items")
        .insert(itemsToInsert.map((i) => ({ ...i, package_id: pkg.id })));

      if (itemsError) return { error: itemsError.message };

      const action: QuoteDraftAction = {
        type: "open_quote_draft",
        url: `/electrician?trade=${encodeURIComponent(trade)}&package_id=${pkg.id}`,
        title,
        itemCount: itemsToInsert.length,
        pricedCount,
        estimatedTotal: Math.round(estimatedTotal),
      };
      actions.push(action);

      return {
        created: true,
        itemCount: itemsToInsert.length,
        pricedCount,
        unpricedCount: itemsToInsert.length - pricedCount,
        estimatedMaterialsTotal: Math.round(estimatedTotal),
      };
    }

    if (name === "suggest_navigation") {
      const path = String(input.path ?? "");
      const label = NAV_ALLOWLIST[path];
      if (!label) return { error: "Unknown path, not offered to the user." };
      actions.push({ type: "navigate", url: path, label, reason: typeof input.reason === "string" ? input.reason : undefined });
      return { offered: true };
    }

    return { error: `Unknown tool: ${name}` };
  }

  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system,
        messages: convo,
        tools: TOOLS,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error?.message ?? "AI error" }, { status: 502 });
    }

    const data = await res.json();
    const blocks: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = data.content ?? [];

    const textBlocks = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    if (textBlocks) finalText = textBlocks;

    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0 || data.stop_reason !== "tool_use") {
      break;
    }

    convo.push({ role: "assistant", content: blocks });

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name!, tu.input ?? {});
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    convo.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ text: finalText, actions });
}
