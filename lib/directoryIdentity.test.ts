import { describe, expect, it } from "vitest";
import {
  canonicalDirectorySource,
  DIRECTORY_SOURCE,
  isSharedAuServiceNumber,
  mergeDirectorySource,
  normalizeAbn,
  normalizeAuPhone,
  normalizeWebsiteDomain,
} from "./directoryIdentity";

describe("normalizeAuPhone", () => {
  it("formats Australian numbers as E.164", () => {
    expect(normalizeAuPhone("0412 345 678")).toBe("+61412345678");
    expect(normalizeAuPhone("0412345678")).toBe("+61412345678");
    expect(normalizeAuPhone("+61 412 345 678")).toBe("+61412345678");
    expect(normalizeAuPhone("61412345678")).toBe("+61412345678");
    expect(normalizeAuPhone("(02) 1234 5678")).toBe("+61212345678");
    expect(normalizeAuPhone("61212345678")).toBe("+61212345678");
    expect(normalizeAuPhone("0011 61 412 345 678")).toBe("+61412345678");
    expect(normalizeAuPhone("1300 123 456")).toBe("+611300123456");
    expect(normalizeAuPhone("1800 123 456")).toBe("+611800123456");
    expect(normalizeAuPhone("1900 123 456")).toBe("+611900123456");
    expect(normalizeAuPhone("13 13 13")).toBe("+61131313");
  });

  it("rejects blank, invalid, and non-AU numbers", () => {
    expect(normalizeAuPhone("")).toBeNull();
    expect(normalizeAuPhone("   ")).toBeNull();
    expect(normalizeAuPhone(null)).toBeNull();
    expect(normalizeAuPhone("not a phone")).toBeNull();
    expect(normalizeAuPhone("12345")).toBeNull();
    expect(normalizeAuPhone("+1 415 555 2671")).toBeNull();
  });
});

describe("isSharedAuServiceNumber", () => {
  it("flags 13, 1300, 1800, and 1900", () => {
    expect(isSharedAuServiceNumber("+61131313")).toBe(true);
    expect(isSharedAuServiceNumber("+611300123456")).toBe(true);
    expect(isSharedAuServiceNumber("+611800123456")).toBe(true);
    expect(isSharedAuServiceNumber("+611900123456")).toBe(true);
    expect(isSharedAuServiceNumber("+61412345678")).toBe(false);
    expect(isSharedAuServiceNumber("+61212345678")).toBe(false);
  });
});

describe("normalizeWebsiteDomain", () => {
  it("strips scheme, www, path, and case", () => {
    expect(normalizeWebsiteDomain("https://www.Example.com.au/contact?x=1")).toBe("example.com.au");
    expect(normalizeWebsiteDomain("example.com.au")).toBe("example.com.au");
    expect(normalizeWebsiteDomain("http://blog.example.com.au")).toBe("blog.example.com.au");
  });

  it("drops social, directory, and supplier hosts", () => {
    expect(normalizeWebsiteDomain("https://www.facebook.com/acme")).toBeNull();
    expect(normalizeWebsiteDomain("https://m.facebook.com/acme")).toBeNull();
    expect(normalizeWebsiteDomain("https://sites.google.com/view/acme")).toBeNull();
    expect(normalizeWebsiteDomain("https://www.yellowpages.com.au/acme")).toBeNull();
    expect(normalizeWebsiteDomain("https://www.reece.com.au/store")).toBeNull();
    expect(normalizeWebsiteDomain("https://hipages.com.au/connect/acme")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(normalizeWebsiteDomain("")).toBeNull();
    expect(normalizeWebsiteDomain("not a url")).toBeNull();
    expect(normalizeWebsiteDomain(null)).toBeNull();
  });
});

describe("normalizeAbn", () => {
  it("keeps 11 digits and drops spaces", () => {
    expect(normalizeAbn("51 824 753 556")).toBe("51824753556");
    expect(normalizeAbn("123")).toBeNull();
    expect(normalizeAbn(null)).toBeNull();
  });
});

describe("directory source", () => {
  it("maps scraper labels to the real origin", () => {
    expect(canonicalDirectorySource("scraper", DIRECTORY_SOURCE.manual)).toBe("google_places");
    expect(canonicalDirectorySource("google", DIRECTORY_SOURCE.manual)).toBe("google_places");
    expect(canonicalDirectorySource("yellowpages", DIRECTORY_SOURCE.manual)).toBe("yellowpages");
    expect(canonicalDirectorySource("html", DIRECTORY_SOURCE.manual)).toBe("directory_html");
    expect(canonicalDirectorySource(null, DIRECTORY_SOURCE.claim)).toBe("claim");
  });

  it("does not overwrite a specific source with a later ingest", () => {
    expect(mergeDirectorySource("yellowpages", "google_places")).toBe("yellowpages");
    expect(mergeDirectorySource("scraper", "google_places")).toBe("google_places");
    expect(mergeDirectorySource(null, "abn_bulk_extract")).toBe("abn_bulk_extract");
  });
});
