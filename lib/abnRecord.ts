/**
 * ABR bulk-extract record parser.
 *
 * The public extract is a sequence of <ABR> elements inside large XML
 * files. parseAbrBlock reads one element. takeCompleteAbrBlocks pulls
 * complete elements out of a streaming buffer so a 500MB zip never has
 * to sit in memory as one string.
 */

export interface ParsedAbnRecord {
  abn: string;
  abnStatus: string | null;
  legalName: string;
  tradingName: string | null;
  state: string | null;
  postcode: string | null;
  entityType: string | null;
}

function text(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
  const value = match?.[1]?.trim();
  return value || null;
}

export function parseAbrBlock(block: string): ParsedAbnRecord | null {
  const abnTag = block.match(/<ABN\b([^>]*)>(\d{11})<\/ABN>/i);
  if (!abnTag) return null;
  const status = abnTag[1]?.match(/\bstatus=["']([^"']+)["']/i)?.[1]?.trim() ?? null;

  const nonIndividual = text(block, "NonIndividualNameText");
  const person = [text(block, "GivenName"), text(block, "FamilyName")].filter(Boolean).join(" ").trim();
  const legalName = nonIndividual || person;
  if (!legalName) return null;

  const tradingMatch = block.match(/<NonIndividualName\b[^>]*type=["']TRD["'][^>]*>[\s\S]*?<NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/i);
  const state = block.match(/<State>([A-Z]{2,3})<\/State>/)?.[1] ?? null;
  const postcode = block.match(/<Postcode>(\d{4})<\/Postcode>/)?.[1] ?? null;

  return {
    abn: abnTag[2],
    abnStatus: status ? status.toUpperCase() : null,
    legalName,
    tradingName: tradingMatch?.[1]?.trim() || null,
    state,
    postcode,
    entityType: text(block, "EntityTypeText"),
  };
}

export function parseAbrRecords(xml: string): ParsedAbnRecord[] {
  const { blocks } = takeCompleteAbrBlocks(xml);
  const records: ParsedAbnRecord[] = [];
  for (const block of blocks) {
    const record = parseAbrBlock(block);
    if (record) records.push(record);
  }
  return records;
}

/** Active registrations only. A missing status is kept so a schema tweak does not drop the file. */
export function isActiveAbnRecord(record: ParsedAbnRecord): boolean {
  return record.abnStatus == null || record.abnStatus === "ACT";
}

/**
 * Pull every complete <ABR>…</ABR> element out of a buffer. The remainder
 * is the incomplete tail (or a few characters that might be the start of
 * the next tag) and must be prepended to the following chunk.
 */
export function takeCompleteAbrBlocks(buffer: string): { blocks: string[]; rest: string } {
  const blocks: string[] = [];
  let rest = buffer;
  const close = "</ABR>";
  while (rest.length > 0) {
    const start = rest.indexOf("<ABR");
    if (start === -1) {
      return { blocks, rest: rest.slice(Math.max(0, rest.length - close.length)) };
    }
    if (start > 0) rest = rest.slice(start);
    const end = rest.indexOf(close);
    if (end === -1) return { blocks, rest };
    blocks.push(rest.slice(0, end + close.length));
    rest = rest.slice(end + close.length);
  }
  return { blocks, rest };
}
