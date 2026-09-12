import { describe, expect, it } from "vitest";
import { formatCivilDateBR, isValidCivilDate } from "@/lib/dates/civil-date";

describe("isValidCivilDate", () => {
  it("accepts a common valid date", () => {
    expect(isValidCivilDate("2026-09-11")).toBe(true);
  });

  it("accepts February 29 in a leap year", () => {
    expect(isValidCivilDate("2028-02-29")).toBe(true);
  });

  it("rejects February 29 in a non-leap year", () => {
    expect(isValidCivilDate("2026-02-29")).toBe(false);
  });

  it("rejects day 31 in a 30-day month", () => {
    expect(isValidCivilDate("2026-04-31")).toBe(false);
  });

  it("rejects day 31 in February", () => {
    expect(isValidCivilDate("2026-02-31")).toBe(false);
  });

  it("rejects month 0", () => {
    expect(isValidCivilDate("2026-00-10")).toBe(false);
  });

  it("rejects month 13", () => {
    expect(isValidCivilDate("2026-13-10")).toBe(false);
  });

  it("rejects day 0", () => {
    expect(isValidCivilDate("2026-01-00")).toBe(false);
  });

  it("rejects an incomplete format", () => {
    expect(isValidCivilDate("2026-9-1")).toBe(false);
  });

  it("rejects a non-ISO format", () => {
    expect(isValidCivilDate("11/09/2026")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidCivilDate("")).toBe(false);
  });

  it("rejects a value with a trailing time component", () => {
    expect(isValidCivilDate("2026-09-11T00:00:00Z")).toBe(false);
  });
});

describe("formatCivilDateBR", () => {
  it("reformats YYYY-MM-DD as DD/MM/AAAA without touching the values", () => {
    expect(formatCivilDateBR("2026-09-11")).toBe("11/09/2026");
  });
});
