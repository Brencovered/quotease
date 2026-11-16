import { describe, expect, it } from "vitest";
import { POSTGREST_PAGE_SIZE } from "./fetchAllPages";
import {
  blogSitemapEntries,
  listingSitemapEntries,
  suburbHubSitemapEntries,
  tradeSuburbSitemapEntries,
  type ListingSitemapRow,
} from "./sitemapEntries";

const UUID_LOC = /\/directory\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fillerId(n: number): string {
  const tail = n.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${tail}`;
}

describe("listing sitemap entries", () => {
  it("includes every eligible listing past the 1000-row cap, as canonical slugs", () => {
    const fillers: ListingSitemapRow[] = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, n) => ({
      id: fillerId(n + 1),
      business_name: `Filler Business ${n}`,
      suburb: "Richmond",
      updated_at: "2026-11-01T00:00:00.000Z",
    }));
    const pastTheCap: ListingSitemapRow[] = [
      {
        id: "4310b131-7ba5-4e24-ad16-d402156bc8d8",
        business_name: "Bayside Handyman Service",
        suburb: "Moorabbin",
        updated_at: "2026-11-02T00:00:00.000Z",
      },
      {
        id: "bc11a9ef-0714-4b0b-b131-32607714efec",
        business_name: "Your Kensington Plumber",
        suburb: "Kensington",
        updated_at: "2026-11-02T00:00:00.000Z",
      },
      {
        id: "22fec3ec-0e70-46da-ad90-d028b6e0fee9",
        business_name: "Manuka Gardens",
        suburb: "Fyshwick",
        updated_at: "2026-11-02T00:00:00.000Z",
      },
    ];
    const excluded: ListingSitemapRow[] = [
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", business_name: "No Suburb Pty Ltd", suburb: null },
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", business_name: "Blank Suburb", suburb: "   " },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", business_name: "  ", suburb: "Carlton" },
      { id: null, business_name: "Missing Id", suburb: "Carlton" },
    ];

    const entries = listingSitemapEntries([...fillers, ...pastTheCap, ...excluded]);
    const urls = entries.map((entry) => entry.url);

    expect(entries).toHaveLength(POSTGREST_PAGE_SIZE + pastTheCap.length);
    expect(urls).toContain("https://swiftscope.com.au/directory/bayside-handyman-service-moorabbin-6bc8d8");
    expect(urls).toContain("https://swiftscope.com.au/directory/your-kensington-plumber-kensington-14efec");
    expect(urls).toContain("https://swiftscope.com.au/directory/manuka-gardens-fyshwick-e0fee9");
    expect(urls.some((url) => UUID_LOC.test(url))).toBe(false);
    expect(urls.some((url) => url.includes("no-suburb") || url.includes("blank-suburb") || url.includes("missing-id"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("does not emit a second loc when two rows share a canonical URL", () => {
    const row: ListingSitemapRow = {
      id: "4310b131-7ba5-4e24-ad16-d402156bc8d8",
      business_name: "Bayside Handyman Service",
      suburb: "Moorabbin",
    };
    expect(listingSitemapEntries([row, row])).toHaveLength(1);
  });
});

describe("programmatic sitemap exclusions", () => {
  const indexed = {
    trade: "electrician",
    suburb: "Moorabbin",
    suburbSlug: "moorabbin",
    state: "vic",
    count: 4,
    isIndexed: true,
  };

  it("omits noindex and thin trade pages and keeps eligible canonicals", () => {
    const urls = tradeSuburbSitemapEntries([
      indexed,
      { ...indexed, suburbSlug: "thin", suburb: "Thin", count: 2, isIndexed: true },
      { ...indexed, suburbSlug: "hidden", suburb: "Hidden", count: 9, isIndexed: false },
      { ...indexed, trade: "plumber", suburbSlug: "kensington", suburb: "Kensington", state: "VIC" },
    ]).map((entry) => entry.url);

    expect(urls).toEqual([
      "https://swiftscope.com.au/electricians-moorabbin-vic",
      "https://swiftscope.com.au/plumbers-kensington-vic",
    ]);
  });

  it("emits one hub per suburb and state, and ignores noindex rows in the count", () => {
    const urls = suburbHubSitemapEntries([
      indexed,
      { ...indexed, trade: "plumber", count: 1, isIndexed: false },
      { trade: "plumber", suburb: "Seaford", suburbSlug: "seaford", state: "vic", count: 3, isIndexed: true },
      { trade: "electrician", suburb: "Seaford", suburbSlug: "seaford", state: "sa", count: 3, isIndexed: true },
      { trade: "painter", suburb: "Lone", suburbSlug: "lone", state: "nsw", count: 2, isIndexed: true },
    ]).map((entry) => entry.url);

    expect(urls).toEqual([
      "https://swiftscope.com.au/tradies-in/moorabbin-vic",
      "https://swiftscope.com.au/tradies-in/seaford-vic",
      "https://swiftscope.com.au/tradies-in/seaford-sa",
    ]);
  });
});

describe("blog sitemap entries", () => {
  it("skips unpublished drafts and blank slugs", () => {
    const urls = blogSitemapEntries([
      { slug: "how-to-quote", published: true, updated_at: "2026-10-01T00:00:00.000Z" },
      { slug: "draft-post", published: false, updated_at: "2026-10-02T00:00:00.000Z" },
      { slug: "   ", published: true },
      { slug: null, published: true },
    ]).map((entry) => entry.url);
    expect(urls).toEqual(["https://swiftscope.com.au/blog/how-to-quote"]);
  });
});
