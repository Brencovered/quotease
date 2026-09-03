/**
 * Split a single model reply that contains several "## Heading" sections
 * back into per-heading drafts. Used by "Draft all sections" so one Gateway
 * call covers the whole outline instead of one call (and one free-tier RPM)
 * per heading.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitDraftedSections(
  markdown: string,
  headings: string[],
): { heading: string; text: string }[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text || headings.length === 0) return [];

  const found: { heading: string; start: number }[] = [];
  for (const heading of headings) {
    const re = new RegExp(`^#{1,3}\\s+${escapeRegExp(heading)}\\s*$`, "im");
    const match = re.exec(text);
    if (match && match.index >= 0) found.push({ heading, start: match.index });
  }
  found.sort((a, b) => a.start - b.start);

  return found.map((item, i) => {
    const end = i + 1 < found.length ? found[i + 1].start : text.length;
    let chunk = text.slice(item.start, end).trim();
    if (!/^##\s+/m.test(chunk)) {
      chunk = chunk.replace(/^#{1,3}\s+/m, "## ");
    }
    return { heading: item.heading, text: chunk };
  });
}

/** Words in the body, ignoring the first heading line. */
export function sectionProseWordCount(markdown: string): number {
  const body = markdown.replace(/^#{1,6}\s+[^\n]*\n?/, "").trim();
  if (!body) return 0;
  return body.split(/\s+/).filter(Boolean).length;
}

export const MIN_SECTION_PROSE_WORDS = 80;

export function draftsWithProse(
  drafts: { heading: string; text: string }[],
  minWords = MIN_SECTION_PROSE_WORDS,
): { heading: string; text: string }[] {
  return drafts.filter((d) => sectionProseWordCount(d.text) >= minWords);
}
