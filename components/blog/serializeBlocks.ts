/**
 * serializeBlocks.ts
 * ------------------
 * Converts the modular block format back to the custom markdown syntax
 * that the existing blog post renderer (app/blog/[slug]/page.tsx) expects.
 *
 * This is the bridge between the new visual block editor and the existing
 * render pipeline. If you change the renderer's syntax, update this file.
 */

import type { ContentBlock } from "./BlogEditor";

export function serializeBlocks(blocks: ContentBlock[]): string {
  return blocks.map(b => serializeBlock(b)).join("\n\n");
}

function serializeBlock(block: ContentBlock): string {
  switch (block.type) {
    case "h1":
      return `# ${block.content}`;

    case "h2":
      return `#H2 ${block.content} #H2`;

    case "h3":
      return `#H3 ${block.content} #H3`;

    case "paragraph":
      return block.content;

    case "blockquote":
      return block.content
        .split("\n")
        .map(line => `> ${line}`)
        .join("\n");

    case "bullet_list":
      return (block.items ?? [])
        .map(item => `- ${item}`)
        .join("\n");

    case "numbered_list":
      return (block.items ?? [])
        .map((item, i) => `${i + 1}. ${item}`)
        .join("\n");

    case "image": {
      const lines: string[] = [];
      if (block.src) {
        lines.push(`![${block.alt || block.caption || ""}](${block.src})`);
      }
      if (block.caption) {
        lines.push(block.caption);
      }
      return lines.join("\n");
    }

    case "table": {
      const headers = block.headers ?? [];
      const rows = block.rows ?? [];
      if (headers.length === 0) return "";
      const sep = "| " + headers.map(() => "---").join(" | ") + " |";
      const headerRow = "| " + headers.join(" | ") + " |";
      const dataRows = rows.map(r => "| " + r.join(" | ") + " |");
      return [headerRow, sep, ...dataRows].join("\n");
    }

    case "graph": {
      const lines: string[] = ["[GRAPH]"];
      if (block.graphTitle) {
        lines.push(`title: ${block.graphTitle}`);
      }
      (block.bars ?? []).forEach(bar => {
        const unitStr = bar.unit ? ` ${bar.unit}` : "";
        lines.push(`${bar.label}: ${bar.value}${unitStr}`);
      });
      lines.push("[/GRAPH]");
      return lines.join("\n");
    }

    case "key_takeaways": {
      const lines: string[] = [block.content || "Key Takeaways"];
      (block.items ?? []).forEach(item => {
        if (item.trim()) lines.push(item);
      });
      return lines.join("\n");
    }

    case "sources": {
      const lines: string[] = [block.content || "Sources"];
      (block.items ?? []).forEach(item => {
        if (item.trim()) lines.push(item);
      });
      return lines.join("\n");
    }

    case "hr":
      return "---";

    default:
      return block.content;
  }
}
