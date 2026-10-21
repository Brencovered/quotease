import { describe, expect, it } from "vitest";
import { isActiveAbnRecord, parseAbrBlock, parseAbrRecords, takeCompleteAbrBlocks } from "./abnRecord";

const COMPANY = `
<ABR recordLastUpdatedDate="20200101" replaced="N">
  <ABN status="ACT" ABNStatusFromDate="20000101">51824753556</ABN>
  <EntityType><EntityTypeText>Australian Private Company</EntityTypeText></EntityType>
  <MainEntity>
    <NonIndividualName type="MN"><NonIndividualNameText>ACME ELECTRICAL PTY LTD</NonIndividualNameText></NonIndividualName>
  </MainEntity>
  <OtherEntity>
    <NonIndividualName type="TRD"><NonIndividualNameText>Acme Electrical</NonIndividualNameText></NonIndividualName>
  </OtherEntity>
  <BusinessAddress><State>VIC</State><Postcode>3198</Postcode></BusinessAddress>
</ABR>`;

const SOLE_TRADER = `
<ABR>
  <ABN status="ACT">12345678901</ABN>
  <EntityType><EntityTypeText>Individual/Sole Trader</EntityTypeText></EntityType>
  <LegalEntity>
    <IndividualName type="LGL"><GivenName>JANE</GivenName><FamilyName>ROOFER</FamilyName></IndividualName>
  </LegalEntity>
  <BusinessAddress><State>NSW</State><Postcode>2000</Postcode></BusinessAddress>
</ABR>`;

const CANCELLED = `
<ABR>
  <ABN status="CAN">10987654321</ABN>
  <MainEntity><NonIndividualName type="MN"><NonIndividualNameText>GONE PTY LTD</NonIndividualNameText></NonIndividualName></MainEntity>
</ABR>`;

describe("parseAbrBlock", () => {
  it("reads a company, its trading name, and address", () => {
    const record = parseAbrBlock(COMPANY);
    expect(record).toMatchObject({
      abn: "51824753556",
      abnStatus: "ACT",
      legalName: "ACME ELECTRICAL PTY LTD",
      tradingName: "Acme Electrical",
      state: "VIC",
      postcode: "3198",
      entityType: "Australian Private Company",
    });
  });

  it("reads a sole trader, which has no NonIndividualNameText", () => {
    const record = parseAbrBlock(SOLE_TRADER);
    expect(record?.legalName).toBe("JANE ROOFER");
    expect(record?.entityType).toBe("Individual/Sole Trader");
  });

  it("keeps cancelled status so the ingest can skip it", () => {
    const record = parseAbrBlock(CANCELLED);
    expect(record && isActiveAbnRecord(record)).toBe(false);
  });
});

describe("takeCompleteAbrBlocks", () => {
  it("reassembles a tag split across chunks", () => {
    const xml = `${COMPANY}${SOLE_TRADER}`;
    const cut = xml.indexOf("<ABN", 20);
    const first = takeCompleteAbrBlocks(xml.slice(0, cut));
    expect(first.blocks).toEqual([]);
    const second = takeCompleteAbrBlocks(first.rest + xml.slice(cut));
    expect(parseAbrRecords(second.blocks.join("") + second.rest)).toHaveLength(2);
  });
});
