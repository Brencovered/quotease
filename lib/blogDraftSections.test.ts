import { describe, expect, it } from "vitest";
import { splitDraftedSections } from "./blogDraftSections";

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
