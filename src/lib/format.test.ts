import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTimeRange } from "./format";

describe("format helpers", () => {
  it("returns empty string for null/undefined", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatTimeRange(null)).toBe("");
  });

  it("formats a valid date", () => {
    expect(formatDate("2026-07-09T14:00:00-04:00")).toBe("Jul 9, 2026");
  });

  it("formats a time range with start and end", () => {
    const out = formatTimeRange(
      "2026-07-09T14:00:00-04:00",
      "2026-07-09T14:30:00-04:00",
    );
    expect(out).toContain("–");
  });

  it("handles invalid input gracefully", () => {
    expect(formatDateTime("not-a-date")).toBe("");
  });
});
