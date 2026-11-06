import { describe, expect, it } from "vitest";
import { directoryProfilePath, isLegacyDirectoryUuid, legacyUuidRedirectPath } from "./directoryUrl";

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
