import { describe, expect, it } from "vitest";
import { enquiryFileStoragePath, fileLabelFromPath, isAllowedEnquiryFile } from "./directoryEnquiryPhotos";

describe("isAllowedEnquiryFile", () => {
  it("accepts a jpeg under 10MB", () => {
    expect(isAllowedEnquiryFile({ type: "image/jpeg", size: 500_000, name: "site.jpg" })).toBeNull();
  });

  it("accepts a PDF drawing", () => {
    expect(isAllowedEnquiryFile({ type: "application/pdf", size: 1_000_000, name: "plan.pdf" })).toBeNull();
  });

  it("rejects an oversized file", () => {
    expect(isAllowedEnquiryFile({ type: "image/png", size: 11 * 1024 * 1024, name: "huge.png" })).toMatch(/too large/);
  });

  it("rejects a non-image, non-pdf file", () => {
    expect(isAllowedEnquiryFile({ type: "text/plain", size: 100, name: "notes.txt" })).toMatch(/photo, drawing, or PDF/);
  });
});

describe("enquiryFileStoragePath", () => {
  it("nests under directory-enquiries and sanitises the name", () => {
    const path = enquiryFileStoragePath("abc-123", "Living room!.JPG");
    expect(path).toMatch(/^directory-enquiries\/abc-123\/\d+-Living_room_.JPG$/);
    expect(fileLabelFromPath(path)).toBe("Living_room_.JPG");
  });
});
