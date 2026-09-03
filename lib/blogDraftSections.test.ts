import { describe, expect, it } from "vitest";
import { draftsWithProse, sectionProseWordCount, splitDraftedSections } from "./blogDraftSections";

describe("splitDraftedSections", () => {
  it("splits a batched markdown reply on ## headings", () => {
    const md = `## Why unlimited users
Body one. See [features](/features).

## Conclusion: Choosing the Right AI Quoting Solution
Body two. See [signup](/signup).
`;
    const rows = splitDraftedSections(md, [
      "Why unlimited users",
      "Conclusion: Choosing the Right AI Quoting Solution",
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].text).toMatch(/^## Why unlimited users/);
    expect(rows[0].text).toMatch(/Body one/);
    expect(rows[1].text).toMatch(/^## Conclusion/);
    expect(rows[1].text).toMatch(/Body two/);
  });

  it("skips headings the model omitted", () => {
    const rows = splitDraftedSections("## Only this\nHello.", ["Missing", "Only this"]);
    expect(rows.map((r) => r.heading)).toEqual(["Only this"]);
  });
});

describe("sectionProseWordCount", () => {
  it("counts body words and treats a heading-only stub as empty", () => {
    expect(sectionProseWordCount("## Why unlimited users")).toBe(0);
    expect(sectionProseWordCount("## Why unlimited users\n")).toBe(0);
    expect(sectionProseWordCount("## Why unlimited users\nThis section must argue: a brief.")).toBeGreaterThan(3);
    expect(
      sectionProseWordCount(
        `## Why unlimited users\n${"word ".repeat(90)}See [features](/features).`,
      ),
    ).toBeGreaterThanOrEqual(80);
  });

  it("drops heading-only drafts from a batch", () => {
    const rich = draftsWithProse([
      { heading: "A", text: "## A" },
      { heading: "B", text: `## B\n${"content ".repeat(90)}` },
    ]);
    expect(rich.map((r) => r.heading)).toEqual(["B"]);
  });
});
