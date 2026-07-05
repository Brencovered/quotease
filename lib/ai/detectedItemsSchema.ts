/**
 * Shared JSON output contract for AI item-detection: used by both
 * analyze-drawing (photos/PDFs) and analyze-voice (voice note transcripts)
 * so a detected item looks the same regardless of which input method found
 * it, and can flow through the same DrawingAnalysisReviewTable either way.
 */
export const DETECTED_ITEMS_SCHEMA = `

After your expert analysis, output a JSON object with these two fields:

{
  "detected_items": [
    { "label": "Downlight", "item_key": "dl", "quantity": <integer>, "unit": "each", "labour_hours": <number> },
    { "label": "Power point (GPO)", "item_key": "gpo", "quantity": <integer>, "unit": "each", "labour_hours": <number> },
    ...
  ],
  "notes": "<verification warnings and caveats in trade vernacular>",
  "confidence": "<high|medium|low>"
}

Rules for detected_items:
- Only include items with quantity > 0
- Collate the same item type into one row (e.g. all downlights = one row with total count)
- Use these item_key values to match the price book:
  dl (downlights), gpo (power points), sw (switches), data (data points),
  exhaust (exhaust fans), smoke (smoke alarms), cable (cable runs, unit=m),
  conduit (conduit runs, unit=m), sb (switchboard), circuit (new circuits),
  tap, toilet, basin, shower, hwu, pipe_cold, pipe_hot, pipe_waste,
  gutter, downpipe, ridge, valley, fascia, skylight, whirlybird, roof_area,
  wall_frame, door, window, skirting, decking
- For metre-based items (cable, conduit, pipe runs, gutters), set unit to "m" and estimate total metres
- For area items (roof sections), set unit to "m2"
- "labour_hours" is your best-practice estimate of TOTAL install time for the row's full quantity
  (not per-unit) -- e.g. 14 downlights at ~0.25hr each = 3.5, a 20m cable run = 1.5, a switchboard
  upgrade = 4. Base it on standard Australian trade productivity rates. Round to the nearest 0.25hr.
  This is a starting estimate the tradie will review and adjust, not the final word -- always include it.

Output ONLY the JSON object. No other text before or after it.`;
