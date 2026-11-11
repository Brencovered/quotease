import { describe, expect, it } from "vitest";
import {
  chooseListingForSlug,
  directoryProfilePath,
  isLegacyDirectoryUuid,
  legacyUuidRedirectPath,
  nonCanonicalListingRedirect,
  removedListingRedirectPath,
} from "./directoryUrl";

const SAMPLES = [
  {
    id: "4310b131-7ba5-4e24-ad16-d402156bc8d8",
    business_name: "Bayside Handyman Service",
    suburb: "Moorabbin",
    path: "/directory/bayside-handyman-service-moorabbin-6bc8d8",
  },
  {
    id: "bc11a9ef-0714-4b0b-b131-32607714efec",
    business_name: "Your Kensington Plumber",
    suburb: "Kensington",
    path: "/directory/your-kensington-plumber-kensington-14efec",
  },
  {
    id: "22fec3ec-0e70-46da-ad90-d028b6e0fee9",
    business_name: "Manuka Gardens",
    suburb: "Fyshwick",
    path: "/directory/manuka-gardens-fyshwick-e0fee9",
  },
] as const;

describe("directory canonical paths", () => {
  it("308s a legacy UUID to the pretty slug and leaves the pretty slug alone", () => {
    for (const sample of SAMPLES) {
      expect(isLegacyDirectoryUuid(sample.id)).toBe(true);
      expect(isLegacyDirectoryUuid(sample.path.split("/").pop()!)).toBe(false);
      expect(directoryProfilePath(sample)).toBe(sample.path);
      expect(legacyUuidRedirectPath(sample.id, sample)).toBe(sample.path);
      expect(legacyUuidRedirectPath(sample.path.split("/").pop()!, sample)).toBeNull();
      expect(sample.path).not.toContain(sample.id);
    }
  });

  it("308s a renamed pretty slug to the current canonical and leaves the current slug alone", () => {
    const listing = SAMPLES[0];
    expect(nonCanonicalListingRedirect("good-painters-melbourne-berwick-3e933a", {
      id: "6b077529-fc2d-42c5-8119-514d95e19663",
      business_name: "ABC Decopainting Serv. t/ as Good Painters Melbourne",
      suburb: "Berwick",
    })).toBe("/directory/abc-decopainting-serv-t-as-good-painters-melbourne-berwick-e19663");
    expect(nonCanonicalListingRedirect(listing.path.split("/").pop()!, listing)).toBeNull();
    expect(nonCanonicalListingRedirect(listing.id, listing)).toBe(listing.path);
  });

  it("picks the canonical row when two listings share a suffix, and refuses to guess", () => {
    const a = SAMPLES[0];
    const b = {
      id: "99999999-9999-4999-8999-9999996bc8d8",
      business_name: "Other Handyman",
      suburb: "Moorabbin",
    };
    expect(chooseListingForSlug(a.path.split("/").pop()!, [b, a])).toEqual(a);
    expect(chooseListingForSlug("stale-name-moorabbin-6bc8d8", [a, b])).toBeNull();
    expect(chooseListingForSlug(a.path.split("/").pop()!, [a])).toEqual(a);
  });

  it("sends a deleted listing slug to the longest suburb hub, or the directory", () => {
    const slug = "master-struct-pty-ltd-narre-warren-south-fd21d4";
    expect(removedListingRedirectPath(slug, [
      { suburbSlug: "south", state: "vic", count: 4 },
      { suburbSlug: "narre-warren-south", state: "VIC", count: 6 },
    ])).toBe("/tradies-in/narre-warren-south-vic");

    expect(removedListingRedirectPath("good-painters-melbourne-berwick-3e933a", [
      { suburbSlug: "berwick", state: "vic", count: 8 },
      { suburbSlug: "melbourne", state: "vic", count: 40 },
    ])).toBe("/tradies-in/berwick-vic");

    expect(removedListingRedirectPath("victoria-concrete-works-seaford-34603a", [
      { suburbSlug: "seaford", state: "vic", count: 3 },
      { suburbSlug: "seaford", state: "sa", count: 3 },
    ])).toBe("/directory");

    expect(removedListingRedirectPath("mr-deeds-handyman-repairs-maintenance-modifications-braddon-be79de", []))
      .toBe("/directory");
  });

  it("still builds a canonical slug when suburb is missing, rather than linking the UUID", () => {
    const listing = {
      id: "4310b131-7ba5-4e24-ad16-d402156bc8d8",
      business_name: "Bayside Handyman Service",
      suburb: null,
    };
    expect(directoryProfilePath(listing)).toBe("/directory/bayside-handyman-service-6bc8d8");
    expect(legacyUuidRedirectPath(listing.id, listing)).toBe("/directory/bayside-handyman-service-6bc8d8");
  });
});
