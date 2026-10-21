import { describe, expect, it } from "vitest";
import {
  listingRichness,
  mergeListingFields,
  namesCompatible,
  planDirectoryMerges,
  type MergeCandidate,
} from "./directoryMerge";

function row(partial: Partial<MergeCandidate> & Pick<MergeCandidate, "id" | "business_name">): MergeCandidate {
  return {
    suburb: "Bondi",
    phone_e164: null,
    website_domain: null,
    abn: null,
    is_claimed: false,
    profile_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    score: 0,
    ...partial,
  };
}

describe("namesCompatible", () => {
  it("treats legal suffixes and extra words as the same business", () => {
    expect(namesCompatible("Sanelli Concrete", "Sanelli Concreting")).toBe(true);
    expect(namesCompatible("D Squared", "D Squared Electrical")).toBe(true);
    expect(namesCompatible("semko qualty painting", "Semko Quality Painting")).toBe(false);
    expect(namesCompatible("The Concrete Firm", "The Concrete Firm Pty Ltd")).toBe(true);
  });

  it("does not treat different trades that share a word as the same business", () => {
    expect(namesCompatible("Petrelli Electrical Services", "Petrelli Plumbing Services")).toBe(false);
    expect(namesCompatible("Rory test", "Swiftscope test")).toBe(false);
  });
});

describe("planDirectoryMerges", () => {
  it("merges the same name in the same suburb and keeps other suburbs", () => {
    const plan = planDirectoryMerges([
      row({ id: "a", business_name: "New Style Plaster", phone_e164: "+61212345678", score: 10, created_at: "2026-01-02T00:00:00.000Z" }),
      row({ id: "b", business_name: "New Style Plaster", phone_e164: "+61212345678", score: 30, created_at: "2026-01-01T00:00:00.000Z" }),
      row({ id: "c", business_name: "New Style Plaster", suburb: "Pakenham", phone_e164: "+61212345678", score: 5 }),
    ]);
    expect(plan.merges).toEqual([
      { winnerId: "b", loserIds: ["a"], reason: "same business in one suburb" },
    ]);
    expect(plan.suppressions).toEqual([]);
    expect(plan.needsReview).toEqual([]);
  });

  it("prefers a claimed listing over a richer unclaimed one", () => {
    const plan = planDirectoryMerges([
      row({ id: "plain", business_name: "Acme Electrical", score: 5 }),
      row({ id: "claimed", business_name: "Acme Electrical", is_claimed: true, profile_id: "p1", score: listingRichness({ is_claimed: true, profile_id: "p1" }) }),
    ]);
    expect(plan.merges[0].winnerId).toBe("claimed");
    expect(plan.merges[0].loserIds).toEqual(["plain"]);
  });

  it("does not merge two claimed profiles", () => {
    const plan = planDirectoryMerges([
      row({ id: "a", business_name: "Rory test", phone_e164: "+61412345678", is_claimed: true, profile_id: "p1", score: 1500 }),
      row({ id: "b", business_name: "Swiftscope test", phone_e164: "+61412345678", is_claimed: true, profile_id: "p2", score: 1500 }),
    ]);
    expect(plan.merges).toEqual([]);
    expect(plan.suppressions).toEqual([]);
    expect(plan.needsReview).toHaveLength(1);
    expect(plan.needsReview[0].ids.sort()).toEqual(["a", "b"]);
  });

  it("suppresses the shared phone key when names are different businesses", () => {
    const plan = planDirectoryMerges([
      row({ id: "elec", business_name: "Petrelli Electrical Services", phone_e164: "+61391234567", score: 20 }),
      row({ id: "plumb", business_name: "Petrelli Plumbing Services", phone_e164: "+61391234567", score: 5 }),
    ]);
    expect(plan.merges).toEqual([]);
    expect(plan.suppressions).toEqual([
      {
        keepId: "elec",
        suppressIds: ["plumb"],
        field: "phone",
        reason: "different businesses share a phone in one suburb",
      },
    ]);
  });

  it("does not treat a 1300 number as an identity key", () => {
    const plan = planDirectoryMerges([
      row({ id: "a", business_name: "Pipe Dream Plumbing", phone_e164: "+611300123456" }),
      row({ id: "b", business_name: "Someone Else Entirely", phone_e164: "+611300123456" }),
    ]);
    expect(plan.merges).toEqual([]);
    expect(plan.suppressions).toEqual([]);
  });
});

describe("mergeListingFields", () => {
  it("fills blanks and unions trades without clobbering the winner", () => {
    const patch = mergeListingFields(
      { business_name: "Acme", website_url: "https://acme.com.au", trades: ["electrician"], blurb: "Winner blurb" },
      { website_url: "https://other.example", trades: ["plumber"], blurb: "Loser blurb", scraped_contact_phone: "0412345678", abn: "51824753556" },
    );
    expect(patch.website_url).toBeUndefined();
    expect(patch.blurb).toBeUndefined();
    expect(patch.trades).toEqual(["electrician", "plumber"]);
    expect(patch.scraped_contact_phone).toBe("0412345678");
    expect(patch.abn).toBe("51824753556");
  });
});
