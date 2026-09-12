import { TripCard } from "@/features/trips/components/trip-card";
import { TripsEmptyState } from "@/features/trips/components/trips-empty-state";
import type { Trip, TripFilters } from "@/features/trips/types";

interface TripListProps {
  trips: Trip[];
  filters: TripFilters;
}

export function TripList({ trips, filters }: TripListProps) {
  if (trips.length === 0) {
    const hasActiveFilters = Boolean(filters.q) || Boolean(filters.status);
    return <TripsEmptyState variant={hasActiveFilters ? "no-results" : "no-trips"} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
