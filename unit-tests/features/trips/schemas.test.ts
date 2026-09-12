import { describe, expect, it } from "vitest";
import { tripFiltersSchema, tripFormSchema, uuidSchema } from "@/features/trips/schemas";

const VALID_TRIP = {
  name: "Lua de mel na Itália",
  destination: "Florença",
  description: "Viagem de aniversário",
  start_date: "2026-10-01",
  end_date: "2026-10-10",
};

describe("tripFormSchema", () => {
  it("accepts a valid trip", () => {
    const result = tripFormSchema.safeParse(VALID_TRIP);
    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 120 characters", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("rejects a blank destination", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, destination: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a destination over 120 characters", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, destination: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("trims name and destination", () => {
    const result = tripFormSchema.parse({
      ...VALID_TRIP,
      name: "  Itália  ",
      destination: "  Florença  ",
    });
    expect(result.name).toBe("Itália");
    expect(result.destination).toBe("Florença");
  });

  it("normalizes an empty description to null", () => {
    const result = tripFormSchema.parse({ ...VALID_TRIP, description: "" });
    expect(result.description).toBeNull();
  });

  it("normalizes an absent description to null", () => {
    const withoutDescription = {
      name: VALID_TRIP.name,
      destination: VALID_TRIP.destination,
      start_date: VALID_TRIP.start_date,
      end_date: VALID_TRIP.end_date,
    };
    const result = tripFormSchema.parse(withoutDescription);
    expect(result.description).toBeNull();
  });

  it("normalizes a whitespace-only description to null", () => {
    const result = tripFormSchema.parse({ ...VALID_TRIP, description: "   " });
    expect(result.description).toBeNull();
  });

  it("rejects a description over 2000 characters", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, description: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid start_date format", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, start_date: "01/10/2026" });
    expect(result.success).toBe(false);
  });

  it("rejects an impossible start_date (calendar-invalid, not just format)", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, start_date: "2026-02-30" });
    expect(result.success).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = tripFormSchema.safeParse({
      ...VALID_TRIP,
      start_date: "2026-10-10",
      end_date: "2026-10-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts end_date equal to start_date (single-day trip)", () => {
    const result = tripFormSchema.safeParse({
      ...VALID_TRIP,
      start_date: "2026-10-01",
      end_date: "2026-10-01",
    });
    expect(result.success).toBe(true);
  });

  it("preserves a leap-day date as-is, with no shift", () => {
    const result = tripFormSchema.parse({
      ...VALID_TRIP,
      start_date: "2028-02-29",
      end_date: "2028-03-01",
    });
    expect(result.start_date).toBe("2028-02-29");
  });

  it("rejects a payload carrying an unexpected status field", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, status: "completed" });
    expect(result.success).toBe(false);
  });

  it("rejects a payload carrying an unexpected owner_id field", () => {
    const result = tripFormSchema.safeParse({
      ...VALID_TRIP,
      owner_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(false);
  });
});

describe("tripFormSchema — itinerary", () => {
  it("accepts a valid itinerary", () => {
    const result = tripFormSchema.parse({ ...VALID_TRIP, itinerary: "Dia 1: chegada." });
    expect(result.itinerary).toBe("Dia 1: chegada.");
  });

  it("normalizes an absent itinerary to null", () => {
    const result = tripFormSchema.parse(VALID_TRIP);
    expect(result.itinerary).toBeNull();
  });

  it("normalizes an empty string itinerary to null", () => {
    const result = tripFormSchema.parse({ ...VALID_TRIP, itinerary: "" });
    expect(result.itinerary).toBeNull();
  });

  it("normalizes a whitespace-only itinerary to null", () => {
    const result = tripFormSchema.parse({ ...VALID_TRIP, itinerary: "   \n\t  " });
    expect(result.itinerary).toBeNull();
  });

  it("trims leading and trailing whitespace", () => {
    const result = tripFormSchema.parse({ ...VALID_TRIP, itinerary: "  Dia 1: chegada.  " });
    expect(result.itinerary).toBe("Dia 1: chegada.");
  });

  it("preserves internal line breaks (trim only touches the edges)", () => {
    const multiline = "Dia 1: chegada\nDia 2: passeio\nDia 3: volta";
    const result = tripFormSchema.parse({ ...VALID_TRIP, itinerary: multiline });
    expect(result.itinerary).toBe(multiline);
  });

  it("accepts exactly 10000 characters", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, itinerary: "a".repeat(10000) });
    expect(result.success).toBe(true);
  });

  it("rejects more than 10000 characters", () => {
    const result = tripFormSchema.safeParse({ ...VALID_TRIP, itinerary: "a".repeat(10001) });
    expect(result.success).toBe(false);
  });
});

describe("tripFiltersSchema", () => {
  it("accepts a valid search term", () => {
    const result = tripFiltersSchema.parse({ q: "Itália", status: undefined });
    expect(result.q).toBe("Itália");
  });

  it("normalizes an empty search term to undefined", () => {
    const result = tripFiltersSchema.parse({ q: "", status: undefined });
    expect(result.q).toBeUndefined();
  });

  it("truncates/ignores a search term over 200 characters into undefined", () => {
    const result = tripFiltersSchema.parse({ q: "a".repeat(201), status: undefined });
    expect(result.q).toBeUndefined();
  });

  it("accepts every valid status value", () => {
    for (const status of ["planning", "upcoming", "ongoing", "completed"]) {
      const result = tripFiltersSchema.parse({ q: undefined, status });
      expect(result.status).toBe(status);
    }
  });

  it("drops an invalid status value instead of throwing", () => {
    const result = tripFiltersSchema.parse({ q: undefined, status: "nao_existe" });
    expect(result.status).toBeUndefined();
  });

  it("drops a non-string q value (e.g. repeated query param) instead of throwing", () => {
    const result = tripFiltersSchema.parse({ q: ["a", "b"], status: undefined });
    expect(result.q).toBeUndefined();
  });
});

describe("uuidSchema", () => {
  it("accepts a well-formed UUID", () => {
    expect(uuidSchema.safeParse("b6857da0-d3f8-4575-8c80-a561d26beeca").success).toBe(true);
  });

  it("rejects a malformed UUID", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(uuidSchema.safeParse("").success).toBe(false);
  });
});
