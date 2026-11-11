import { describe, expect, it } from "vitest";
import { canonicalRequestPath } from "./canonicalPath";

describe("canonicalRequestPath", () => {
  it("strips a trailing slash from public pages", () => {
    expect(canonicalRequestPath("/directory/")).toBe("/directory");
    expect(canonicalRequestPath("/electricians-box-hill-vic/")).toBe("/electricians-box-hill-vic");
    expect(canonicalRequestPath("/")).toBe("/");
    expect(canonicalRequestPath("/directory")).toBe("/directory");
  });

  it("leaves ingest and api paths alone", () => {
    expect(canonicalRequestPath("/ingest/static/")).toBe("/ingest/static/");
    expect(canonicalRequestPath("/api/cron/refresh-seo/")).toBe("/api/cron/refresh-seo/");
  });
});
