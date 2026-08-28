import { describe, expect, it } from "vitest";
import {
  detectDirectorySource,
  googleQueryFromUrl,
  parseJsonLdListings,
  parseYellowPagesHtml,
  suburbFromAuAddress,
  sanitizeSuburb,
} from "./directoryPageScrape";

describe("detectDirectorySource", () => {
  it("flags Google Maps and Search hosts", () => {
    expect(detectDirectorySource("https://www.google.com/maps/search/electricians+bondi")).toBe("google");
    expect(detectDirectorySource("https://www.google.com.au/maps/place/Smith+Electrical")).toBe("google");
    expect(detectDirectorySource("https://maps.google.com/?q=plumbers+parramatta")).toBe("google");
    expect(detectDirectorySource("https://maps.app.goo.gl/abc123")).toBe("google");
  });

  it("flags Yellow Pages hosts", () => {
    expect(detectDirectorySource("https://www.yellowpages.com.au/search/listings?clue=electrician")).toBe("yellowpages");
  });
});

describe("googleQueryFromUrl", () => {
  it("reads /maps/search/ paths", () => {
    expect(googleQueryFromUrl("https://www.google.com/maps/search/electricians+in+Bondi+NSW")).toBe(
      "electricians in Bondi NSW",
    );
  });

  it("reads q= on search URLs", () => {
    expect(googleQueryFromUrl("https://www.google.com/search?q=plumbers+parramatta")).toBe("plumbers parramatta");
  });
});

describe("suburbFromAuAddress", () => {
  it("parses a Google formatted AU address", () => {
    expect(suburbFromAuAddress("12 Hall St, Bondi Beach NSW 2026, Australia")).toEqual({
      suburb: "Bondi Beach",
      state: "NSW",
      postcode: "2026",
    });
  });
});

describe("parseJsonLdListings", () => {
  it("extracts LocalBusiness name, suburb, email, website", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "LocalBusiness",
      name: "Hall St Electrical",
      email: "jobs@hallst.com.au",
      url: "https://hallst.com.au",
      address: { addressLocality: "Bondi", addressRegion: "NSW", postalCode: "2026" },
    })}</script>`;
    const rows = parseJsonLdListings(html, "html");
    expect(rows).toHaveLength(1);
    expect(rows[0].business_name).toBe("Hall St Electrical");
    expect(rows[0].suburb).toBe("Bondi");
    expect(rows[0].email).toBe("jobs@hallst.com.au");
    expect(rows[0].website_url).toBe("https://hallst.com.au");
  });

  it("skips WebSite JSON-LD and directory self-links", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "WebSite",
      name: "Yellow Pages",
      url: "https://www.yellowpages.com.au",
    })}</script>
    <script type="application/ld+json">${JSON.stringify({
      "@type": "LocalBusiness",
      name: "Bondi Sparks",
      url: "https://www.yellowpages.com.au/nsw/bondi/bondi-sparks",
      address: { addressLocality: "Bondi", addressRegion: "NSW", postalCode: "2026" },
    })}</script>`;
    const rows = parseJsonLdListings(html, "yellowpages");
    expect(rows).toHaveLength(1);
    expect(rows[0].business_name).toBe("Bondi Sparks");
    expect(rows[0].website_url).toBeNull();
  });
});

describe("sanitizeSuburb", () => {
  it("drops capital-city-only names", () => {
    expect(sanitizeSuburb("Sydney")).toBeNull();
    expect(sanitizeSuburb("Bondi")).toBe("Bondi");
  });
});

describe("parseYellowPagesHtml", () => {
  it("falls back to listing cards when JSON-LD is missing", () => {
    const html = `
      <div class="listing listing-item">
        <h3>Coastal Plumbing</h3>
        <a href="tel:0291112222">call</a>
        <a href="https://coastalplumbing.com.au">site</a>
        <span>Bondi NSW 2026</span>
      </div>`;
    const rows = parseYellowPagesHtml(html);
    expect(rows.some((r) => r.business_name === "Coastal Plumbing")).toBe(true);
    expect(rows[0].website_url).toBe("https://coastalplumbing.com.au");
  });
});
