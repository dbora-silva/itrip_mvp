import { describe, expect, it } from "vitest";
import { mapRowToTrip, mapRowsToTrips } from "@/features/trips/mappers";

const VALID_ROW = {
  id: "b6857da0-d3f8-4575-8c80-a561d26beeca",
  name: "Lua de mel na Itália",
  destination: "Florença",
  start_date: "2026-10-01",
  end_date: "2026-10-10",
  description: null,
  itinerary: null,
  status: "planning",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("mapRowToTrip", () => {
  it("converts snake_case DB fields to the camelCase Trip shape", () => {
    const trip = mapRowToTrip(VALID_ROW);
    expect(trip).toEqual({
      id: VALID_ROW.id,
      name: VALID_ROW.name,
      destination: VALID_ROW.destination,
      startDate: VALID_ROW.start_date,
      endDate: VALID_ROW.end_date,
      description: null,
      itinerary: null,
      status: "planning",
      createdAt: VALID_ROW.created_at,
      updatedAt: VALID_ROW.updated_at,
    });
  });

  it("passes status through verbatim, never re-deriving it", () => {
    const trip = mapRowToTrip({ ...VALID_ROW, status: "completed" });
    expect(trip.status).toBe("completed");
  });

  it("preserves a non-null description", () => {
    const trip = mapRowToTrip({ ...VALID_ROW, description: "Viagem de aniversário" });
    expect(trip.description).toBe("Viagem de aniversário");
  });

  it("preserves a null itinerary", () => {
    const trip = mapRowToTrip(VALID_ROW);
    expect(trip.itinerary).toBeNull();
  });

  it("preserves line breaks in a non-null itinerary", () => {
    const multiline = "Dia 1: chegada\nDia 2: passeio\nDia 3: volta";
    const trip = mapRowToTrip({ ...VALID_ROW, itinerary: multiline });
    expect(trip.itinerary).toBe(multiline);
  });

  it("throws instead of silently accepting an unrecognized status value", () => {
    expect(() => mapRowToTrip({ ...VALID_ROW, status: "not_a_real_status" })).toThrow();
  });

  it("throws instead of silently accepting a malformed row", () => {
    expect(() => mapRowToTrip({ ...VALID_ROW, id: "not-a-uuid" })).toThrow();
  });
});

describe("mapRowsToTrips", () => {
  it("maps an array of rows", () => {
    const trips = mapRowsToTrips([VALID_ROW, { ...VALID_ROW, status: "ongoing" }]);
    expect(trips).toHaveLength(2);
    expect(trips[1].status).toBe("ongoing");
  });

  it("maps an empty array to an empty array", () => {
    expect(mapRowsToTrips([])).toEqual([]);
  });
});
