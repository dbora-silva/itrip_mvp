import { z } from "zod";
import type { Trip } from "@/features/trips/types";

/**
 * Validates the shape of a row coming back from `trips_with_status` / `search_trips`
 * before it is trusted as a `Trip` — this project has no generated database types (see
 * docs/security.md, Phase 6 section, on that decision), so nothing statically guarantees
 * the DB response matches what the app expects. In particular, `status` is checked
 * against the same fixed enum the UI knows how to render: an unrecognized value fails
 * loudly here instead of silently reaching status-labels.ts's exhaustive switch as an
 * unsafe cast would.
 */
const tripRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  description: z.string().nullable(),
  itinerary: z.string().nullable(),
  status: z.enum(["planning", "upcoming", "ongoing", "completed"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export function mapRowToTrip(row: unknown): Trip {
  const parsed = tripRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    destination: parsed.destination,
    startDate: parsed.start_date,
    endDate: parsed.end_date,
    description: parsed.description,
    itinerary: parsed.itinerary,
    status: parsed.status,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}

export function mapRowsToTrips(rows: unknown[]): Trip[] {
  return rows.map(mapRowToTrip);
}
