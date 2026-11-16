import { describe, expect, it } from "vitest";
import { POSTGREST_PAGE_SIZE, fetchAllPages } from "./fetchAllPages";

describe("fetchAllPages", () => {
  it("keeps requesting after a full page, including past 1000 rows", async () => {
    const total = POSTGREST_PAGE_SIZE + 500;
    const calls: number[] = [];
    const rows = await fetchAllPages(async (from, pageSize) => {
      calls.push(from);
      expect(pageSize).toBe(POSTGREST_PAGE_SIZE);
      if (from >= total) return [];
      const count = Math.min(pageSize, total - from);
      return Array.from({ length: count }, (_, i) => from + i);
    });

    expect(rows).toHaveLength(total);
    expect(rows[0]).toBe(0);
    expect(rows[POSTGREST_PAGE_SIZE]).toBe(POSTGREST_PAGE_SIZE);
    expect(rows[total - 1]).toBe(total - 1);
    expect(calls).toEqual([0, POSTGREST_PAGE_SIZE]);
  });

  it("does not treat an exact page-size result as the end of the table", async () => {
    const calls: number[] = [];
    const rows = await fetchAllPages(async (from, pageSize) => {
      calls.push(from);
      if (from === 0) return Array.from({ length: pageSize }, (_, i) => i);
      return [];
    });
    expect(rows).toHaveLength(POSTGREST_PAGE_SIZE);
    expect(calls).toEqual([0, POSTGREST_PAGE_SIZE]);
  });

  it("propagates a failed page instead of returning a short successful set", async () => {
    await expect(
      fetchAllPages(async (from, pageSize) => {
        if (from === 0) return Array.from({ length: pageSize }, (_, i) => i);
        throw new Error("directory_listing fetch failed");
      }),
    ).rejects.toThrow("directory_listing fetch failed");
  });
});
