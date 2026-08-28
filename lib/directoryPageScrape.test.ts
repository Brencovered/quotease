import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectDirectorySource,
  googleQueryFromUrl,
  parseJsonLdListings,
  parseYellowPagesHtml,
  suburbFromAuAddress,
  sanitizeSuburb,
  splitTradeAndLocation,
  yellowPagesSearchUrl,
  scrapeDirectoryPage,
} from "./directoryPageScrape";
import { formatPlacesApiError, isPlacesBillingBlock } from "./googlePlaces";

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

describe("splitTradeAndLocation", () => {
  it("splits 'in' / state patterns for Yellow Pages", () => {
    expect(splitTradeAndLocation("plumbers in Newtown NSW")).toEqual({
      clue: "plumbers",
      location: "Newtown NSW",
    });
    expect(splitTradeAndLocation("electricians Bondi NSW")).toEqual({
      clue: "electricians",
      location: "Bondi NSW",
    });
    expect(splitTradeAndLocation("plumbers parramatta")).toEqual({
      clue: "plumbers",
      location: "parramatta",
    });
  });
});

describe("yellowPagesSearchUrl", () => {
  it("builds a listings search URL", () => {
    const url = yellowPagesSearchUrl("plumbers in Newtown NSW");
    expect(url).toContain("yellowpages.com.au/search/listings");
    expect(url).toContain("clue=plumbers");
    expect(url).toContain("locationClue=Newtown");
  });
});

describe("formatPlacesApiError", () => {
  const googleBilling =
    "You must enable Billing on the Google Cloud Project at https://console.cloud.google.com/project/_/billing/enable Learn more at https://developers.google.com/maps/gmp-get-started";

  it("does not pass Google's billing URL through to the admin", () => {
    expect(isPlacesBillingBlock("REQUEST_DENIED", googleBilling)).toBe(true);
    const msg = formatPlacesApiError("REQUEST_DENIED", googleBilling);
    expect(msg).not.toMatch(/console\.cloud\.google/);
    expect(msg).not.toMatch(/gmp-get-started/);
    expect(msg).toMatch(/Yellow Pages/);
  });
});

describe("scrapeDirectoryPage Google fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("searches Yellow Pages when Places billing is off", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const ypHtml = `<script type="application/ld+json">${JSON.stringify({
      "@type": "LocalBusiness",
      name: "Newtown Pipes",
      email: "hi@newtownpipes.com.au",
      url: "https://newtownpipes.com.au",
      address: { addressLocality: "Newtown", addressRegion: "NSW", postalCode: "2042" },
    })}</script>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("maps.googleapis.com")) {
          return {
            ok: true,
            json: async () => ({
              status: "REQUEST_DENIED",
              error_message:
                "You must enable Billing on the Google Cloud Project at https://console.cloud.google.com/project/_/billing/enable Learn more at https://developers.google.com/maps/gmp-get-started",
            }),
          };
        }
        if (url.includes("yellowpages.com.au")) {
          return {
            ok: true,
            headers: { get: (_name: string): string => "text/html" },
            text: async (): Promise<string> => ypHtml,
          };
        }
        return {
          ok: false,
          headers: { get: (_name: string): string => "" },
          text: async (): Promise<string> => "",
          json: async () => ({}),
        };
      }),
    );

    const result = await scrapeDirectoryPage(
      "https://www.google.com/maps/search/plumbers+in+Newtown+NSW",
    );
    expect(result.source).toBe("yellowpages");
    expect(result.listings[0].business_name).toBe("Newtown Pipes");
    expect(result.listings[0].email).toBe("hi@newtownpipes.com.au");
    expect(result.note).toMatch(/Yellow Pages/);
  });
});
