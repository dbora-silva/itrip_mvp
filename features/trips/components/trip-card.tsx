import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { formatCivilDateBR } from "@/lib/dates/civil-date";
import { StatusBadge } from "@/features/trips/components/status-badge";
import { DeleteTripDialog } from "@/features/trips/components/delete-trip-dialog";
import type { Trip } from "@/features/trips/types";

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <StatusBadge status={trip.status} />

      <div>
        <h2 className="text-lg font-semibold text-balance text-foreground">{trip.name}</h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {trip.destination}
        </p>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDaysIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {formatCivilDateBR(trip.startDate)} – {formatCivilDateBR(trip.endDate)}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
        <Link
          href={`/dashboard/viagens/${trip.id}`}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Ver detalhes
        </Link>
        <Link
          href={`/dashboard/viagens/${trip.id}/editar`}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Editar viagem
        </Link>
        <DeleteTripDialog tripId={trip.id} tripName={trip.name} />
      </div>
    </article>
  );
}
