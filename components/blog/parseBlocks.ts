/**
 * parseBlocks.ts
 * --------------
 * Converts existing blog post markdown content into the modular block
 * format. This allows existing posts to be edited with the new visual
 * block editor.
 *
 * This mirrors the parser in app/blog/[slug]/page.tsx but produces
 * ContentBlock objects instead of renderable components.
 */

import type { ContentBlock } from "./BlogEditor";

let _parseId = 0;
function pid() { return `p_${++_parseId}_${Math.random().toString(36).slice(2, 6)}`; }

export function parseBlocks(md: string): ContentBlock[] {
  if (!md || !md.trim()) return [];
  const blocks: ContentBlock[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ id: pid(), type: "hr", content: "" });
      i++;
      continue;
    }

    // Images: ![alt](url) on its own line
    const imgMatch = line.match(/^!\[(.+?)\]\((.+?)\)$/);
    if (imgMatch) {
      blocks.push({
        id: pid(),
        type: "image",
        content: "",
        src: imgMatch[2],
        alt: imgMatch[1],
        caption: "",
      });
      i++;
      // Check if next line is a caption (plain text, not a block element)
      if (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        blocks[blocks.length - 1].caption = lines[i].trim();
        i++;
      }
      continue;
    }

    // Custom headings: #H2 text #H2
    const customH2Match = line.match(/^#H2\s*(.+?)\s*#H2$/);
    if (customH2Match) {
      blocks.push({ id: pid(), type: "h2", content: customH2Match[1] });
      i++;
      continue;
    }

    // Custom headings: #H3 text #H3
    const customH3Match = line.match(/^#H3\s*(.+?)\s*#H3$/);
    if (customH3Match) {
      blocks.push({ id: pid(), type: "h3", content: customH3Match[1] });
      i++;
      continue;
    }

    // Standard H1: # text (but not #H2 or #H3)
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match && !line.match(/^#H[23]/)) {
      blocks.push({ id: pid(), type: "h1", content: h1Match[1] });
      i++;
      continue;
    }

    // Standard H2: ## text
    const h2Match = line.match(/^##\s*(.+)$/);
    if (h2Match) {
      blocks.push({ id: pid(), type: "h2", content: h2Match[1] });
      i++;
      continue;
    }

    // Standard H3: ### text
    const h3Match = line.match(/^###\s*(.+)$/);
    if (h3Match) {
      blocks.push({ id: pid(), type: "h3", content: h3Match[1] });
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        id: pid(),
        type: "blockquote",
        content: quoteLines.join(" "),
      });
      continue;
    }

    // Graph block: [graph] ... [/graph]
    if (line.trim().toLowerCase() === "[graph]") {
      const graphLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().toLowerCase() !== "[/graph]") {
        graphLines.push(lines[i]);
        i++;
      }
      i++; // skip [/graph]

      const titleLine = graphLines.find(l => l.trim().toLowerCase().startsWith("title:"));
      const graphTitle = titleLine
        ? titleLine.replace(/^\s*title:\s*/i, "").trim()
        : "";
      const dataLines = graphLines.filter(l => l.includes(":") && !l.trim().toLowerCase().startsWith("title:"));
      const bars = dataLines.map(l => {
        const idx = l.indexOf(":");
        const label = l.slice(0, idx).trim();
        const valStr = l.slice(idx + 1).trim().replace(/[^\d.]/g, "");
        const unitMatch = l.slice(idx + 1).trim().match(/[^\d.\s].*$/);
        return {
          label,
          value: parseFloat(valStr) || 0,
          unit: unitMatch ? unitMatch[0] : undefined,
        };
      }).filter(b => b.value > 0 || b.label);

      blocks.push({
        id: pid(),
        type: "graph",
        content: "",
        graphTitle,
        bars: bars.length > 0 ? bars : [{ label: "", value: 0 }],
      });
      continue;
    }

    // Key Takeaways detector
    if (/^key takeaway/i.test(line.trim()) || /^the solution/i.test(line.trim())) {
      const title = line.trim();
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        const trimmed = lines[i].trim();
        if (trimmed) items.push(trimmed);
        i++;
      }
      blocks.push({
        id: pid(),
        type: "key_takeaways",
        content: title,
        items: items.length > 0 ? items : [""],
      });
      continue;
    }

    // Sources / References detector
    if (/^sources/i.test(line.trim()) || /^references/i.test(line.trim())) {
      const title = line.trim();
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        const trimmed = lines[i].trim();
        if (trimmed) items.push(trimmed);
        i++;
      }
      blocks.push({
        id: pid(),
        type: "sources",
        content: title,
        items: items.length > 0 ? items : [""],
      });
      continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Remove separator line
      const dataLines = tableLines.filter(l => !/^\s*\|[\s\-|]+\|\s*$/.test(l));
      if (dataLines.length >= 1) {
        const headers = dataLines[0].split("|").map(h => h.trim()).filter(Boolean);
        const rows = dataLines.slice(1).map(row =>
          row.split("|").map(c => c.trim()).filter((_, idx) => idx < headers.length)
        ).filter(r => r.length > 0);
        blocks.push({
          id: pid(),
          type: "table",
          content: "",
          headers,
          rows,
        });
      }
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(/^\s*[-*+]\s+(.+)$/);
        if (m) items.push(m[1]);
        else break;
        i++;
      }
      blocks.push({
        id: pid(),
        type: "bullet_list",
        content: "",
        items,
      });
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(/^\s*\d+\.\s+(.+)$/);
        if (m) items.push(m[1]);
        else break;
        i++;
      }
      blocks.push({
        id: pid(),
        type: "numbered_list",
        content: "",
        items,
      });
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph
    let para = line;
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      para += " " + lines[i];
      i++;
    }
    blocks.push({ id: pid(), type: "paragraph", content: para });
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,6}\s/.test(line) ||          // any heading
    /^#H[23]\s/.test(line) ||          // custom heading
    /^!\[/.test(line) ||               // image
    /^---+\s*$/.test(line) ||          // horizontal rule
    /^\s*[-*+]\s/.test(line) ||       // bullet list
    /^\s*\d+\.\s/.test(line) ||       // numbered list
    /^\s*\|/.test(line) ||             // table
    /^\s*>/.test(line) ||              // blockquote
    /^\[graph\]/i.test(line) ||        // graph
    /^key takeaway/i.test(line) ||     // key takeaways
    /^the solution/i.test(line) ||     // key takeaways alt
    /^sources/i.test(line) ||          // sources
    /^references/i.test(line)          // sources alt
  );
}
