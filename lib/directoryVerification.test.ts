import { describe, expect, it } from "vitest";
import { buildVerificationPatch, outreachEmail, verificationCutoff, VERIFICATION_MAX_AGE_DAYS } from "./directoryVerification";

describe("buildVerificationPatch", () => {
  it("records an active ABN and a deliverable domain", () => {
    const patch = buildVerificationPatch({
      mx: "valid",
      abn: { configured: true, valid: true, active: true },
      now: "2026-10-21T00:00:00.000Z",
    });
    expect(patch).toEqual({
      email_valid: true,
      verified_at: "2026-10-21T00:00:00.000Z",
      verification_source: "mx:valid,abn_lookup:active",
    });
  });

  it("does not start the 90-day clock when ABN Lookup is not configured", () => {
    const patch = buildVerificationPatch({
      mx: "invalid",
      abn: { configured: false, valid: false },
      now: "2026-10-21T00:00:00.000Z",
    });
    expect(patch.email_valid).toBe(false);
    expect(patch.verified_at).toBeNull();
    expect(patch.verification_source).toContain("abn_lookup:unconfigured");
  });

  it("defers a transient MX failure", () => {
    const patch = buildVerificationPatch({ mx: "unknown", abn: null, now: "2026-10-21T00:00:00.000Z" });
    expect(patch.verified_at).toBeNull();
    expect(patch.email_valid).toBeNull();
  });
});

describe("verification schedule", () => {
  it("uses a 90-day cutoff and the outreach address", () => {
    const cutoff = new Date(verificationCutoff(Date.parse("2026-10-21T00:00:00.000Z"))).getTime();
    const expected = Date.parse("2026-10-21T00:00:00.000Z") - VERIFICATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    expect(cutoff).toBe(expected);
    expect(outreachEmail({ scraped_contact_email: " a@b.com ", private_email: "c@d.com" })).toBe("a@b.com");
    expect(outreachEmail({ private_email: "c@d.com" })).toBe("c@d.com");
  });
});
