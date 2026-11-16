import { describe, expect, it } from "vitest";
import {
  asicLookbackDays,
  headerIndex,
  parseAsicRow,
  pickAsicZipUrl,
  planAsicQueue,
  registrationCutoff,
  toCandidate,
} from "./asicCompany";

const HEADER = "Company Name\tACN\tType\tClass\tSub Class\tStatus\tDate of Registration\tDate of Deregistration\tPrevious State of Registration\tState Registration number\tModified since last report\tCurrent Name Indicator\tABN\tCurrent Name\tCurrent Name Start Date";

function row(fields: string[]): string {
  return fields.join("\t");
}

describe("pickAsicZipUrl", () => {
  it("uses the newest company zip from the CKAN resource list", () => {
    const url = pickAsicZipUrl([
      { format: "CSV", url: "https://data.gov.au/company_202611.csv", last_modified: "2026-11-09T13:52:53" },
      { format: "ZIP", url: "https://data.gov.au/company_202610.zip", last_modified: "2026-10-06T00:00:00" },
      { format: "ZIP", url: "https://data.gov.au/company_202611.zip", last_modified: "2026-11-09T13:53:06" },
    ]);
    expect(url).toBe("https://data.gov.au/company_202611.zip");
  });

  it("refuses a package that has no company zip", () => {
    expect(() => pickAsicZipUrl([{ format: "PDF", url: "https://data.gov.au/help.pdf" }])).toThrow(/company_YYYYMM\.zip/);
  });
});

describe("asicLookbackDays", () => {
  it("uses 90 days when this is the first ASIC pass and no override is set", () => {
    expect(asicLookbackDays({}, false)).toBe(90);
    expect(asicLookbackDays({}, true)).toBe(30);
  });

  it("honours an explicit lookback", () => {
    expect(asicLookbackDays({ ASIC_LOOKBACK_DAYS: "14" }, false)).toBe(14);
    expect(asicLookbackDays({ ASIC_FIRST_RUN_LOOKBACK_DAYS: "120" }, false)).toBe(120);
  });
});

describe("parse and filter ASIC rows", () => {
  const columns = headerIndex(HEADER);
  const cutoff = registrationCutoff(new Date("2026-11-16T00:00:00Z"), 30);

  it("keeps a current registered trade company inside the window", () => {
    const company = parseAsicRow(row([
      "SMITH ELECTRICAL PTY LTD", "123456789", "APTY", "LMSH", "PSTC", "REGD",
      "01/11/2026", "", "NSW", "", "", "Y", "51824753556", "", "",
    ]), columns);
    expect(company?.abn).toBe("51824753556");
    expect(toCandidate(company!, cutoff)?.matched_trade).toBe("electrician");
  });

  it("drops historical names, deregistered companies, old dates, and non-trades", () => {
    const historical = parseAsicRow(row([
      "OLD ELECTRICAL PTY LTD", "123456780", "APTY", "LMSH", "PSTC", "REGD",
      "01/11/2026", "", "NSW", "", "", "", "51824753556", "SMITH ELECTRICAL PTY LTD", "02/11/2026",
    ]), columns);
    expect(toCandidate(historical!, cutoff)).toBeNull();

    const deregistered = parseAsicRow(row([
      "GONE PLUMBING PTY LTD", "123456781", "APTY", "LMSH", "PSTC", "DRGD",
      "01/11/2026", "10/11/2026", "VIC", "", "", "Y", "0", "", "",
    ]), columns);
    expect(deregistered?.abn).toBeNull();
    expect(toCandidate(deregistered!, cutoff)).toBeNull();

    const old = parseAsicRow(row([
      "LONGSTANDING ROOFING PTY LTD", "123456782", "APTY", "LMSH", "PSTC", "REGD",
      "01/01/2020", "", "QLD", "", "", "Y", "11222333444", "", "",
    ]), columns);
    expect(toCandidate(old!, cutoff)).toBeNull();

    const bakery = parseAsicRow(row([
      "CITY BAKERY PTY LTD", "123456783", "APTY", "LMSH", "PSTC", "REGD",
      "01/11/2026", "", "SA", "", "", "Y", "11222333445", "", "",
    ]), columns);
    expect(toCandidate(bakery!, cutoff)).toBeNull();
  });

  it("trims the fixed-width padding ASIC puts on some names", () => {
    const company = parseAsicRow(row([
      "BNP PARIBAS                                                                                         ",
      "000000117", "FNOS", "NONE", "NONE", "REGD", "30/04/1907", "", "NSW", "00002239", "", "Y", "23000000117", "", "",
    ]), columns);
    expect(company?.companyName).toBe("BNP PARIBAS");
  });
});

describe("planAsicQueue", () => {
  const draft = {
    abn: "51824753556",
    acn: "123456789",
    legal_name: "Smith Electrical Pty Ltd",
    matched_trade: "electrician",
    state: "NSW",
    entity_type: "APTY",
    source: "asic_company" as const,
    registered_at: "2026-11-01",
  };

  it("skips an ABN that already has a directory listing", () => {
    const plan = planAsicQueue([draft], [], new Set(["51824753556"]));
    expect(plan.insert).toEqual([]);
    expect(plan.refreshAbns).toEqual([]);
  });

  it("refreshes an unprocessed candidate and skips one already processed", () => {
    const refresh = planAsicQueue([draft], [{ abn: draft.abn, acn: null, processed: false }], new Set());
    expect(refresh.insert).toEqual([]);
    expect(refresh.refreshAbns).toEqual([draft]);

    const done = planAsicQueue([draft], [{ abn: draft.abn, acn: draft.acn, processed: true }], new Set());
    expect(done.insert).toEqual([]);
    expect(done.refreshAbns).toEqual([]);
  });

  it("queues a new company once", () => {
    const plan = planAsicQueue([draft, draft], [], new Set());
    expect(plan.insert).toHaveLength(1);
  });
});
