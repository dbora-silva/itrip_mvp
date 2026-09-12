import { requireSupabaseForRead } from "@/lib/trips/auth";
import { logTripsError } from "@/lib/trips/log";
import { tripFiltersSchema, uuidSchema } from "@/features/trips/schemas";
import { mapRowToTrip, mapRowsToTrips } from "@/features/trips/mappers";
import type { Trip, TripFilters } from "@/features/trips/types";

/**
 * List-page read. Search/filter/sort all happen in Postgres via the search_trips RPC
 * (supabase/migrations/20260911212923_create_search_trips_function.sql) — never a
 * `.or()` filter string built here, and never a client-side re-filter of an already
 * fetched array (see docs/security.md, Phase 6, on why: postgrest-js's `.or()` performs
 * no escaping of its own).
 *
 * No manual `.eq("owner_id", ...)`: RLS (trips_select_own) is the only thing that scopes
 * results to the caller — duplicating that filter in application code would just be a
 * second, redundant place the authorization rule could drift out of sync with the first.
 */
export async function listTrips(
  rawFilters: unknown,
  pathname: string,
): Promise<{ trips: Trip[]; filters: TripFilters }> {
  const supabase = await requireSupabaseForRead(pathname);
  const filters = tripFiltersSchema.parse(rawFilters);

  const { data, error } = await supabase.rpc("search_trips", {
    p_search: filters.q ?? null,
    p_status: filters.status ?? null,
  });

  if (error) {
    logTripsError("list_trips", error);
    return { trips: [], filters };
  }

  return { trips: mapRowsToTrips(data ?? []), filters };
}

/**
 * Single-trip read, for the detail and edit pages. A malformed UUID and a well-formed
 * UUID that doesn't exist or belongs to another user all return `null` the same way —
 * the caller (a page component) turns that into `notFound()` either way, so none of the
 * three cases is ever distinguishable from one another.
 */
export async function getTripById(rawId: unknown, pathname: string): Promise<Trip | null> {
  const supabase = await requireSupabaseForRead(pathname);

  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return null;

  const { data, error } = await supabase
    .from("trips_with_status")
    .select(
      "id, name, destination, start_date, end_date, description, itinerary, status, created_at, updated_at",
    )
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) {
    logTripsError("get_trip_by_id", error);
    return null;
  }
  if (!data) return null;

  return mapRowToTrip(data);
}
