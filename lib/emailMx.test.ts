import { describe, expect, it } from "vitest";
import { emailDomain, lookupEmailMx } from "./emailMx";

describe("emailDomain", () => {
  it("reads a normal address and rejects junk", () => {
    expect(emailDomain(" Owner@Example.com.au ")).toBe("example.com.au");
    expect(emailDomain("not-an-email")).toBeNull();
    expect(emailDomain("a@b")).toBeNull();
    expect(emailDomain(null)).toBeNull();
  });
});

describe("lookupEmailMx", () => {
  it("is valid when the domain has MX records", async () => {
    const result = await lookupEmailMx("a@example.com.au", async () => [{ exchange: "mx.example.com.au" }]);
    expect(result).toBe("valid");
  });

  it("is invalid when DNS has no mail exchanger", async () => {
    const result = await lookupEmailMx("a@example.com.au", async () => []);
    expect(result).toBe("invalid");
  });

  it("is invalid for a missing domain and unknown for a transient DNS error", async () => {
    const missing = await lookupEmailMx("a@example.com.au", async () => {
      const err = new Error("not found") as Error & { code?: string };
      err.code = "ENOTFOUND";
      throw err;
    });
    const timeout = await lookupEmailMx("a@example.com.au", async () => {
      const err = new Error("timed out") as Error & { code?: string };
      err.code = "ETIMEOUT";
      throw err;
    });
    expect(missing).toBe("invalid");
    expect(timeout).toBe("unknown");
  });

  it("does not call DNS for a malformed address", async () => {
    let called = false;
    const result = await lookupEmailMx("nope", async () => {
      called = true;
      return [];
    });
    expect(result).toBe("invalid");
    expect(called).toBe(false);
  });
});
