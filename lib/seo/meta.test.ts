import { describe, expect, it } from "vitest";
import { cleanNameForTitle, buildListingTitle } from "./meta";

describe("cleanNameForTitle", () => {
  it("takes the first segment of a pipe-stuffed business name", () => {
    expect(cleanNameForTitle("Spectrum Pro Painting | Melbourne Painters | Painters in Melbourne")).toBe("Spectrum Pro Painting");
  });

  it("handles a long chain of pipe-separated marketing segments", () => {
    expect(cleanNameForTitle("T&J CONCRETING Sydney Wide | Driveways | Footpaths | Resdential | Architectural | Civil | Commerical")).toBe("T&J CONCRETING Sydney Wide");
  });

  it("leaves a clean business name unchanged", () => {
    expect(cleanNameForTitle("Hoppy's Plumbing")).toBe("Hoppy's Plumbing");
  });

  it("falls back to the full name if the first segment is too short to be meaningful", () => {
    expect(cleanNameForTitle("A | Real Painting Co")).toBe("A | Real Painting Co");
  });
});

describe("buildListingTitle", () => {
  it("keeps the full template with rating when short enough to fit", () => {
    const title = buildListingTitle("ABC Tiling", "Tiler", "Perth", 5, 2);
    expect(title).toBe("ABC Tiling | Tiler in Perth - 5★ (2 reviews) - Swiftscope");
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("drops the rating snippet once the full template overflows, even for an otherwise-short name", () => {
    // "Hoppy's Plumbing | Plumber in Strathfield - 5★ (444 reviews) - Swiftscope" is 75 chars
    const title = buildListingTitle("Hoppy's Plumbing", "Plumber", "Strathfield", 5, 444);
    expect(title).toBe("Hoppy's Plumbing | Plumber in Strathfield - Swiftscope");
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("drops the rating snippet when the full title overflows", () => {
    // real audit case: this name alone plus rating pushed well past 60 chars
    const title = buildListingTitle("Pro Plumbing and Excavation Pty Ltd", "Plumber", "Blackburn", 5, 12);
    expect(title).not.toContain("★");
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("cleans a pipe-stuffed name and still fits within budget", () => {
    const title = buildListingTitle("Spectrum Pro Painting | Melbourne Painters | Painters in Melbourne", "Painter", "Clyde North", 5, 32);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Spectrum Pro Painting");
    expect(title).not.toContain("Melbourne Painters");
  });

  it("cleans a very long pipe-stuffed name (real audit case, 103 chars raw)", () => {
    const title = buildListingTitle(
      "T&J CONCRETING Sydney Wide | Driveways | Footpaths | Resdential | Architectural | Civil | Commerical",
      "Concreter",
      "Barangaroo",
      5,
      3
    );
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("hard-truncates a long clean name that still overflows after dropping rating and suffix", () => {
    const title = buildListingTitle("Townsville Aircon Cleaning Services", "Air Con Installer", "Bushland Beach", null, null);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Air Con Installer in Bushland Beach");
  });

  it("never exceeds the length budget across a batch of real over-length names from the audit", () => {
    const cases: [string, string, string, number | null, number | null][] = [
      ["O'Brien Electrical Carrum Downs", "Electrician", "Carrum Downs", 5, 45],
      ["Utmost Painting & Maintenance", "Painter", "Wantirna South", 5, 18],
      ["Everson and Son Painting", "Painter", "Rye", 5, 9],
      ["Almara Cabinets", "Carpenter", "Dandenong South", null, null],
      ["AHR Builders", "Builder", "Frankston", 5, 7],
    ];
    for (const [name, singular, suburb, rating, reviews] of cases) {
      const title = buildListingTitle(name, singular, suburb, rating, reviews);
      expect(title.length).toBeLessThanOrEqual(60);
    }
  });
});
