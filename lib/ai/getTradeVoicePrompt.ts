/**
 * Trade-specific system prompts for turning an on-site voice note transcript
 * into a detected_items list (same shape/schema as drawing analysis, via
 * DETECTED_ITEMS_SCHEMA, so both flow through the same review table).
 *
 * Electrician has its own dedicated fixed-field flow in analyze-voice/route.ts
 * (autofills the intake form directly) and does not use this file -- kept
 * that way deliberately so the existing, working electrician flow is
 * untouched. This file covers every other trade, which previously had no
 * real voice support at all (the route always used the electrician prompt
 * regardless of trade, and the result was thrown away except for a
 * confidence badge).
 */

function framing(tradeLabel: string, focusPoints: string): string {
  return `You are helping a ${tradeLabel} turn a voice note recorded on site into a structured list of quote line items.
They walked around the job describing it out loud -- it will be informal, may go off on tangents, use imprecise
terminology, and mention things out of order. Extract every distinct item and its quantity that you can
confidently infer from what they said.

Focus on:
${focusPoints}

Anything that sounds like scope creep, a variation, or a "while you're here" extra should still be included as
its own detected_items row, but call it out in notes so the tradie follows up on it separately before quoting
it as core scope.

If the transcript doesn't actually describe a ${tradeLabel} job, set confidence to "low" and say so in notes
rather than inventing items.`;
}

const VOICE_PROMPTS: Record<string, string> = {
  plumber: framing("plumber", `- Sanitary fixtures: toilets, basins, baths, showers, laundry tubs, kitchen sinks
- Hot water units: type (gas, electric, heat pump, solar) and capacity if mentioned
- Tap ware, mixers, and isolation valves
- Pipe runs mentioned by length or by room-to-room description (hot, cold, and waste separately)
- Gas fitting work: meter, appliance connections, pipe runs
- Stormwater and drainage: pits, pipes, floor wastes
- Any mention of a switchboard-adjacent trade crossover, backflow prevention, or pressure issues`),

  carpenter: framing("carpenter", `- Framing: walls, floor, or roof framing described by room or area
- Doors and windows: count and rough type (sliding, hinged, bifold) if mentioned
- Decking, skirting, architraves, and other finish carpentry, with rough lineal metres if given
- Structural elements: beams, lintels, posts if mentioned
- Joinery: built-ins, shelving, robes
- Any demolition or removal work mentioned as part of the job`),

  roofer: framing("roofer", `- Roof area by section or in square metres if a figure is given
- Guttering, downpipes, fascia, and lineal metres if mentioned
- Ridge capping, valleys, flashing
- Whirlybirds, skylights, roof vents
- Whether it's a full re-roof, partial repair, or restoration/recoat job
- Any mention of storm damage, leaks, or insurance work`),

  generic: framing("tradie", `- Any distinct item, fixture, or piece of work mentioned, with quantity or area if given
- Materials or products mentioned by name or brand
- Rough measurements (lengths, areas, counts) even if approximate
- Anything described as urgent, a callback, or a separate job while on site`),
};

export function getTradeVoicePrompt(trade: string): string {
  const normalised = trade.toLowerCase().trim();
  if (VOICE_PROMPTS[normalised]) return VOICE_PROMPTS[normalised];
  if (["plumbing", "hydraulics"].includes(normalised)) return VOICE_PROMPTS.plumber;
  if (["builder", "framer", "carpentry", "building"].includes(normalised)) return VOICE_PROMPTS.carpenter;
  if (["roofing", "roof"].includes(normalised)) return VOICE_PROMPTS.roofer;
  return VOICE_PROMPTS.generic;
}
